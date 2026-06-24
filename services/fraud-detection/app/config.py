# fraud-detection — configuración por entorno.
# Data residency (inciso VII / NFR): el modelo biométrico corre LOCAL (on-prem);
# la biometría nunca sale del país ni se envía a cloud extranjero.
import os


def _get(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value if value not in (None, "") else default


class Settings:
    def __init__(self) -> None:
        self.service_name = "fraud-detection"
        self.port = int(_get("PORT", "8002"))

        # Persistencia operativa (resultados de checks + idempotencia).
        # Si no hay DATABASE_URL, db.py cae a un store in-memory (mock).
        self.database_url = _get("DATABASE_URL")

        # Event bus (contrato shared/events/events.md). Si no hay AMQP_URL,
        # events.py usa un MockEventBus en memoria para no bloquear a nadie.
        self.amqp_url = _get("AMQP_URL")
        self.event_exchange = _get("EVENT_EXCHANGE", "neolend.events")

        # Data residency.
        self.data_residency = _get("DATA_RESIDENCY", "on-prem")
        # Si alguien intentara apuntar el matching a un servicio cloud externo,
        # con data_residency=on-prem lo rechazamos en el arranque.
        self.cloud_biometric_url = _get("CLOUD_BIOMETRIC_URL")

        # Umbrales de decisión (0..1).
        self.face_match_threshold = float(_get("FACE_MATCH_THRESHOLD", "0.80"))
        self.liveness_threshold = float(_get("LIVENESS_THRESHOLD", "0.60"))
        self.stolen_match_threshold = float(_get("STOLEN_MATCH_THRESHOLD", "0.88"))
        # score >= fraud_score_threshold  => fraud.check.failed
        self.fraud_score_threshold = float(_get("FRAUD_SCORE_THRESHOLD", "0.50"))

        # Regla de velocidad: nº máx. de checks por solicitante en la ventana.
        self.velocity_max_checks = int(_get("VELOCITY_MAX_CHECKS", "5"))

        # Dimensión del template biométrico local.
        self.embedding_dim = int(_get("EMBEDDING_DIM", "64"))

    @property
    def use_real_bus(self) -> bool:
        return bool(self.amqp_url)

    @property
    def use_real_db(self) -> bool:
        return bool(self.database_url)

    def enforce_residency(self) -> None:
        if self.data_residency == "on-prem" and self.cloud_biometric_url:
            raise RuntimeError(
                "Violación de data residency: DATA_RESIDENCY=on-prem pero "
                "CLOUD_BIOMETRIC_URL está configurado. El modelo debe correr local."
            )


settings = Settings()
