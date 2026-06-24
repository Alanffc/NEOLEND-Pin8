import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker';
import { BureauReport, CacheService } from './cache.service';

export type BureauResponse = BureauReport & {
  source: 'live' | 'cache' | 'fallback';
};

@Injectable()
export class BureauService {
  private readonly logger = new Logger(BureauService.name);

  constructor(
    private readonly cb: CircuitBreakerService,
    private readonly cache: CacheService,
  ) {}

  async getReport(dni: string): Promise<BureauResponse> {
    // 1. Llamada en vivo a través del circuit breaker
    try {
      const report = await this.cb.execute(() => this.callSoapBureau(dni));
      await this.cache.set(dni, report);
      return { ...report, source: 'live' };
    } catch (err) {
      this.logger.warn(
        `Llamada al buró fallida (${(err as Error).message}) — intentando caché`,
      );
    }

    // 2. Caché inteligente: sirve datos previos mientras el buró está caído
    const cached = await this.cache.get(dni);
    if (cached) {
      this.logger.log(`Sirviendo reporte de caché para DNI ${this.maskDni(dni)}`);
      return { ...cached, source: 'cache' };
    }

    // 3. Fallback duro: bloquea aprobación automática
    this.logger.error(
      `Sin datos de buró para DNI ${this.maskDni(dni)} — respuesta de fallback`,
    );
    return {
      dni,
      score: 0,
      debtLevel: 'HIGH',
      activeCredits: 0,
      paymentHistory: 'BAD',
      reportDate: new Date().toISOString(),
      cached: false,
      source: 'fallback',
    };
  }

  /**
   * Adaptador SOAP al buró legacy.
   * Simula la latencia real de 8-15 s documentada en los NFR.
   * En producción, aquí iría node-soap apuntando a BUREAU_SOAP_URL.
   */
  private async callSoapBureau(dni: string): Promise<BureauReport> {
    const latencyMs = 8_000 + Math.random() * 7_000;
    // TODO: reemplazar con node-soap apuntando a process.env.BUREAU_SOAP_URL
    console.log(`[BureauService] llamando SOAP (latencia simulada: ${latencyMs.toFixed(0)} ms)`);
    await new Promise(r => setTimeout(r, latencyMs));

    return {
      dni,
      score: 500 + Math.floor(Math.random() * 350),
      debtLevel: pickRandom(['LOW', 'MEDIUM', 'HIGH']),
      activeCredits: Math.floor(Math.random() * 5),
      paymentHistory: pickRandom(['GOOD', 'FAIR', 'BAD']),
      reportDate: new Date().toISOString(),
      cached: false,
    };
  }

  circuitStatus() {
    return this.cb.status();
  }

  private maskDni(dni: string): string {
    return `${dni.slice(0, 3)}${'*'.repeat(Math.max(0, dni.length - 3))}`;
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
