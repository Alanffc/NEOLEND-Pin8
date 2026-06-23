# 🧠 scoring-engine

**Responsable:** Alan Flores
**Puerto:** 8001
**Stack:** Python + FastAPI · PostgreSQL · Scikit-Learn · SHAP

Motor de score crediticio con fuentes alternativas, **SHAP** explicable, **blue/green del modelo ML** sin downtime, y auditoría de sesgo.

## ⚙️ Scoring Pipeline Flowchart

```mermaid
graph TD
    A[POST /api/v1/score] --> B{Concurrently Gather Data}
    B -->|Async fetch| C1[bureau-adapter]
    B -->|Async fetch| C2[Public Services]
    B -->|Async fetch| C3[E-commerce API]
    B -->|Async fetch| C4[Wallet/Telecoms]
    
    C1 & C2 & C3 & C4 -->|asyncio.gather| D[Assemble Input Features]
    D --> E[Run Model Inference]
    E --> F[Calculate SHAP Explanations]
    F --> G[Record Scoring Log in Database]
    G --> H[Return Explainable Score Response]
```

## 🚀 Cómo correr

```bash
pip install -r requirements.txt && uvicorn app.main:app --reload --port 8001
```

## 🟩🟦 Estrategia Blue/Green Deployment

Para realizar la actualización de modelos de ML sin experimentar downtime (Zero-Downtime), implementamos un patrón **Blue/Green Deployment** orquestando dos instancias de la aplicación detrás de un balanceador de carga / API Gateway (por ejemplo, Nginx o Traefik).

### Arquitectura de Despliegue de Modelos

```
                   ┌──────────────┐
                   │ API Gateway  │ (Nginx / Traefik)
                   └──────┬───────┘
                          │ (Routes traffic to active color)
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│ scoring-engine-blue  │    │ scoring-engine-green │
│ (Model: v1 - Active) │    │ (Model: v2 - Idle)   │
└──────────────────────┘    └──────────────────────┘
```

### Configuración docker-compose.yml (Snippet)

```yaml
services:
  # Instancia Blue (Modelo Activo v1)
  scoring-engine-blue:
    build: ./services/scoring-engine
    container_name: scoring-engine-blue
    environment:
      - DATABASE_URL=postgres://neolend:neolend@db-scoring:5432/scoring
      - MODEL_COLOR=blue
    depends_on:
      - db-scoring

  # Instancia Green (Modelo Nuevo v2)
  scoring-engine-green:
    build: ./services/scoring-engine
    container_name: scoring-engine-green
    environment:
      - DATABASE_URL=postgres://neolend:neolend@db-scoring:5432/scoring
      - MODEL_COLOR=green
    depends_on:
      - db-scoring

  # Balanceador Nginx para redirigir tráfico
  nginx-load-balancer:
    image: nginx:alpine
    ports:
      - "8001:8001"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### Procedimiento de Actualización sin Downtime:
1. **Desplegar Green**: Se levanta la instancia `scoring-engine-green` con el nuevo modelo e independientes variables de entorno.
2. **Validación**: Se corren pruebas de humo directamente sobre el puerto interno de la instancia Green.
3. **Cambiar Enrutamiento**: Se reconfigura el balanceador de carga Nginx apuntando al contenedor Green.
4. **Recarga de Nginx**: Se ejecuta `nginx -s reload` que redirige las nuevas conexiones sin interrumpir las peticiones en curso (Zero-Downtime).
5. **Apagado / Respaldos**: Se puede apagar la versión Blue o mantenerla como fallback de emergencia para un rollback instantáneo.
