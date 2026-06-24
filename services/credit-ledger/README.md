# credit-ledger — Servicio de Créditos (CQRS + Event Sourcing)

**Responsable:** Juan José Cordeiro
**Puerto:** 3003
**Stack:** Node.js + NestJS · PostgreSQL (Event Store) · RabbitMQ

Núcleo del dominio de crédito. Es el **sistema de registro autoritativo** de las
decisiones: no guarda un estado mutable, sino la **secuencia inmutable de
eventos** de la que se deriva el estado (Event Sourcing). Esto da la
trazabilidad regulatoria y alimenta al `audit-trail` (MVP 4).

## CQRS

- **Command** (`POST /credits/decide`, `/disburse`, `/payment`): rehidrata el
  agregado desde el Event Store, valida invariantes y **anexa eventos nuevos**.
- **Query** (`GET /credits/:id`, `/events`): reconstruye el estado proyectando
  los eventos. Read y write quedan separados.

## Event Sourcing

- Tabla `events` **append-only** con `UNIQUE(aggregate_id, version)` →
  **concurrencia optimista** (un segundo comando sobre la misma versión → 409).
- Eventos de dominio: `CreditRequested`, `CreditApproved`, `CreditRejected`,
  `CreditEscalated`, `DisbursementCompleted`, `PaymentReceived`.

## Reglas de decisión (inciso III)

| Condición | Resultado |
|---|---|
| Fraude detectado | `CreditRejected` |
| score < 600 | `CreditRejected` |
| monto > USD 500 | `CreditEscalated` (revisión manual con evidencia) |
| resto | `CreditApproved` (automático) |

Cada decisión se publica al Event Bus y se envía al `audit-trail` para su
**firma digital**.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/credits/decide` | Decide una solicitud. Body: `{applicationId, applicantId, amount, score, fraudPassed, modelVersion, modelWeights, inputs}` |
| `POST` | `/credits/:id/disburse` | Registra desembolso `{channel, reference}` |
| `POST` | `/credits/:id/payment` | Registra pago `{amount}` |
| `GET` | `/credits/:id` | Estado actual (proyección) |
| `GET` | `/credits/:id/events` | **Trazabilidad**: stream completo de eventos |
| `GET` | `/health` | Healthcheck |

## Demo (evidencia para el entregable)

```bash
# Aprobación automática (monto <= 500, score >= 600, sin fraude)
curl -X POST localhost:3003/credits/decide -H 'Content-Type: application/json' -d '{
  "applicationId":"C-1","applicantId":"U-9","amount":450,"score":712,
  "fraudPassed":true,"modelVersion":"v3-blue",
  "modelWeights":{"bureau_score":0.4},"inputs":{"bureau_score":640}
}'

# Ver el stream de eventos (Event Sourcing)
curl localhost:3003/credits/C-1/events

# Ver el estado proyectado (CQRS query)
curl localhost:3003/credits/C-1
```

## Cómo correr

```bash
npm install
npm run start:dev
```
