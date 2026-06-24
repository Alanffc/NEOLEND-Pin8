FROM python:3.12-slim
WORKDIR /app
# Toolchain para compilar wheels que no traen binario para py3.12 (p. ej. shap)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
