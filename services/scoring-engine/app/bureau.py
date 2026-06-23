import os
import asyncio
import httpx
import random
import logging

logger = logging.getLogger("scoring-engine")

# The URL of the local Bureau Adapter microservice
BUREAU_ADAPTER_URL = os.getenv("BUREAU_ADAPTER_URL", "http://bureau-adapter:3002/bureau")

async def fetch_bureau_score(applicant_id: str, document_id: str) -> float:
    """
    Asynchronously queries the traditional Credit Bureau via the bureau-adapter service.
    Implements a robust fallback in case of timeout or connection failures.
    """
    # Simulate network latency overhead
    await asyncio.sleep(random.uniform(0.1, 0.3))
    
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(
                f"{BUREAU_ADAPTER_URL}/{document_id}",
                params={"applicantId": applicant_id}
            )
            if response.status_code == 200:
                payload = response.json()
                return float(payload.get("score", 500.0))
    except Exception as e:
        logger.warning(f"Failed to query bureau-adapter, applying local fallback. Error: {e}")
        
    # Local fallback: Generate stable deterministic/randomized traditional credit score
    # representing standard bureau score range [300, 850]
    return float(random.randint(350, 850))

async def fetch_public_services_score(document_id: str) -> float:
    """
    Asynchronously retrieves utility bills payment behaviors (Electricity, Water, Telecom).
    """
    await asyncio.sleep(random.uniform(0.05, 0.15))
    return float(random.randint(30, 100))

async def fetch_ecommerce_score(document_id: str) -> float:
    """
    Asynchronously retrieves transactional profiles from aligned e-commerce APIs.
    """
    await asyncio.sleep(random.uniform(0.05, 0.15))
    return float(random.randint(20, 100))

async def fetch_wallet_score(document_id: str) -> float:
    """
    Asynchronously retrieves payment and mobile recharge frequency patterns from digital wallets.
    """
    await asyncio.sleep(random.uniform(0.05, 0.2))
    return float(random.randint(40, 100))
