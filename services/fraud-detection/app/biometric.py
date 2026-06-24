# fraud-detection — motor biométrico LOCAL (on-prem).
#
# Data residency (inciso VII): todo el cómputo ocurre en proceso; no se hace
# ninguna llamada de red a un servicio de biometría externo. El "modelo" aquí
# es un mock determinista (similitud coseno sobre embeddings) pero la interfaz
# está pensada para enchufar un modelo real (p.ej. ONNX de reconocimiento facial)
# sin tocar el resto del servicio.
from __future__ import annotations

import hashlib
import math
import struct

from .config import settings
from .models import BiometricSample


def embed_from_seed(seed: str, dim: int | None = None) -> list[float]:
    """Embedding determinista a partir de un string semilla.
    Misma semilla -> mismo vector (usuario recurrente legítimo);
    semillas distintas -> vectores casi ortogonales."""
    dim = dim or settings.embedding_dim
    out: list[float] = []
    counter = 0
    while len(out) < dim:
        digest = hashlib.sha256(f"{seed}:{counter}".encode()).digest()
        for i in range(0, len(digest), 4):
            if len(out) >= dim:
                break
            (raw,) = struct.unpack("<I", digest[i : i + 4])
            out.append((raw / 2**32) * 2.0 - 1.0)  # -> [-1, 1)
        counter += 1
    return _normalize(out)


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return max(-1.0, min(1.0, dot / (na * nb)))


class LocalBiometricEngine:
    """Modelo biométrico on-prem. Sustituible por uno real vía `load_model`."""

    def __init__(self) -> None:
        # Falla rápido si la config pide cloud con residency on-prem.
        settings.enforce_residency()
        self.residency = settings.data_residency
        self._model = None  # placeholder para un modelo real (ONNX/torch).

    def load_model(self, model_path: str | None = None) -> None:
        # MOCK: no se carga nada; el matching usa similitud coseno determinista.
        # En integración real: cargar pesos locales aquí (sin red).
        self._model = "local-mock-v1"

    def resolve_embedding(self, sample: BiometricSample | None, seed: str) -> list[float]:
        """Devuelve el embedding de la muestra o uno derivado del seed (mock)."""
        if sample and sample.embedding:
            return _normalize(list(sample.embedding))
        return embed_from_seed(seed)

    def liveness(self, sample: BiometricSample | None, seed: str) -> float:
        """Score de prueba de vida (0..1). Usa el del dispositivo si viene;
        si no, asume captura viva (mock alto). Una captura marcada como no-viva
        debe llegar con liveness_score bajo desde el cliente."""
        if sample and sample.liveness_score is not None:
            return float(sample.liveness_score)
        return 0.95

    def match(self, probe: list[float], gallery: list[float]) -> float:
        """Similitud 0..1 entre dos templates."""
        return (cosine_similarity(probe, gallery) + 1.0) / 2.0
