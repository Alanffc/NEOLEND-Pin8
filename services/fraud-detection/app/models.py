# fraud-detection — schemas Pydantic (request/response) y envelope de eventos.
# El envelope replica shared/events/events.md (mismo formato para todos los servicios).
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Biometría
# ---------------------------------------------------------------------------
class BiometricSample(BaseModel):
    """Muestra biométrica. Por data residency NO se transporta ni almacena la
    imagen cruda: solo el *embedding* (template) calculado en el dispositivo /
    on-prem. `embedding` es opcional; si falta se deriva de forma determinista
    a partir del docId/applicantId (modo mock para demo sin captura real)."""

    modality: Literal["face", "fingerprint"] = "face"
    embedding: list[float] | None = None
    liveness_score: float | None = Field(default=None, ge=0.0, le=1.0)
    device_id: str | None = None
    captured_at: datetime | None = None


# ---------------------------------------------------------------------------
# Fraud check (REST tiempo real)
# ---------------------------------------------------------------------------
class FraudCheckRequest(BaseModel):
    applicationId: str
    applicantId: str
    docId: str
    amount: float | None = None
    biometric: BiometricSample | None = None
    correlationId: str | None = None


class FraudSignal(BaseModel):
    name: str
    value: float
    weight: float
    detail: str = ""


class FraudCheckResponse(BaseModel):
    applicationId: str
    applicantId: str
    decision: Literal["passed", "failed"]
    score: float  # 0..1 — mayor = mayor riesgo de fraude
    reasons: list[str] = []
    signals: list[FraudSignal] = []
    residency: str = "on-prem"
    checkedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    emittedEvent: str | None = None  # routing key publicado
    idempotentReplay: bool = False


# ---------------------------------------------------------------------------
# Enrolamiento del template de referencia
# ---------------------------------------------------------------------------
class EnrollRequest(BaseModel):
    applicantId: str
    docId: str
    biometric: BiometricSample


class EnrollResponse(BaseModel):
    applicantId: str
    enrolled: bool
    templateDim: int


# ---------------------------------------------------------------------------
# Envelope de eventos (contrato común)
# ---------------------------------------------------------------------------
class EventMetadata(BaseModel):
    correlationId: str | None = None
    causationId: str | None = None


class EventEnvelope(BaseModel):
    eventId: str
    eventType: str
    aggregateId: str
    aggregateType: str = "CreditApplication"
    version: int = 1
    occurredAt: str
    producer: str
    payload: dict[str, Any] = {}
    metadata: EventMetadata = EventMetadata()
