import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuditService, CreditDecision } from './audit.service';

/**
 * API de auditoría (MVP 4 — trazabilidad para la Superintendencia).
 *
 *  POST /audit/record         registra una decisión de crédito (firmada + encadenada)
 *  GET  /audit/:creditId      traza completa de un crédito (para el regulador)
 *  GET  /audit/verify/:id     verifica integridad de hashes + firmas
 *  GET  /audit/public-key     clave pública para verificar firmas externamente
 *  GET  /health
 */
@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'audit-trail' };
  }

  @Post('audit/record')
  async record(@Body() decision: CreditDecision) {
    const rec = await this.audit.record(decision);
    return {
      id: rec.id,
      creditId: rec.creditId,
      hash: rec.hash,
      prevHash: rec.prevHash,
      signature: rec.signature,
      createdAt: rec.createdAt,
    };
  }

  @Get('audit/verify/:creditId')
  verify(@Param('creditId') creditId: string) {
    return this.audit.verify(creditId);
  }

  @Get('audit/public-key')
  publicKey() {
    return { algorithm: 'RSA-SHA256', publicKeyPem: this.audit.getPublicKey() };
  }

  @Get('audit/:creditId')
  async trail(@Param('creditId') creditId: string) {
    const records = await this.audit.getTrail(creditId);
    return { creditId, count: records.length, records };
  }
}
