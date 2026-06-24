# fraud-detection — FastAPI app. Servicio de detección de fraude biométrico
# en tiempo real (inciso VII). Data residency: el modelo corre LOCAL (on-prem).
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException

from .biometric import LocalBiometricEngine
from .config import settings
from .db import FraudRepository
from .events import build_envelope, get_bus
from .fraud_service import LOAN_SUBMITTED, FraudService
from .models import (
    EnrollRequest,
    EnrollResponse,
    FraudCheckRequest,
    FraudCheckResponse,
)
from .stolen_db import StolenIdentityRepository

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("fraud.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.enforce_residency()  # falla rápido si se viola data residency

    engine = LocalBiometricEngine()
    engine.load_model()
    stolen = StolenIdentityRepository(engine)

    repo = FraudRepository()
    repo.init()

    bus = get_bus()
    await bus.connect()

    service = FraudService(engine, stolen, repo, bus)
    bus.on(LOAN_SUBMITTED, service.handle_loan_submitted)
    await bus.start_consuming()

    app.state.service = service
    app.state.repo = repo
    app.state.stolen = stolen
    app.state.bus = bus
    log.info(
        "fraud-detection listo | residency=%s | db=%s | bus=%s",
        settings.data_residency, repo.backend,
        "rabbitmq" if settings.use_real_bus else "mock",
    )
    try:
        yield
    finally:
        await bus.close()
        repo.close()


app = FastAPI(title="fraud-detection", lifespan=lifespan)


def _service(app: FastAPI) -> FraudService:
    return app.state.service


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "fraud-detection"}


@app.post("/fraud/check", response_model=FraudCheckResponse)
async def fraud_check(
    req: FraudCheckRequest,
    x_correlation_id: str | None = Header(default=None),
) -> FraudCheckResponse:
    return await _service(app).check(req, correlation_id=x_correlation_id)


@app.post("/fraud/enroll", response_model=EnrollResponse)
async def fraud_enroll(req: EnrollRequest) -> EnrollResponse:
    dim = _service(app).enroll(req.applicantId, req.docId, req.biometric)
    return EnrollResponse(applicantId=req.applicantId, enrolled=True, templateDim=dim)


@app.get("/fraud/checks/{application_id}", response_model=FraudCheckResponse)
async def get_check(application_id: str) -> FraudCheckResponse:
    rec = app.state.repo.get_check(application_id)
    if not rec:
        raise HTTPException(status_code=404, detail="check no encontrado")
    return _service(app)._response_from_record(rec, replay=True)


@app.get("/fraud/stats")
def stats() -> dict[str, Any]:
    return {
        "service": "fraud-detection",
        "residency": settings.data_residency,
        "db_backend": app.state.repo.backend,
        "bus": "rabbitmq" if settings.use_real_bus else "mock",
        "stolen_dataset_size": app.state.stolen.count(),
        "checks_total": app.state.repo.count_checks(),
    }


# --- Utilidad de prueba: simula el consumo de loan.application.submitted ----
# Permite ejercitar el flujo de eventos sin RabbitMQ (mock de lo que no existe).
@app.post("/fraud/_simulate/loan-submitted")
async def simulate_loan_submitted(
    payload: dict[str, Any],
    x_correlation_id: str | None = Header(default=None),
) -> dict[str, Any]:
    application_id = payload.get("applicationId", "unknown")
    envelope = build_envelope(
        event_type=LOAN_SUBMITTED,
        aggregate_id=application_id,
        payload=payload,
        correlation_id=x_correlation_id,
    )
    await _service(app).handle_loan_submitted(envelope)
    return {"processed": True, "check": app.state.repo.get_check(application_id)}
