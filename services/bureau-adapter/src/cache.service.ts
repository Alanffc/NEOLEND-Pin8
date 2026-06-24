import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export interface BureauReport {
  dni: string;
  score: number;
  debtLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  activeCredits: number;
  paymentHistory: 'GOOD' | 'FAIR' | 'BAD';
  reportDate: string;
  cached?: boolean;
}

// Los reportes del buró no cambian dentro del día; 24 h es suficiente.
const TTL_SECONDS = 86_400;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    this.redis.on('error', (err: Error) =>
      this.logger.error('Redis error', err.message),
    );
  }

  async get(dni: string): Promise<BureauReport | null> {
    const raw = await this.redis.get(this.key(dni));
    if (!raw) return null;
    const report = JSON.parse(raw) as BureauReport;
    report.cached = true;
    return report;
  }

  async set(dni: string, report: BureauReport): Promise<void> {
    await this.redis.set(
      this.key(dni),
      JSON.stringify({ ...report, cached: false }),
      'EX',
      TTL_SECONDS,
    );
  }

  async invalidate(dni: string): Promise<void> {
    await this.redis.del(this.key(dni));
  }

  private key(dni: string): string {
    return `bureau:${dni}`;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
