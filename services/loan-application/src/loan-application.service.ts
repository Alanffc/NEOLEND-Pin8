import { Injectable, Logger } from '@nestjs/common';
import { getPool } from './infra/db';
import { publish } from './infra/event-bus';

export interface CreateApplicationDto {
  applicantId: string;
  dni: string;
  amount: number;
  docBase64?: string;
}

// Montos ≤ $500 son candidatos a aprobación automática (<90 s)
const AUTO_APPROVE_MAX_AMOUNT = 500;
const AUTO_APPROVE_MIN_SCORE  = 500;
const AUTO_APPROVE_TIMEOUT_MS = 90_000;

@Injectable()
export class LoanApplicationService {
  private readonly logger = new Logger(LoanApplicationService.name);

  async submit(dto: CreateApplicationDto): Promise<{ applicationId: string; status: string }> {
    const db = getPool();

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO loan_applications (applicant_id, dni, amount, status)
       VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
      [dto.applicantId, dto.dni, dto.amount],
    );
    const applicationId = rows[0].id;

    // Evento de dominio para scoring, fraude y auditoría
    await publish('loan.application.submitted', {
      applicationId,
      applicantId: dto.applicantId,
      docId: dto.docBase64 ? `dni:${applicationId}` : null,
      amount: dto.amount,
      correlationId: applicationId,
    });

    this.logger.log(
      `Solicitud ${applicationId} creada (monto=$${dto.amount}, DNI=${this.maskDni(dto.dni)})`,
    );
    console.log(`[LoanApp] nueva solicitud insertada en DB → id=${applicationId}`);

    // Rama de aprobación automática para montos pequeños
    if (dto.amount <= AUTO_APPROVE_MAX_AMOUNT) {
      console.log(`[LoanApp] monto ≤ $${AUTO_APPROVE_MAX_AMOUNT} → iniciando auto-approve`);
      void this.runAutoApprove(applicationId, dto);
    }

    return { applicationId, status: 'PENDING' };
  }

  /**
   * Flujo síncrono de aprobación automática para montos ≤ $500.
   * Objetivo: decisión completa en < 90 s (inciso III).
   * Si el timeout se alcanza antes de obtener el score, se escala a revisión manual.
   */
  private async runAutoApprove(
    applicationId: string,
    dto: CreateApplicationDto,
  ): Promise<void> {
    const startMs = Date.now();
    console.log(`[AutoApprove] ${applicationId} — iniciando (timeout=${AUTO_APPROVE_TIMEOUT_MS}ms)`);

    try {
      // --- 1. Verificación de fraude ---
      console.log(`[AutoApprove] ${applicationId} — llamando fraud-detection`);
      const fraud = await this.callFraud(applicationId, dto.dni);
      if (!fraud.passed) {
        await this.setStatus(applicationId, 'REJECTED', {
          reason: fraud.reason ?? 'fraud_check_failed',
        });
        this.logger.warn(`${applicationId} rechazada: fraude detectado`);
        return;
      }

      // --- 2. Scoring ---
      const elapsed = Date.now() - startMs;
      console.log(`[AutoApprove] ${applicationId} — fraude OK, elapsed=${elapsed}ms, llamando scoring`);
      const scoringTimeoutMs = AUTO_APPROVE_TIMEOUT_MS - elapsed - 5_000; // 5 s de margen

      if (scoringTimeoutMs <= 0) {
        await this.setStatus(applicationId, 'PENDING_REVIEW', {
          reason: 'pre_score_timeout',
        });
        return;
      }

      const scoring = await this.callScoring(applicationId, dto.dni, dto.amount, scoringTimeoutMs);

      const totalElapsed = Date.now() - startMs;
      console.log(`[AutoApprove] ${applicationId} — score=${scoring.score}, totalElapsed=${totalElapsed}ms`);

      // --- 3. Decisión ---
      if (scoring.score >= AUTO_APPROVE_MIN_SCORE && totalElapsed < AUTO_APPROVE_TIMEOUT_MS) {
        await this.setStatus(applicationId, 'AUTO_APPROVED', {
          score: scoring.score,
          modelVersion: scoring.modelVersion,
          elapsedMs: totalElapsed,
          autoApproved: true,
          terms: { amount: dto.amount, termDays: 30, interestRate: 0.025 },
        });
        this.logger.log(
          `${applicationId} AUTO_APROBADA en ${totalElapsed} ms (score=${scoring.score})`,
        );
      } else if (scoring.score < AUTO_APPROVE_MIN_SCORE) {
        await this.setStatus(applicationId, 'REJECTED', {
          reason: 'score_below_threshold',
          score: scoring.score,
        });
        this.logger.log(`${applicationId} rechazada: score=${scoring.score}`);
      } else {
        await this.setStatus(applicationId, 'PENDING_REVIEW', {
          reason: 'auto_approve_timeout',
          elapsedMs: totalElapsed,
        });
      }
    } catch (err) {
      this.logger.error(`Auto-approve fallido para ${applicationId}: ${(err as Error).message}`);
      await this.setStatus(applicationId, 'PENDING_REVIEW', {
        reason: 'auto_approve_error',
        error: (err as Error).message,
      });
    }
  }

  async findById(id: string): Promise<any> {
    console.log(`[LoanApp] consultando solicitud id=${id}`);
    const { rows } = await getPool().query(
      `SELECT * FROM loan_applications WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async setStatus(id: string, status: string, decision: object): Promise<void> {
    await getPool().query(
      `UPDATE loan_applications
       SET status=$1, decision=$2, updated_at=NOW()
       WHERE id=$3`,
      [status, JSON.stringify(decision), id],
    );
  }

  async onCreditApproved(payload: any): Promise<void> {
    const id = payload.applicationId ?? payload.creditId;
    await this.setStatus(id, 'APPROVED', payload);
    this.logger.log(`Crédito aprobado por credit-ledger: ${id}`);
  }

  async onCreditRejected(payload: any): Promise<void> {
    const id = payload.applicationId ?? payload.creditId;
    await this.setStatus(id, 'REJECTED', payload);
    this.logger.log(`Crédito rechazado por credit-ledger: ${id}`);
  }

  // ---- Clientes HTTP internos ----

  private async callFraud(
    applicationId: string,
    dni: string,
  ): Promise<{ passed: boolean; reason?: string }> {
    const url = `${process.env.FRAUD_URL ?? 'http://fraud-detection:8002'}/fraud/check`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, dni }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`fraud-detection respondió ${res.status}`);
    return res.json() as Promise<{ passed: boolean; reason?: string }>;
  }

  private async callScoring(
    applicationId: string,
    dni: string,
    amount: number,
    timeoutMs: number,
  ): Promise<{ score: number; modelVersion?: string }> {
    const url = `${process.env.SCORING_URL ?? 'http://scoring-engine:8001'}/score`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, dni, amount }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`scoring-engine respondió ${res.status}`);
    return res.json() as Promise<{ score: number; modelVersion?: string }>;
  }

  private maskDni(dni: string): string {
    return `${dni.slice(0, 3)}${'*'.repeat(Math.max(0, dni.length - 3))}`;
  }
}
