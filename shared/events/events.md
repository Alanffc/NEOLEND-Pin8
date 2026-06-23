# Contrato de Eventos — NeoLend Event Bus

Todos los servicios publican/consumen estos eventos en RabbitMQ (exchange `neolend.events`,
tipo `topic`). Son también los eventos de dominio del Event Sourcing en `credit-ledger`.

## Envelope común

```json
{
  "eventId": "uuid",
  "eventType": "credit.application.submitted",
  "aggregateId": "uuid",
  "aggregateType": "CreditApplication",
  "version": 1,
  "occurredAt": "ISO-8601",
  "producer": "loan-application",
  "payload": { },
  "metadata": { "correlationId": "uuid", "causationId": "uuid" }
}
```

## Catálogo de eventos (routing key)

| Routing key | Producer | Consumers | Payload clave |
|---|---|---|---|
| `loan.application.submitted` | loan-application | scoring, fraud, audit | applicantId, docId, amount |
| `fraud.check.passed` / `fraud.check.failed` | fraud-detection | loan, audit | applicationId, score |
| `scoring.completed` | scoring-engine | credit-ledger, audit | applicationId, score, shap, modelVersion |
| `credit.approved` | credit-ledger | disbursement, investor, audit | creditId, amount, terms |
| `credit.rejected` | credit-ledger | loan, audit | creditId, reason |
| `credit.escalated` | credit-ledger | (analista), audit | creditId, evidence |
| `disbursement.completed` | disbursement | credit-ledger, collections, investor | creditId, channel |
| `payment.received` | collections | credit-ledger, investor, gamification | creditId, amount |
| `payment.overdue` | collections | credit-ledger, investor | creditId, daysLate |
| `course.completed` | gamification | scoring, credit-ledger | userId, scoreBonus |
| `decision.recorded` | audit-trail | (regulador) | creditId, signature, hashChain |

## Reglas

- **Idempotencia**: consumers deduplican por `eventId`.
- **Trazabilidad**: `correlationId` viaja en toda la cadena de la solicitud (auditoría MVP4).
- **Inmutabilidad**: `audit-trail` solo hace `INSERT` (append-only, retención 10 años).
