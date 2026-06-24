import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker de 3 estados para el buró SOAP legacy.
 * Incluye rate limiter de 10 req/s (ventana deslizante de 1 s).
 *
 *  CLOSED ──(≥ failureThreshold fallos)──▶ OPEN
 *  OPEN   ──(resetAfterMs transcurrido)──▶ HALF_OPEN
 *  HALF_OPEN ──(probe ok)──▶ CLOSED
 *  HALF_OPEN ──(probe falla)──▶ OPEN
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenProbeInFlight = false;

  private readonly failureThreshold: number;
  private readonly callTimeoutMs: number;
  private readonly resetAfterMs: number;

  private readonly RATE_LIMIT = 10;
  private requestTimestamps: number[] = [];

  constructor() {
    this.failureThreshold = parseInt(process.env.CB_FAILURE_THRESHOLD ?? '5', 10);
    this.callTimeoutMs    = parseInt(process.env.CB_TIMEOUT_MS          ?? '5000', 10);
    this.resetAfterMs     = parseInt(process.env.CB_RESET_MS            ?? '30000', 10);
  }

  getState(): CircuitState {
    if (
      this.state === CircuitState.OPEN &&
      Date.now() - this.lastFailureTime >= this.resetAfterMs
    ) {
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenProbeInFlight = false;
      this.logger.log('Circuit OPEN → HALF_OPEN (probe window open)');
    }
    return this.state;
  }

  private checkRateLimit(): void {
    const now = Date.now();
    // descarta timestamps fuera de la ventana de 1 s
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 1000);
    console.debug(`[CB] rate window: ${this.requestTimestamps.length}/${this.RATE_LIMIT} req/s`);
    if (this.requestTimestamps.length >= this.RATE_LIMIT) {
      throw new Error(`Rate limit: máximo ${this.RATE_LIMIT} req/s al buró`);
    }
    this.requestTimestamps.push(now);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkRateLimit();

    const state = this.getState();
    console.debug(`[CB] execute — estado actual: ${state}`);

    if (state === CircuitState.OPEN) {
      throw new Error('CircuitBreaker:OPEN — buró no disponible, usar caché');
    }
    if (state === CircuitState.HALF_OPEN && this.halfOpenProbeInFlight) {
      throw new Error('CircuitBreaker:HALF_OPEN — probe ya en vuelo, esperar');
    }
    if (state === CircuitState.HALF_OPEN) {
      this.halfOpenProbeInFlight = true;
    }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Bureau timeout (${this.callTimeoutMs} ms)`)),
        this.callTimeoutMs,
      ),
    );

    try {
      const result = await Promise.race([fn(), timeout]);
      this.onSuccess();
      return result as T;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.halfOpenProbeInFlight = false;
      this.logger.log('Circuit HALF_OPEN → CLOSED (buró recuperado)');
    }
    // en CLOSED onSuccess no cambia nada, solo reseteamos si hubiera conteo parcial
    // (actualmente solo contamos fallos consecutivos, no ventana deslizante de fallos)
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.halfOpenProbeInFlight = false;

    if (
      this.state === CircuitState.HALF_OPEN ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.logger.warn(
        `Circuit → OPEN (fallos=${this.failureCount}/${this.failureThreshold})`,
      );
    }
  }

  status() {
    const state = this.getState();
    return {
      state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureAt: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
      resetsAt:
        state === CircuitState.OPEN && this.lastFailureTime
          ? new Date(this.lastFailureTime + this.resetAfterMs).toISOString()
          : null,
    };
  }
}
