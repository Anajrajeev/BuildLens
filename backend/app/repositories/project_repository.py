from uuid import UUID
import httpx
from app.core.config import get_settings
from app.schemas.projects import ProjectCreate

class ProjectRepository:
    """Cloud SQL REST persistence. Service-layer scope checks occur before this adapter."""
    def __init__(self) -> None:
        self.settings = get_settings()

    async def list_for_organization(self, organization_id: UUID, page: int, page_size: int) -> tuple[list[dict], int]:
        headers = {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key, "Prefer": "count=exact"}
        params = {"organization_id": f"eq.{organization_id}", "deleted_at": "is.null", "order": "created_at.desc", "offset": str((page - 1) * page_size), "limit": str(page_size)}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/projects", headers=headers, params=params)
            response.raise_for_status()
        count_header = response.headers.get("content-range", "*/0").split("/")[-1]
        return response.json(), int(count_header) if count_header.isdigit() else 0

    async def create(self, organization_id: UUID, payload: ProjectCreate) -> dict:
        headers = {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key, "Prefer": "return=representation"}
        record = {**payload.model_dump(mode="json"), "organization_id": str(organization_id)}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/projects", headers=headers, json=record)
            response.raise_for_status()
        return response.json()[0]
