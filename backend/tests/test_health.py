import os
import pytest
os.environ.setdefault("cloud_run_data_api_URL", "https://example.cloud_run_data_api.co")
os.environ.setdefault("cloud_run_data_api_SECRET_KEY", "test-only-secret")

import httpx
from app.main import app

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.mark.anyio
async def test_health_check():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
