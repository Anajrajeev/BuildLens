from uuid import UUID
import httpx
from app.core.config import get_settings
from app.core.seed_store import create_row, get_row, list_rows
from app.schemas.tasks import TaskCreate, TimerCreate


class TaskRepository:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _use_seed_store(self) -> bool:
        return bool(
            self.settings.auth_disabled
            or not self.settings.cloud_run_data_api_url
            or "127.0.0.1:8001" in self.settings.cloud_run_data_api_url
        )

    @property
    def headers(self) -> dict[str, str]:
        return {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key, "Prefer": "return=representation"}

    async def list(self, organization_id: UUID, page: int, page_size: int) -> tuple[list[dict], int]:
        if self.settings.data_backend == "firestore":
            from app.repositories.platform_repository import PlatformRepository
            rows = await PlatformRepository().list("tasks", organization_id, order="planned_end_at.asc", limit=10000)
            return rows[(page - 1) * page_size : page * page_size], len(rows)
        if self._use_seed_store():
            rows = list_rows("tasks", str(organization_id), limit=page_size)
            return rows, len(rows)
        params = {
            "organization_id": f"eq.{organization_id}",
            "order": "planned_end_at.asc.nullslast",
            "offset": str((page - 1) * page_size),
            "limit": str(page_size),
        }
        headers = {**self.headers, "Prefer": "count=exact"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/tasks",
                headers=headers,
                params=params,
            )
            response.raise_for_status()
        total = response.headers.get("content-range", "*/0").split("/")[-1]
        return response.json(), int(total) if total.isdigit() else 0

    async def belongs_to_organization(self, table: str, record_id: UUID, organization_id: UUID) -> bool:
        if self.settings.data_backend == "firestore":
            from app.repositories.platform_repository import PlatformRepository
            return bool(await PlatformRepository().get(table, organization_id, record_id))
        if table not in {"projects", "villas", "tasks"}:
            raise ValueError("Unsupported scoped entity")
        if self._use_seed_store():
            row = get_row(table, str(record_id))
            return bool(row and str(row.get("organization_id")) == str(organization_id))
        params = {"id": f"eq.{record_id}", "organization_id": f"eq.{organization_id}", "select": "id", "limit": "1"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/{table}",
                headers=self.headers,
                params=params,
            )
            response.raise_for_status()
        return bool(response.json())

    async def villa_belongs_to_project(self, villa_id: UUID, project_id: UUID, organization_id: UUID) -> bool:
        if self.settings.data_backend == "firestore":
            from app.repositories.platform_repository import PlatformRepository
            row = await PlatformRepository().get("villas", organization_id, villa_id)
            return bool(row and str(row.get("project_id")) == str(project_id))
        if self._use_seed_store():
            row = get_row("villas", str(villa_id))
            return bool(row and str(row.get("project_id")) == str(project_id))
        params = {
            "id": f"eq.{villa_id}",
            "project_id": f"eq.{project_id}",
            "organization_id": f"eq.{organization_id}",
            "select": "id",
            "limit": "1",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/villas",
                headers=self.headers,
                params=params,
            )
            response.raise_for_status()
        return bool(response.json())

    async def create(self, organization_id: UUID, actor_id: UUID, payload: TaskCreate) -> dict:
        if self.settings.data_backend == "firestore":
            from app.repositories.platform_repository import PlatformRepository
            return await PlatformRepository().create("tasks", organization_id, {**payload.model_dump(mode="json"), "created_by": str(actor_id)})
        record = {
            **payload.model_dump(mode="json"),
            "organization_id": str(organization_id),
            "created_by": str(actor_id),
            "updated_by": str(actor_id),
            "status": "NOT_STARTED",
            "progress": 0,
        }
        if self._use_seed_store():
            return create_row("tasks", record)
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/tasks",
                headers=self.headers,
                json=record,
            )
            response.raise_for_status()
        return response.json()[0]

    async def create_timer(self, organization_id: UUID, task_id: UUID, actor_id: UUID, payload: TimerCreate) -> dict:
        if self.settings.data_backend == "firestore":
            from app.repositories.platform_repository import PlatformRepository
            repo = PlatformRepository()
            tracker = await repo.create("task_time_trackers", organization_id, {**payload.model_dump(mode="json"), "task_id": str(task_id), "created_by": str(actor_id), "status": "NOT_STARTED"})
            await repo.create("task_time_events", organization_id, {"tracker_id": tracker["id"], "event_type": "CREATED", "actor_id": str(actor_id)})
            return tracker
        tracker = {
            **payload.model_dump(mode="json"),
            "organization_id": str(organization_id),
            "task_id": str(task_id),
            "created_by": str(actor_id),
            "updated_by": str(actor_id),
            "status": "NOT_STARTED",
        }
        if self._use_seed_store():
            return create_row("task_time_trackers", tracker)
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/task_time_trackers",
                headers=self.headers,
                json=tracker,
            )
            response.raise_for_status()
            tracker_record = response.json()[0]
            event = {
                "organization_id": str(organization_id),
                "tracker_id": tracker_record["id"],
                "event_type": "CREATED",
                "actor_id": str(actor_id),
                "new_value": {
                    "planned_start_at": tracker_record["planned_start_at"],
                    "planned_end_at": tracker_record["planned_end_at"],
                },
            }
            event_response = await client.post(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/task_time_events",
                headers=self.headers,
                json=event,
            )
            event_response.raise_for_status()
        return tracker_record
