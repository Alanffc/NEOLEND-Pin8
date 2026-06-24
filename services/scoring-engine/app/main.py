import time
import asyncio
from typing import Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.db import init_db, get_session, ScoringRequest
from app.bureau import (
    fetch_bureau_score,
    fetch_public_services_score,
    fetch_ecommerce_score,
    fetch_wallet_score
)
from app.model import predict_and_explain, get_model_version

# Lifecycle context to initialize database tables on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
    except Exception as e:
        # Gracefully handle situations where Postgres might not be ready yet
        print(f"Warning: Database schema initialization failed/skipped: {e}")
    yield

app = FastAPI(
    title="NeoLend Scoring Engine Microservice",
    version="1.0.0",
    lifespan=lifespan
)

class ScoreRequestPayload(BaseModel):
    applicant_id: str = Field(..., description="Unique UUID representing the applicant", example="a9b8c7d6-e5f4-3210-abcd-ef0123456789")
    document_id: str = Field(..., description="National identifier/passport number of the applicant", example="DNI12345678")

class ScoreResponse(BaseModel):
    applicant_id: str
    document_id: str
    credit_score: int
    model_version: str
    shap_values: Dict[str, float]
    base_value: float
    execution_time_seconds: float
    data_sources: Dict[str, float]

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "scoring-engine",
        "model_version": get_model_version()
    }

@app.post("/api/v1/score", response_model=ScoreResponse, status_code=status.HTTP_200_OK)
async def evaluate_credit_score(
    payload: ScoreRequestPayload,
    db: Session = Depends(get_session)
):
    """
    Main endpoint for credit scoring:
    1. Gathers traditional and alternative data concurrently (in under 300ms total).
    2. Runs Machine Learning model inference (Random Forest).
    3. Calculates SHAP explanations to provide explainable credit decisions.
    4. Persists the transaction audit log to PostgreSQL for regulatory audits.
    """
    start_time = time.time()

    # 1. Fetch data sources concurrently using asyncio.gather to satisfy NFR <60 seconds
    try:
        bureau_task = fetch_bureau_score(payload.applicant_id, payload.document_id)
        services_task = fetch_public_services_score(payload.document_id)
        ecommerce_task = fetch_ecommerce_score(payload.document_id)
        wallet_task = fetch_wallet_score(payload.document_id)

        bureau_score, services_score, ecommerce_score, wallet_score = await asyncio.gather(
            bureau_task, services_task, ecommerce_task, wallet_task
        )
    except Exception as gather_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error gathering external alternative data sources: {str(gather_err)}"
        )

    # 2. Run inference and obtain SHAP values
    try:
        final_score, shap_explanations, base_val = predict_and_explain(
            bureau_score=bureau_score,
            public_services_score=services_score,
            ecommerce_score=ecommerce_score,
            wallet_score=wallet_score
        )
    except Exception as ml_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML Inferencia or SHAP explanation failed: {str(ml_err)}"
        )

    execution_duration = time.time() - start_time

    # 3. Create persistent audit record in PostgreSQL
    audit_record = ScoringRequest(
        applicant_id=payload.applicant_id,
        document_id=payload.document_id,
        score=final_score,
        model_version=get_model_version(),
        shap_explanations=shap_explanations,
        bureau_score=bureau_score,
        public_services_score=services_score,
        ecommerce_score=ecommerce_score,
        wallet_score=wallet_score
    )

    try:
        db.add(audit_record)
        db.commit()
        db.refresh(audit_record)
    except Exception as db_err:
        # Log error but do not block client response for resiliency
        print(f"Database logging failed: {db_err}")

    # 4. Formulate response
    return ScoreResponse(
        applicant_id=payload.applicant_id,
        document_id=payload.document_id,
        credit_score=final_score,
        model_version=get_model_version(),
        shap_values=shap_explanations,
        base_value=base_val,
        execution_time_seconds=round(execution_duration, 4),
        data_sources={
            "bureau_score": bureau_score,
            "public_services_score": services_score,
            "ecommerce_score": ecommerce_score,
            "wallet_score": wallet_score
        }
    )
