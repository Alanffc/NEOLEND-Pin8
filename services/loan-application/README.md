# loan-application

**Responsable:** Marvin Mollo  
**Puerto:** 3001  
**Stack:** Node.js + NestJS · PostgreSQL · RabbitMQ

Servicio de solicitud de crédito para la app móvil. El usuario solo necesita
subir su DNI y el monto — sin formularios extensos (**inciso I**, experiencia
< 3 min).

## Flujo de solicitud

```
App móvil
   │  POST /applications { dni, amount, docBase64? }
   ▼
loan-application
   │  1. INSERT en PostgreSQL (status = PENDING)
   │  2. Publica → loan.application.submitted
   │
   │  Si amount ≤ $500:
   │    ├── POST fraud-detection /fraud/check  (timeout 20 s)
   │    │     FALLO → status = REJECTED
   │    │
   │    └── POST scoring-engine /score         (timeout ≤ 65 s)
   │          score ≥ 500 && elapsed < 90 s → AUTO_APPROVED
   │          score < 500                   → REJECTED
   │          timeout                        → PENDING_REVIEW
   │
   │  Si amount > $500: flujo asíncrono vía Event Bus
   │    consume credit.approved → APPROVED
   │    consume credit.rejected → REJECTED
   ▼
Responde: { applicationId, status: "PENDING" }
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/health` | Liveness del servicio |
| `POST` | `/applications` | Crea solicitud de crédito |
| `GET`  | `/applications/:id` | Consulta estado de una solicitud |

### Ejemplo — solicitud de $300 (auto-aprobación)

```bash
curl -X POST http://localhost:3001/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicantId": "550e8400-e29b-41d4-a716-446655440000",
    "dni": "12345678",
    "amount": 300
  }'
# → { "applicationId": "...", "status": "PENDING" }

# Consultar estado (se actualiza en background ≤ 90 s)
curl http://localhost:3001/applications/<applicationId>
# → { ..., "status": "AUTO_APPROVED", "decision": { "score": 720, ... } }
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL |
| `AMQP_URL` | — | RabbitMQ |
| `SCORING_URL` | `http://scoring-engine:8001` | Motor de scoring |
| `FRAUD_URL` | `http://fraud-detection:8002` | Detección de fraude |
| `CREDIT_URL` | `http://credit-ledger:3003` | Ledger de crédito |

## Cómo correr

```bash
npm install && npm run start:dev
```
