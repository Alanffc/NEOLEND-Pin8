# scoring-engine — FastAPI app. TODO: implementar endpoints.
from fastapi import FastAPI

app = FastAPI(title="scoring-engine")


@app.get("/health")
def health():
    return {"status": "ok", "service": "scoring-engine"}
