# fraud-detection — dataset LOCAL de identidades robadas / lista negra.
#
# Data residency: este dataset (documentos reportados + templates biométricos)
# vive on-prem. Aquí se mantiene en memoria con seed determinista; en integración
# real se puede cargar desde la DB `fraud` (tabla stolen_identities) sin cambiar
# la interfaz pública.
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from .biometric import LocalBiometricEngine, embed_from_seed


def hash_doc(doc_id: str) -> str:
    """Los documentos se guardan hasheados (no en claro) para minimizar PII."""
    return hashlib.sha256(doc_id.strip().upper().encode()).hexdigest()


@dataclass
class StolenIdentity:
    identity_id: str
    doc_hash: str
    template: list[float]
    reason: str
    reported_at: str = ""
    alias: str = ""  # etiqueta no sensible para evidencia/demo


@dataclass
class BiometricMatch:
    identity_id: str
    similarity: float
    reason: str
    alias: str


@dataclass
class StolenIdentityRepository:
    engine: LocalBiometricEngine
    _by_doc: dict[str, StolenIdentity] = field(default_factory=dict)
    _all: list[StolenIdentity] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._seed()

    # -- escritura ---------------------------------------------------------
    def add(self, identity: StolenIdentity) -> None:
        self._by_doc[identity.doc_hash] = identity
        self._all.append(identity)

    def add_doc(self, doc_id: str, reason: str, alias: str = "") -> StolenIdentity:
        ident = StolenIdentity(
            identity_id=f"sid-{len(self._all) + 1:04d}",
            doc_hash=hash_doc(doc_id),
            template=embed_from_seed(f"stolen:{doc_id}"),
            reason=reason,
            alias=alias or doc_id,
        )
        self.add(ident)
        return ident

    # -- consulta ----------------------------------------------------------
    def match_doc(self, doc_id: str) -> StolenIdentity | None:
        return self._by_doc.get(hash_doc(doc_id))

    def match_biometric(self, probe: list[float], threshold: float) -> BiometricMatch | None:
        """Mejor coincidencia biométrica por encima del umbral, o None."""
        best: BiometricMatch | None = None
        for ident in self._all:
            sim = self.engine.match(probe, ident.template)
            if sim >= threshold and (best is None or sim > best.similarity):
                best = BiometricMatch(
                    identity_id=ident.identity_id,
                    similarity=sim,
                    reason=ident.reason,
                    alias=ident.alias,
                )
        return best

    def count(self) -> int:
        return len(self._all)

    # -- seed determinista para demo/evidencia -----------------------------
    def _seed(self) -> None:
        seed_rows = [
            ("STOLEN-0001", "documento reportado robado", "lote-2025-q1"),
            ("STOLEN-0002", "identidad sintética detectada", "lote-2025-q1"),
            ("DOC-FALSO-77", "documento falsificado", "denuncia-fiscalia"),
            ("CI-9999999", "suplantación confirmada", "alerta-interna"),
        ]
        for doc_id, reason, alias in seed_rows:
            self.add_doc(doc_id, reason, alias)
