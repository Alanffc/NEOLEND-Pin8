import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository, AuditRecord } from './audit.repository';
import { CryptoService } from './crypto.service';

/**
 * Decisión de crédito a auditar. Debe contener TODO lo que la Superintendencia
 * exige para reconstruir el razonamiento del scoring:
 *  - inputs:       variables de entrada (features que alimentaron el modelo)
 *  - modelWeights: pesos del modelo aplicados
 *  - outcome:      decisión final (approved / rejected / escalated) + monto/score
 *  - modelVersion: versión del modelo (trazabilidad del blue/green)
 */
export interface CreditDecision {
  creditId: string;
  applicationId?: string;
  inputs: Record<string, unknown>;
  modelWeights: Record<string, number>;
  outcome: 'approved' | 'rejected' | 'escalated';
  score?: number;
  amount?: number;
  modelVersion?: string;
  source?: string;
  decidedAt?: string;
}

export interface VerificationResult {
  creditId: string;
  records: number;
  intact: boolean;
  brokenAt: number | null;
  reason: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly repo: AuditRepository,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Registra una decisión: la encadena con el último hash, la firma y la guarda.
   * Append-only → el resultado es inmutable y auditable.
   */
  async record(decision: CreditDecision): Promise<AuditRecord> {
    const prevHash = await this.repo.lastHash();
    const hash = this.crypto.hashRecord(prevHash, decision);
    const signature = this.crypto.sign(hash);

    const saved = await this.repo.append({
      creditId: decision.creditId,
      decision,
      prevHash,
      hash,
      signature,
    });
    this.logger.log(`Decisión auditada crédito=${decision.creditId} hash=${hash.slice(0, 12)}…`);
    return saved;
  }

  async getTrail(creditId: string): Promise<AuditRecord[]> {
    return this.repo.byCreditId(creditId);
  }

  /**
   * Verifica la integridad de la traza de un crédito:
   *  1) recalcula el hash de cada registro (detecta manipulación del contenido),
   *  2) comprueba que prev_hash encadena con el hash anterior,
   *  3) valida la firma digital de cada registro.
   * Si algo falla, indica el registro exacto donde se rompió la cadena.
   */
  async verify(creditId: string): Promise<VerificationResult> {
    const records = await this.repo.byCreditId(creditId);
    if (records.length === 0) {
      return { creditId, records: 0, intact: true, brokenAt: null, reason: 'sin registros' };
    }

    for (const rec of records) {
      const recomputed = this.crypto.hashRecord(rec.prevHash, rec.decision);
      if (recomputed !== rec.hash) {
        return this.broken(creditId, records.length, rec.id, 'contenido alterado (hash no coincide)');
      }
      if (!this.crypto.verifySignature(rec.hash, rec.signature)) {
        return this.broken(creditId, records.length, rec.id, 'firma digital inválida');
      }
    }
    return { creditId, records: records.length, intact: true, brokenAt: null, reason: null };
  }

  getPublicKey(): string {
    return this.crypto.getPublicKeyPem();
  }

  private broken(creditId: string, total: number, id: number, reason: string): VerificationResult {
    return { creditId, records: total, intact: false, brokenAt: id, reason };
  }
}
