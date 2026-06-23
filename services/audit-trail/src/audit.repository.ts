import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';

export interface AuditRecord {
  id: number;
  creditId: string;
  decision: unknown;
  prevHash: string;
  hash: string;
  signature: string;
  createdAt: string;
}

/**
 * Repositorio APPEND-ONLY del log de auditoría.
 *
 * Reglas regulatorias (Superintendencia):
 *  - Solo INSERT. Nunca UPDATE ni DELETE → inmutabilidad.
 *  - Retención 10 años (la tabla no se purga; se archiva en frío).
 *  - Cada registro guarda: variables de entrada + pesos del modelo + decisión
 *    final (campo `decision` jsonb), el hash encadenado y la firma digital.
 */
@Injectable()
export class AuditRepository implements OnModuleInit {
  private readonly logger = new Logger(AuditRepository.name);
  private pool: Pool;
  private ready = false;

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await this.migrate();
      this.ready = true;
      this.logger.log('audit_log listo (append-only)');
    } catch (err) {
      // No tumbamos el servicio si la BD aún no está arriba: reintenta luego.
      this.logger.error(`No se pudo migrar audit_log: ${(err as Error).message}`);
    }
  }

  private async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          BIGSERIAL PRIMARY KEY,
        credit_id   TEXT        NOT NULL,
        decision    JSONB       NOT NULL,
        prev_hash   TEXT        NOT NULL,
        hash        TEXT        NOT NULL UNIQUE,
        signature   TEXT        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_credit ON audit_log (credit_id);
    `);

    // Defensa en profundidad: revoca UPDATE/DELETE a nivel de trigger para que
    // ni un INSERT accidental de la app pueda mutar la traza histórica.
    await this.pool.query(`
      CREATE OR REPLACE FUNCTION audit_block_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log es append-only: % no permitido', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await this.pool.query(`DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_log;`);
    await this.pool.query(`
      CREATE TRIGGER trg_audit_immutable
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_block_mutation();
    `);
  }

  /** Hash del último registro de la cadena global (o GENESIS si está vacía). */
  async lastHash(): Promise<string> {
    const { rows } = await this.pool.query(
      `SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1`,
    );
    return rows.length ? rows[0].hash : 'GENESIS';
  }

  async append(rec: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO audit_log (credit_id, decision, prev_hash, hash, signature)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, credit_id, decision, prev_hash, hash, signature, created_at`,
      [rec.creditId, JSON.stringify(rec.decision), rec.prevHash, rec.hash, rec.signature],
    );
    return this.map(rows[0]);
  }

  /** Traza completa de un crédito, en orden cronológico (para el regulador). */
  async byCreditId(creditId: string): Promise<AuditRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, credit_id, decision, prev_hash, hash, signature, created_at
       FROM audit_log WHERE credit_id = $1 ORDER BY id ASC`,
      [creditId],
    );
    return rows.map(this.map);
  }

  /** Cadena global completa (para verificar integridad punta a punta). */
  async all(): Promise<AuditRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT id, credit_id, decision, prev_hash, hash, signature, created_at
       FROM audit_log ORDER BY id ASC`,
    );
    return rows.map(this.map);
  }

  isReady(): boolean {
    return this.ready;
  }

  private map = (r: any): AuditRecord => ({
    id: r.id,
    creditId: r.credit_id,
    decision: r.decision,
    prevHash: r.prev_hash,
    hash: r.hash,
    signature: r.signature,
    createdAt: r.created_at,
  });
}
