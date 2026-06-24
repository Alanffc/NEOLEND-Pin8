# Evidencias — MVP 4: Trazabilidad Auditada con Firma Digital (100%)

**Responsable:** Juan José Cordeiro
**Servicios:** `credit-ledger` (CQRS + Event Sourcing) + `audit-trail` (firma digital)
**Verificado:** sistema levantado con Docker Compose (PostgreSQL + RabbitMQ reales).

> Reemplazar los bloques de salida por **capturas de pantalla** de la terminal /
> Postman al armar el documento entregable.

---

## 1. Servicios arriba (Docker Compose)

```
neolend-credit-ledger-1   Up   (CQRS+ES, :3003)
neolend-audit-trail-1     Up   (firma digital, :3008)
neolend-db-credit-1       Up (healthy)   ← Event Store
neolend-db-audit-1        Up (healthy)   ← audit_log append-only
neolend-rabbitmq-1        Up (healthy)   ← Event Bus
```

Logs de arranque:
```
[EventStore]  Event Store listo (tabla events append-only)
[EventBus]    Conectado al Event Bus
[AuditRepository] audit_log listo (append-only)
[EventConsumer]   Consumiendo decisiones de crédito desde el Event Bus
```

## 2. Decisión de crédito → eventos (Event Sourcing)

`POST /credits/decide` (monto 450, score 712, sin fraude):
```json
{ "creditId": "C-9001", "status": "APPROVED",
  "events": ["CreditRequested", "CreditApproved"] }
```

`GET /credits/C-9001/events` — stream inmutable con variables de entrada y pesos
del modelo (versión, `bureau_score`, etc.). El estado NO se guarda mutable: se
deriva de los eventos.

Reglas verificadas (inciso III):
| Caso | Resultado |
|---|---|
| monto 450, score 712, sin fraude | `APPROVED` (automático) |
| monto 2000 > 500 | `ESCALATED` (revisión manual) |
| fraude detectado | `REJECTED` |
| score < 600 | `REJECTED` |

## 3. Auditoría firmada (para la Superintendencia)

`GET /audit/C-9001` devuelve, por cada decisión:
- `decision`: **variables de entrada + pesos del modelo + decisión final**
- `prevHash` → `hash` (cadena SHA-256 encadenada)
- `signature`: **firma digital RSA-SHA256**

`GET /audit/public-key`:
```
algoritmo: RSA-SHA256
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
```

## 4. Verificación de integridad

`GET /audit/verify/C-9001`:
```json
{ "creditId": "C-9001", "records": 1, "intact": true, "brokenAt": null, "reason": null }
```

## 5. ⭐ Prueba de inmutabilidad (evidencia clave)

Intento de manipular la traza directamente en la base de datos:

```sql
UPDATE audit_log SET decision = jsonb_set(decision,'{amount}','5000') WHERE credit_id='C-9001';
-- ERROR:  audit_log es append-only: UPDATE no permitido

DELETE FROM audit_log WHERE credit_id='C-9001';
-- ERROR:  audit_log es append-only: DELETE no permitido
```

**Ni con acceso directo a la BD se puede alterar o borrar una decisión.** La
inmutabilidad está garantizada a nivel del motor de PostgreSQL (trigger), además
de la cadena de hashes y la firma digital. Esto cumple el inciso b) del Contexto
Adicional: trazabilidad completa, firmada e inmutable, auditable por 10 años.
