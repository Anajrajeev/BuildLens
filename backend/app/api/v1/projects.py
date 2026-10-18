from typing import Any
from uuid import UUID
import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.errors import api_error
from app.core.permissions import Permission, require_permission
from app.core.security import CurrentUser, get_current_user
from app.core.seed_store import (
    build_default_villa_phases,
    create_row,
    list_rows,
    reconcile_villa_phases,
)
from app.repositories.project_repository import ProjectRepository
from app.schemas.common import Page
from app.schemas.projects import ProjectCreate, ProjectRead
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])
repository = ProjectRepository()


class VillaCreate(BaseModel):
    villa_number: str = Field(min_length=1, max_length=40)
    block: str | None = None
    villa_type: str | None = None
    status: str = "NOT_STARTED"
    progress: int = 0
    work_section: str | None = None
    state_note: str | None = None
    phases: list[dict[str, Any]] | None = None


class TaskSimpleCreate(BaseModel):
    title: str | None = None
    name: str | None = None
    villa_id: str | None = None
    priority: str = "MEDIUM"
    status: str = "IN_PROGRESS"
    progress: int = 0
    planned_end_at: str | None = None


def _use_seed_store() -> bool:
    settings = get_settings()
    if settings.data_backend == "firestore":
        return False
    return bool(
        settings.auth_disabled
        or not settings.cloud_run_data_api_url
        or "127.0.0.1:8001" in settings.cloud_run_data_api_url
    )


@router.get("", response_model=Page[ProjectRead])
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
):
    require_permission(user, Permission.PROJECT_READ)
    records, total = await ProjectService(repository).list(user, page, page_size)
    return Page(items=records, page=page, page_size=page_size, total=total)


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(payload: ProjectCreate, user: CurrentUser = Depends(get_current_user)):
    require_permission(user, Permission.PROJECT_WRITE)
    assert user.organization_id is not None
    return await repository.create(user.organization_id, payload)


@router.get("/{project_id}/villas")
async def list_villas(project_id: UUID, user: CurrentUser = Depends(get_current_user)):
    require_permission(user, Permission.VILLA_READ_ALL)
    if get_settings().data_backend == "firestore":
        from app.repositories.platform_repository import PlatformRepository
        rows = await PlatformRepository().list("villas", user.organization_id, filters={"project_id": f"eq.{project_id}", "deleted_at": "is.null"}, order="villa_number.asc", limit=10000)
        return {"items": rows}
    if _use_seed_store():
        rows = list_rows("villas", str(user.organization_id), filters={"project_id": f"eq.{project_id}"})
        if not rows:
            rows = list_rows("villas", str(user.organization_id))
        return {"items": rows}
    settings = get_settings()
    headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key}
    params = {
        "organization_id": f"eq.{user.organization_id}",
        "project_id": f"eq.{project_id}",
        "deleted_at": "is.null",
        "select": "id,villa_number,block,status,villa_type,target_handover_date",
        "order": "villa_number",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/villas",
            headers=headers,
            params=params,
        )
        response.raise_for_status()
    return {"items": response.json()}


@router.post("/{project_id}/villas", status_code=201)
async def create_villa(project_id: UUID, payload: VillaCreate, user: CurrentUser = Depends(get_current_user)):
    require_permission(user, Permission.VILLA_WRITE)
    phases = reconcile_villa_phases(payload.phases) if payload.phases else build_default_villa_phases()
    record = {
        "organization_id": str(user.organization_id),
        "project_id": str(project_id),
        "villa_number": payload.villa_number,
        "block": payload.block or "Cluster A",
        "villa_type": payload.villa_type or "4BHK Signature Villa",
        "status": payload.status,
        "progress": payload.progress,
        "work_section": payload.work_section or phases[0]["name"],
        "state_note": payload.state_note or "Villa registered with finishing phases.",
        "evidence_file": None,
        "rework_approved_by": None,
        "phases": phases,
    }
    if _use_seed_store():
        return create_row("villas", record)
    if get_settings().data_backend == "firestore":
        from app.repositories.platform_repository import PlatformRepository
        return await PlatformRepository().create("villas", user.organization_id, {k: v for k, v in record.items() if k != "organization_id"})
    settings = get_settings()
    headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key, "Prefer": "return=representation"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/villas",
            headers=headers,
            json=record,
        )
        if response.status_code == 409:
            raise api_error("VILLA_EXISTS", "This villa number already exists in the project.", 409)
        response.raise_for_status()
    return response.json()[0]


@router.get("/{project_id}/tasks")
async def list_project_tasks(project_id: UUID, user: CurrentUser = Depends(get_current_user)):
    require_permission(user, Permission.TASK_READ)
    if get_settings().data_backend == "firestore":
        from app.repositories.platform_repository import PlatformRepository
        rows = await PlatformRepository().list("tasks", user.organization_id, filters={"project_id": f"eq.{project_id}"}, limit=10000)
        return {"items": rows}
    if _use_seed_store():
        rows = list_rows("tasks", str(user.organization_id), filters={"project_id": f"eq.{project_id}"})
        if not rows:
            rows = list_rows("tasks", str(user.organization_id))
        return {"items": rows}
    settings = get_settings()
    headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key}
    params = {"organization_id": f"eq.{user.organization_id}", "project_id": f"eq.{project_id}"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/tasks",
            headers=headers,
            params=params,
        )
        response.raise_for_status()
    return {"items": response.json()}


@router.post("/{project_id}/tasks", status_code=201)
async def create_project_task(
    project_id: UUID, payload: TaskSimpleCreate, user: CurrentUser = Depends(get_current_user)
):
    require_permission(user, Permission.TASK_WRITE)
    title = payload.title or payload.name or "New Task"
    record = {
        "organization_id": str(user.organization_id),
        "project_id": str(project_id),
        "villa_id": payload.villa_id,
        "name": title,
        "title": title,
        "priority": payload.priority,
        "status": payload.status,
        "progress": payload.progress,
        "planned_end_at": payload.planned_end_at,
    }
    if get_settings().data_backend == "firestore":
        from app.repositories.platform_repository import PlatformRepository
        return await PlatformRepository().create("tasks", user.organization_id, {k: v for k, v in record.items() if k != "organization_id"})
    return create_row("tasks", record)
