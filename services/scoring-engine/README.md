# scoring-engine

**Responsable:** Alan Flores
**Puerto:** 8001
**Stack:** Python + FastAPI · PostgreSQL

Motor de score crediticio con fuentes alternativas. **SHAP** explicable, **blue/green del modelo ML** sin downtime, auditoría de sesgo.

## Endpoints (TODO)
- `GET /health`

## Cómo correr
```bash
pip install -r requirements.txt && uvicorn app.main:app --reload --port 8001
```

> Esqueleto generado. Implementar la lógica en `app/`.
