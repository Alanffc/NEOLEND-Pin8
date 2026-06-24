import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function initSchema(): Promise<void> {
  // CREATE TABLE IF NOT EXISTS es idempotente — seguro correr en cada arranque
  console.log('[DB] verificando/creando esquema loan_applications...');
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS loan_applications (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_id UUID        NOT NULL,
      dni          TEXT        NOT NULL,
      amount       NUMERIC(12,2) NOT NULL,
      status       TEXT        NOT NULL DEFAULT 'PENDING',
      decision     JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('[DB] esquema listo');
}
