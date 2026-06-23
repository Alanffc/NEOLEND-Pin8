# Estrategia de Circuit Breaker — bureau-adapter

**Responsable:** Marvin Mollo  
**Servicio:** `bureau-adapter` (puerto 3002)  
**Contexto:** El buró de crédito SOAP legacy tiene latencia de 8-15 s y una tasa
máxima de 10 req/s. Una falla en cascada sin protección bloquearía scoring,
loan-application y el pipeline completo de crédito.

---

## Diagrama de estados

```
                         ┌─────────────────────────────────────┐
                         │                                     │
             onSuccess() │                                     │ (probe ok)
                         ▼                                     │
           ┌─────────────────────────┐         ┌──────────────────────────┐
           │                         │         │                          │
           │         CLOSED          │         │        HALF_OPEN         │
           │  (operación normal)     │         │  (un probe de prueba)    │
           │                         │         │                          │
           └──────────┬──────────────┘         └──────┬───────────────────┘
                      │                               │
        fallo ≥ N     │                               │ probe falla
        (threshold)   │                               │
                      ▼                               ▼
           ┌─────────────────────────────────────────────────────┐
           │                                                     │
           │                      OPEN                           │
           │        (rechaza todas las llamadas al buró)         │
           │                                                     │
           └──────────────────────────────────────────────────────
                                    │
                    resetAfterMs    │
                    transcurrido    │
                                    ▼
                              HALF_OPEN
```

---

## Transiciones y condiciones

| Desde | Hacia | Condición |
|-------|-------|-----------|
| CLOSED | OPEN | `failureCount >= CB_FAILURE_THRESHOLD` (default: 5) |
| OPEN | HALF_OPEN | Han pasado `CB_RESET_MS` ms desde el último fallo (default: 30 s) |
| HALF_OPEN | CLOSED | El probe (1 llamada) responde correctamente |
| HALF_OPEN | OPEN | El probe falla o supera `CB_TIMEOUT_MS` |

---

## Rate Limiter (ventana deslizante)

```
Tiempo (ms)  ──────────────────────────────────▶
             │  req req req ... req │ ← ventana 1 000 ms
             │  (máx 10 dentro)    │
                  ↑ si se supera → Error 429 inmediato
```

El rate limiter opera **antes** del circuit breaker. Garantiza que el buró
nunca reciba más de 10 req/s independientemente del estado del circuito.

---

## Caché inteligente (fallback)

```
Llamada al buró
      │
      ├── CLOSED / HALF_OPEN ──▶ callSoapBureau(dni)
      │                               │
      │                      ┌────────┴─────────┐
      │                    OK │                 │ Error / Timeout
      │                       ▼                 ▼
      │              cache.set(dni, report)   onFailure()
      │              return { source:'live' }     │
      │                                    (circuit puede pasar a OPEN)
      │
      ├── OPEN ──▶ Error "CircuitBreaker:OPEN"
      │                  │
      │           cache.get(dni)
      │                  │
      │         ┌────────┴──────────────┐
      │      hit │                      │ miss
      │          ▼                      ▼
      │   { source:'cache' }    { source:'fallback',
      │   (datos previos TTL     score:0, debtLevel:'HIGH' }
      │    24 h, sirve al        (bloquea auto-aprobación)
      │    scoring)
      │
      └── HALF_OPEN ──▶ (solo 1 probe simultáneo; los demás → cache)
```

### TTL de caché

| Escenario | TTL | Justificación |
|-----------|-----|---------------|
| Reporte fresco del buró | 24 h | El historial crediticio no cambia intra-día |
| Buró caído | Dato existente | Usar último reporte conocido para no paralizar el negocio |
| Sin dato previo | — | Retornar score=0 para bloquear aprobación automática |

---

## Variables de configuración (docker-compose / .env)

| Variable | Default | Efecto |
|----------|---------|--------|
| `CB_FAILURE_THRESHOLD` | `5` | Fallos consecutivos para abrir el circuito |
| `CB_TIMEOUT_MS` | `5000` | Timeout por llamada SOAP (ms) |
| `CB_RESET_MS` | `30000` | Tiempo en OPEN antes de intentar HALF_OPEN |
| `REDIS_URL` | `redis://redis:6379` | Instancia Redis para caché |

---

## Endpoint de observabilidad

```bash
GET /circuit/status
```

```json
{
  "state": "OPEN",
  "failureCount": 7,
  "failureThreshold": 5,
  "lastFailureAt": "2026-06-23T14:32:10.000Z",
  "resetsAt": "2026-06-23T14:32:40.000Z"
}
```

---

## Secuencia de ejemplo bajo falla del buró

```
scoring-engine          bureau-adapter            Buró SOAP legacy
      │                       │                         │
      │  GET /bureau/12345678 │                         │
      │──────────────────────▶│                         │
      │                       │── callSoapBureau() ────▶│ (timeout 5 s)
      │                       │◀──────── error ─────────│
      │                       │  failureCount=1          │
      │                       │                          │
      │  GET /bureau/87654321 │                         │
      │──────────────────────▶│                         │
      │                       │── callSoapBureau() ────▶│ (timeout 5 s)
      │                       │◀──────── error ─────────│
      │                       │  failureCount=5 → OPEN   │
      │                       │                          │
      │  GET /bureau/11111111 │                         │
      │──────────────────────▶│                         │
      │                       │  [CircuitBreaker:OPEN]   │
      │                       │  cache.get("11111111") ──┐
      │                       │◀── hit: cached report  ──┘
      │◀── { source:'cache' } │
      │                       │
      │  (30 s después)        │                         │
      │  GET /bureau/12345678 │                         │
      │──────────────────────▶│                         │
      │                       │  [HALF_OPEN] probe      │
      │                       │── callSoapBureau() ─────▶│
      │                       │◀──────── OK ────────────│
      │                       │  → CLOSED               │
      │◀── { source:'live' }  │
```
