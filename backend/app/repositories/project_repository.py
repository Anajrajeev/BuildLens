from uuid import UUID
import httpx
from app.core.config import get_settings
from app.core.seed_store import create_row, list_rows
from app.schemas.projects import ProjectCreate


class ProjectRepository:
    """Cloud SQL REST persistence with seeded local store support."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def _use_seed_store(self) -> bool:
        return bool(
            self.settings.auth_disabled
            or not self.settings.cloud_run_data_api_url
            or "127.0.0.1:8001" in self.settings.cloud_run_data_api_url
        )

    async def list_for_organization(self, organization_id: UUID, page: int, page_size: int) -> tuple[list[dict], int]:
        if self._use_seed_store():
            rows = list_rows("projects", str(organization_id), limit=page_size)
            return rows, len(rows)
        headers = {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key, "Prefer": "count=exact"}
        params = {
            "organization_id": f"eq.{organization_id}",
            "deleted_at": "is.null",
            "order": "created_at.desc",
            "offset": str((page - 1) * page_size),
            "limit": str(page_size),
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/projects",
                headers=headers,
                params=params,
            )
            response.raise_for_status()
        count_header = response.headers.get("content-range", "*/0").split("/")[-1]
        return response.json(), int(count_header) if count_header.isdigit() else 0

    async def create(self, organization_id: UUID, payload: ProjectCreate) -> dict:
        record = {**payload.model_dump(mode="json"), "organization_id": str(organization_id), "status": "ACTIVE"}
        if self._use_seed_store():
            return create_row("projects", record)
        headers = {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key, "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/projects",
                headers=headers,
                json=record,
            )
            response.raise_for_status()
        return response.json()[0]
