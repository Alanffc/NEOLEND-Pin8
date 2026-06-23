# fraud-detection — FastAPI app. TODO: implementar endpoints.
from fastapi import FastAPI

app = FastAPI(title="fraud-detection")


@app.get("/health")
def health():
    return {"status": "ok", "service": "fraud-detection"}
