# audit-trail — Trazabilidad Auditada (MVP 4 · 100%)

**Responsable:** Juan José Cordeiro
**Puerto:** 3008
**Stack:** Node.js + NestJS · PostgreSQL · RabbitMQ

Implementa el **Inciso b) del Contexto Adicional**: la Superintendencia exige
acceso a la **trazabilidad completa** del proceso de scoring —variables de
entrada, pesos del modelo y decisión final— con **firmas digitales del sistema**
y logs **inmutables** auditables por **10 años**.

## Garantías criptográficas

1. **Cadena de hashes (blockchain-like).** Cada registro encadena `prev_hash → hash`
   (SHA-256). Alterar un registro pasado invalida todos los posteriores → la
   manipulación es detectable.
2. **Firma digital RSA-SHA256.** Cada decisión se firma con la clave privada del
   sistema. El regulador verifica con la clave pública (`GET /audit/public-key`).
3. **Append-only.** La tabla `audit_log` solo acepta `INSERT`; un trigger de
   PostgreSQL bloquea `UPDATE`/`DELETE`. Retención conceptual de 10 años.

## Qué se audita (campo `decision`)

```jsonc
{
  "creditId": "C-123",
  "inputs":       { "bureau_score": 640, "utility_payments": 0.9, ... }, // variables de entrada
  "modelWeights": { "bureau_score": 0.4, "utility_payments": 0.2, ... }, // pesos del modelo
  "outcome": "approved",        // decisión final
  "score": 712,
  "amount": 450,
  "modelVersion": "v3-blue"
}
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/audit/record` | Registra una decisión (la firma y encadena). La usa `credit-ledger`. |
| `GET` | `/audit/:creditId` | Traza completa de un crédito (para el regulador). |
| `GET` | `/audit/verify/:creditId` | Verifica integridad de hashes + firmas. Reporta dónde se rompió la cadena. |
| `GET` | `/audit/public-key` | Clave pública para verificar firmas externamente. |
| `GET` | `/health` | Healthcheck. |

También **consume del Event Bus** (`credit.approved/rejected/escalated`) para
auditar automáticamente, además del camino HTTP directo.

## Cómo correr

```bash
npm install
npm run start:dev
```

### Demo rápida (evidencia para el entregable)

```bash
# 1) Registrar una decisión
curl -X POST localhost:3008/audit/record -H 'Content-Type: application/json' -d '{
  "creditId":"C-123",
  "inputs":{"bureau_score":640,"utility_payments":0.9},
  "modelWeights":{"bureau_score":0.4,"utility_payments":0.2},
  "outcome":"approved","score":712,"amount":450,"modelVersion":"v3-blue"
}'

# 2) Ver la traza firmada
curl localhost:3008/audit/C-123

# 3) Verificar integridad de la cadena (debe devolver intact:true)
curl localhost:3008/audit/verify/C-123
```

> Para la evidencia del MVP: capturar (2) mostrando `hash`/`signature` y (3)
> mostrando `"intact": true`. Demuestra trazabilidad firmada e inmutable.
