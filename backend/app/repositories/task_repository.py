from uuid import UUID
import httpx
from app.core.config import get_settings
from app.schemas.tasks import TaskCreate, TimerCreate

class TaskRepository:
    def __init__(self) -> None: self.settings = get_settings()

    @property
    def headers(self) -> dict[str, str]:
        return {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key, "Prefer": "return=representation"}

    async def list(self, organization_id: UUID, page: int, page_size: int) -> tuple[list[dict], int]:
        params = {"organization_id": f"eq.{organization_id}", "order": "planned_end_at.asc.nullslast", "offset": str((page - 1) * page_size), "limit": str(page_size)}
        headers = {**self.headers, "Prefer": "count=exact"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/tasks", headers=headers, params=params)
            response.raise_for_status()
        total = response.headers.get("content-range", "*/0").split("/")[-1]
        return response.json(), int(total) if total.isdigit() else 0

    async def belongs_to_organization(self, table: str, record_id: UUID, organization_id: UUID) -> bool:
        if table not in {"projects", "villas", "tasks"}:
            raise ValueError("Unsupported scoped entity")
        params = {"id": f"eq.{record_id}", "organization_id": f"eq.{organization_id}", "select": "id", "limit": "1"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/{table}", headers=self.headers, params=params)
            response.raise_for_status()
        return bool(response.json())

    async def villa_belongs_to_project(self, villa_id: UUID, project_id: UUID, organization_id: UUID) -> bool:
        params = {"id": f"eq.{villa_id}", "project_id": f"eq.{project_id}", "organization_id": f"eq.{organization_id}", "select": "id", "limit": "1"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/villas", headers=self.headers, params=params)
            response.raise_for_status()
        return bool(response.json())

    async def create(self, organization_id: UUID, actor_id: UUID, payload: TaskCreate) -> dict:
        record = {**payload.model_dump(mode="json"), "organization_id": str(organization_id), "created_by": str(actor_id), "updated_by": str(actor_id), "status": "NOT_STARTED"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/tasks", headers=self.headers, json=record)
            response.raise_for_status()
        return response.json()[0]

    async def create_timer(self, organization_id: UUID, task_id: UUID, actor_id: UUID, payload: TimerCreate) -> dict:
        tracker = {**payload.model_dump(mode="json"), "organization_id": str(organization_id), "task_id": str(task_id), "created_by": str(actor_id), "updated_by": str(actor_id)}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/task_time_trackers", headers=self.headers, json=tracker)
            response.raise_for_status()
            tracker_record = response.json()[0]
            event = {"organization_id": str(organization_id), "tracker_id": tracker_record["id"], "event_type": "CREATED", "actor_id": str(actor_id), "new_value": {"planned_start_at": tracker_record["planned_start_at"], "planned_end_at": tracker_record["planned_end_at"]}}
            event_response = await client.post(f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/task_time_events", headers=self.headers, json=event)
            event_response.raise_for_status()
        return tracker_record
