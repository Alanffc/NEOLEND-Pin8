# fraud-detection — persistencia operativa (PostgreSQL) con fallback in-memory.
#
# Guarda: resultados de fraud checks, idempotencia por eventId, y templates
# enrolados (referencia para el face-match). Si DATABASE_URL no está o la DB no
# responde, cae a un store en memoria para que el servicio corra standalone
# (mock) y nadie quede bloqueado esperando la infra.
from __future__ import annotations

import json
import logging
from typing import Any

from .config import settings

log = logging.getLogger("fraud.db")

try:  # psycopg2 es opcional en tiempo de import (modo mock sin DB).
    import psycopg2
    import psycopg2.extras
except Exception:  # pragma: no cover - entorno sin driver
    psycopg2 = None


SCHEMA = """
CREATE TABLE IF NOT EXISTS fraud_checks (
    application_id TEXT PRIMARY KEY,
    applicant_id   TEXT NOT NULL,
    decision       TEXT NOT NULL,
    score          DOUBLE PRECISION NOT NULL,
    reasons        JSONB NOT NULL DEFAULT '[]',
    signals        JSONB NOT NULL DEFAULT '[]',
    correlation_id TEXT,
    checked_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS processed_events (
    event_id     TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enrolled_templates (
    applicant_id TEXT PRIMARY KEY,
    doc_id       TEXT NOT NULL,
    template     JSONB NOT NULL,
    enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


class FraudRepository:
    def __init__(self) -> None:
        self._conn = None
        self._mem_checks: dict[str, dict[str, Any]] = {}
        self._mem_events: set[str] = set()
        self._mem_templates: dict[str, dict[str, Any]] = {}

    # -- ciclo de vida -----------------------------------------------------
    def init(self) -> None:
        if not settings.use_real_db or psycopg2 is None:
            log.warning("FraudRepository en modo in-memory (sin PostgreSQL).")
            return
        try:
            self._conn = psycopg2.connect(settings.database_url)
            self._conn.autocommit = True
            with self._conn.cursor() as cur:
                cur.execute(SCHEMA)
            log.info("FraudRepository conectado a PostgreSQL.")
        except Exception as exc:  # fallback a memoria si la DB no responde
            log.warning("No se pudo conectar a PostgreSQL (%s). Uso in-memory.", exc)
            self._conn = None

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    @property
    def backend(self) -> str:
        return "postgres" if self._conn is not None else "memory"

    # -- fraud checks ------------------------------------------------------
    def get_check(self, application_id: str) -> dict[str, Any] | None:
        if self._conn is None:
            return self._mem_checks.get(application_id)
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM fraud_checks WHERE application_id = %s", (application_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def save_check(self, record: dict[str, Any]) -> None:
        if self._conn is None:
            self._mem_checks[record["application_id"]] = record
            return
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO fraud_checks
                    (application_id, applicant_id, decision, score, reasons, signals, correlation_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (application_id) DO NOTHING
                """,
                (
                    record["application_id"],
                    record["applicant_id"],
                    record["decision"],
                    record["score"],
                    json.dumps(record.get("reasons", [])),
                    json.dumps(record.get("signals", [])),
                    record.get("correlation_id"),
                ),
            )

    def count_checks(self) -> int:
        if self._conn is None:
            return len(self._mem_checks)
        with self._conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM fraud_checks")
            return int(cur.fetchone()[0])

    def count_recent_checks(self, applicant_id: str) -> int:
        if self._conn is None:
            return sum(
                1 for c in self._mem_checks.values() if c["applicant_id"] == applicant_id
            )
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM fraud_checks WHERE applicant_id = %s "
                "AND checked_at > now() - interval '1 hour'",
                (applicant_id,),
            )
            return int(cur.fetchone()[0])

    # -- idempotencia por eventId -----------------------------------------
    def is_event_processed(self, event_id: str) -> bool:
        if self._conn is None:
            return event_id in self._mem_events
        with self._conn.cursor() as cur:
            cur.execute("SELECT 1 FROM processed_events WHERE event_id = %s", (event_id,))
            return cur.fetchone() is not None

    def mark_event_processed(self, event_id: str) -> None:
        if self._conn is None:
            self._mem_events.add(event_id)
            return
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO processed_events (event_id) VALUES (%s) "
                "ON CONFLICT DO NOTHING",
                (event_id,),
            )

    # -- enrolamiento de templates ----------------------------------------
    def enroll(self, applicant_id: str, doc_id: str, template: list[float]) -> None:
        if self._conn is None:
            self._mem_templates[applicant_id] = {"doc_id": doc_id, "template": template}
            return
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO enrolled_templates (applicant_id, doc_id, template)
                VALUES (%s, %s, %s)
                ON CONFLICT (applicant_id)
                DO UPDATE SET doc_id = EXCLUDED.doc_id, template = EXCLUDED.template,
                              enrolled_at = now()
                """,
                (applicant_id, doc_id, json.dumps(template)),
            )

    def get_enrolled(self, applicant_id: str) -> list[float] | None:
        if self._conn is None:
            row = self._mem_templates.get(applicant_id)
            return list(row["template"]) if row else None
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT template FROM enrolled_templates WHERE applicant_id = %s",
                (applicant_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            value = row[0]
            return value if isinstance(value, list) else json.loads(value)
