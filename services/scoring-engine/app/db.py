import os
from datetime import datetime
from typing import Generator, Optional
from sqlmodel import Field, SQLModel, Session, create_engine, JSON, Column

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/neolend_scoring")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, echo=False)

class ScoringRequest(SQLModel, table=True):
    __tablename__ = "scoring_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    applicant_id: str = Field(index=True)
    document_id: str = Field(index=True)
    score: int
    model_version: str
    shap_explanations: dict = Field(default_factory=dict, sa_column=Column(JSON))
    bureau_score: float
    public_services_score: float
    ecommerce_score: float
    wallet_score: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

def init_db() -> None:
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
