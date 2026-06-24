# fraud-detection — orquestación de la decisión de fraude.
#
# Combina señales biométricas locales + reglas + match contra el dataset local
# de identidades robadas, produce un score 0..1 y publica el evento de dominio
# (fraud.check.passed / fraud.check.failed) según shared/events/events.md.
from __future__ import annotations

import logging

from .biometric import LocalBiometricEngine
from .config import settings
from .db import FraudRepository
from .events import EventBus, build_envelope
from .models import (
    BiometricSample,
    FraudCheckRequest,
    FraudCheckResponse,
    FraudSignal,
)
from .stolen_db import StolenIdentityRepository

log = logging.getLogger("fraud.service")

PASSED = "fraud.check.passed"
FAILED = "fraud.check.failed"
LOAN_SUBMITTED = "loan.application.submitted"


class FraudService:
    def __init__(
        self,
        engine: LocalBiometricEngine,
        stolen: StolenIdentityRepository,
        repo: FraudRepository,
        bus: EventBus,
    ) -> None:
        self.engine = engine
        self.stolen = stolen
        self.repo = repo
        self.bus = bus

    # -- enrolamiento ------------------------------------------------------
    def enroll(self, applicant_id: str, doc_id: str, sample: BiometricSample) -> int:
        template = self.engine.resolve_embedding(sample, seed=applicant_id)
        self.repo.enroll(applicant_id, doc_id, template)
        return len(template)

    # -- check en tiempo real ---------------------------------------------
    async def check(
        self, req: FraudCheckRequest, correlation_id: str | None = None
    ) -> FraudCheckResponse:
        correlation_id = correlation_id or req.correlationId

        # Idempotencia por applicationId: si ya se evaluó, se devuelve igual
        # (no se re-emite el evento).
        existing = self.repo.get_check(req.applicationId)
        if existing:
            return self._response_from_record(existing, replay=True)

        signals: list[FraudSignal] = []
        reasons: list[str] = []
        score = 0.0

        seed = req.docId or req.applicantId
        probe = self.engine.resolve_embedding(req.biometric, seed=seed)

        # 1) Prueba de vida (anti-spoofing / deepfake).
        liveness = self.engine.liveness(req.biometric, seed)
        if liveness < settings.liveness_threshold:
            score += 0.5
            reasons.append(f"liveness baja ({liveness:.2f})")
        signals.append(
            FraudSignal(name="liveness", value=liveness, weight=0.5,
                        detail=f"umbral={settings.liveness_threshold}")
        )

        # 2) Documento en lista de robados (match exacto por hash) -> hard fail.
        stolen_doc = self.stolen.match_doc(req.docId)
        if stolen_doc:
            score = 1.0
            reasons.append(f"documento en lista de robados: {stolen_doc.reason}")
        signals.append(
            FraudSignal(name="stolen_doc", value=1.0 if stolen_doc else 0.0,
                        weight=1.0, detail=stolen_doc.alias if stolen_doc else "")
        )

        # 3) Biometría contra dataset local de robados.
        stolen_bio = self.stolen.match_biometric(probe, settings.stolen_match_threshold)
        if stolen_bio:
            score = max(score, max(stolen_bio.similarity, 0.9))
            reasons.append(
                f"biometría coincide con identidad robada ({stolen_bio.similarity:.2f})"
            )
        signals.append(
            FraudSignal(name="stolen_biometric",
                        value=stolen_bio.similarity if stolen_bio else 0.0,
                        weight=1.0,
                        detail=f"umbral={settings.stolen_match_threshold}")
        )

        # 4) Coincidencia con template enrolado del propio solicitante.
        enrolled = self.repo.get_enrolled(req.applicantId)
        if enrolled is not None:
            sim = self.engine.match(probe, enrolled)
            if sim < settings.face_match_threshold:
                score += 0.4
                reasons.append(f"biometría no coincide con el titular ({sim:.2f})")
            signals.append(
                FraudSignal(name="template_match", value=sim, weight=0.4,
                            detail=f"umbral={settings.face_match_threshold}")
            )

        # 5) Velocidad: demasiados intentos del mismo solicitante.
        recent = self.repo.count_recent_checks(req.applicantId)
        if recent >= settings.velocity_max_checks:
            score += 0.2
            reasons.append(f"velocidad alta ({recent} intentos)")
        signals.append(
            FraudSignal(name="velocity", value=float(recent),
                        weight=0.2, detail=f"max={settings.velocity_max_checks}")
        )

        score = max(0.0, min(1.0, score))
        decision = "failed" if score >= settings.fraud_score_threshold else "passed"
        if decision == "passed" and not reasons:
            reasons.append("sin señales de fraude")

        record = {
            "application_id": req.applicationId,
            "applicant_id": req.applicantId,
            "decision": decision,
            "score": score,
            "reasons": reasons,
            "signals": [s.model_dump() for s in signals],
            "correlation_id": correlation_id,
        }
        self.repo.save_check(record)

        routing_key = PASSED if decision == "passed" else FAILED
        await self._emit(routing_key, req, score, decision, reasons, correlation_id)

        return FraudCheckResponse(
            applicationId=req.applicationId,
            applicantId=req.applicantId,
            decision=decision,
            score=score,
            reasons=reasons,
            signals=signals,
            residency=settings.data_residency,
            emittedEvent=routing_key,
        )

    # -- consumidor de loan.application.submitted -------------------------
    async def handle_loan_submitted(self, envelope) -> None:
        # Idempotencia por eventId (regla del contrato).
        if self.repo.is_event_processed(envelope.eventId):
            log.info("evento %s ya procesado, se omite", envelope.eventId)
            return

        payload = envelope.payload or {}
        application_id = payload.get("applicationId") or envelope.aggregateId
        bio_raw = payload.get("biometric")
        sample = BiometricSample(**bio_raw) if isinstance(bio_raw, dict) else None

        req = FraudCheckRequest(
            applicationId=application_id,
            applicantId=payload.get("applicantId", application_id),
            docId=payload.get("docId", ""),
            amount=payload.get("amount"),
            biometric=sample,
            correlationId=envelope.metadata.correlationId,
        )
        await self.check(req, envelope.metadata.correlationId)
        self.repo.mark_event_processed(envelope.eventId)

    # -- helpers -----------------------------------------------------------
    async def _emit(self, routing_key, req, score, decision, reasons, correlation_id) -> None:
        envelope = build_envelope(
            event_type=routing_key,
            aggregate_id=req.applicationId,
            payload={
                "applicationId": req.applicationId,
                "applicantId": req.applicantId,
                "score": score,
                "decision": decision,
                "reasons": reasons,
            },
            correlation_id=correlation_id,
        )
        await self.bus.publish(routing_key, envelope)

    def _response_from_record(self, rec: dict, replay: bool) -> FraudCheckResponse:
        return FraudCheckResponse(
            applicationId=rec["application_id"],
            applicantId=rec["applicant_id"],
            decision=rec["decision"],
            score=rec["score"],
            reasons=rec.get("reasons", []),
            signals=[FraudSignal(**s) for s in rec.get("signals", [])],
            residency=settings.data_residency,
            emittedEvent=None,
            idempotentReplay=replay,
        )
