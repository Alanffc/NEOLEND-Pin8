# bureau-adapter

**Responsable:** Marvin Mollo  
**Puerto:** 3002  
**Stack:** Node.js + NestJS · Redis (caché)

Adaptador al buró de crédito SOAP legacy con **Circuit Breaker** de 3 estados
y **caché inteligente** en Redis.

## Estrategia de resiliencia

```
Solicitud entrante
       │
  ┌────▼────────────────────────────────────────────────────┐
  │  Rate Limiter (max 10 req/s — ventana deslizante 1 s)  │
  └────┬────────────────────────────────────────────────────┘
       │
  ┌────▼────────────────────────┐
  │  CircuitBreaker.getState()  │
  └────┬────────────────────────┘
       │
       ├─── CLOSED / HALF_OPEN ──▶ llama al buró SOAP (timeout 5 s)
       │                                 │
       │                          ┌──────┴────────┐
       │                        OK │              │ Error / Timeout
       │                          ▼              ▼
       │                    onSuccess()      onFailure()
       │                          │              │
       │                   (HALF_OPEN          contador++
       │                    → CLOSED)       ≥ threshold? → OPEN
       │
       └─── OPEN ──▶ lanza error "CircuitBreaker:OPEN"
                           │
                    ┌──────▼───────────────────────────┐
                    │  Caché Redis (TTL 24 h)           │
                    │  ¿hay dato cacheado? → servir     │
                    │  No hay dato       → fallback duro │
                    └──────────────────────────────────┘
```

Ver [docs/circuit-breaker-strategy.md](../../docs/circuit-breaker-strategy.md)
para el diagrama completo con transiciones de estado.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servicio + circuit breaker |
| `GET` | `/bureau/:dni` | Reporte de buró (live → cache → fallback) |
| `DELETE` | `/bureau/:dni/cache` | Invalida caché de un DNI |
| `GET` | `/circuit/status` | Estado detallado del circuit breaker |

### Ejemplo

```bash
# Consultar buró
curl http://localhost:3002/bureau/12345678

# Ver estado del circuito
curl http://localhost:3002/circuit/status

# Invalidar caché
curl -X DELETE http://localhost:3002/bureau/12345678/cache
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3002` | Puerto del servicio |
| `REDIS_URL` | `redis://localhost:6379` | Redis para caché |
| `BUREAU_SOAP_URL` | `http://bureau-soap-mock:9000/ws` | Endpoint SOAP legacy |
| `CB_FAILURE_THRESHOLD` | `5` | Fallos para abrir el circuito |
| `CB_TIMEOUT_MS` | `5000` | Timeout por llamada al buró |
| `CB_RESET_MS` | `30000` | Tiempo en OPEN antes de pasar a HALF_OPEN |

## Cómo correr

```bash
npm install && npm run start:dev
```
