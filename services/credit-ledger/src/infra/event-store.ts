import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';
import { DomainEvent } from '../domain/events';

export interface StoredEvent {
  eventId: string;
  aggregateId: string;
  version: number;
  type: string;
  payload: any;
  correlationId: string | null;
  occurredAt: string;
}

/**
 * Event Store en PostgreSQL — la fuente de verdad del servicio de créditos.
 *
 *  - Tabla `events` APPEND-ONLY.
 *  - UNIQUE(aggregate_id, version) ⇒ concurrencia optimista: si dos comandos
 *    intentan escribir la misma versión del agregado, el segundo falla (409).
 *  - El estado actual NUNCA se guarda; se reconstruye leyendo el stream.
 */
@Injectable()
export class EventStore implements OnModuleInit {
  private readonly logger = new Logger(EventStore.name);
  private pool!: Pool;

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          event_id       UUID        PRIMARY KEY,
          aggregate_id   TEXT        NOT NULL,
          aggregate_type TEXT        NOT NULL DEFAULT 'CreditApplication',
          version        INT         NOT NULL,
          event_type     TEXT        NOT NULL,
          payload        JSONB       NOT NULL,
          correlation_id TEXT,
          occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (aggregate_id, version)
        );
        CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events (aggregate_id, version);
      `);
      this.logger.log('Event Store listo (tabla events append-only)');
    } catch (err) {
      this.logger.error(`No se pudo inicializar el Event Store: ${(err as Error).message}`);
    }
  }

  /** Lee el stream completo de un agregado en orden de versión. */
  async load(aggregateId: string): Promise<DomainEvent[]> {
    const { rows } = await this.pool.query(
      `SELECT event_type, payload FROM events WHERE aggregate_id = $1 ORDER BY version ASC`,
      [aggregateId],
    );
    return rows.map((r) => ({ type: r.event_type, payload: r.payload }));
  }

  /**
   * Anexa eventos nuevos a partir de `expectedVersion` (concurrencia optimista).
   * Se hace en una transacción: o entran todos los eventos o ninguno.
   */
  async append(
    aggregateId: string,
    expectedVersion: number,
    events: DomainEvent[],
    correlationId: string | null,
  ): Promise<StoredEvent[]> {
    const client = await this.pool.connect();
    const stored: StoredEvent[] = [];
    try {
      await client.query('BEGIN');
      let version = expectedVersion;
      for (const e of events) {
        version += 1;
        const eventId = uuid();
        await client.query(
          `INSERT INTO events (event_id, aggregate_id, version, event_type, payload, correlation_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [eventId, aggregateId, version, e.type, JSON.stringify(e.payload), correlationId],
        );
        stored.push({
          eventId,
          aggregateId,
          version,
          type: e.type,
          payload: e.payload,
          correlationId,
          occurredAt: new Date().toISOString(),
        });
      }
      await client.query('COMMIT');
      return stored;
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err?.code === '23505') {
        // violación de UNIQUE(aggregate_id, version) → conflicto de concurrencia
        const conflict = new Error('concurrency_conflict');
        (conflict as any).status = 409;
        throw conflict;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /** Todos los eventos de un agregado (para el endpoint de trazabilidad). */
  async timeline(aggregateId: string): Promise<StoredEvent[]> {
    const { rows } = await this.pool.query(
      `SELECT event_id, aggregate_id, version, event_type, payload, correlation_id, occurred_at
       FROM events WHERE aggregate_id = $1 ORDER BY version ASC`,
      [aggregateId],
    );
    return rows.map((r) => ({
      eventId: r.event_id,
      aggregateId: r.aggregate_id,
      version: r.version,
      type: r.event_type,
      payload: r.payload,
      correlationId: r.correlation_id,
      occurredAt: r.occurred_at,
    }));
  }
}
