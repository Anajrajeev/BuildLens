from fastapi import APIRouter, Depends, Query
from uuid import UUID
import httpx
from app.core.config import get_settings
from app.core.errors import api_error
from app.core.security import CurrentUser, get_current_user
from app.repositories.project_repository import ProjectRepository
from app.schemas.common import Page
from app.schemas.projects import ProjectCreate, ProjectRead
from pydantic import BaseModel, Field
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])
repository = ProjectRepository()

class VillaCreate(BaseModel):
    villa_number: str = Field(min_length=1, max_length=40)
    block: str | None = None
    villa_type: str | None = None

@router.get("", response_model=Page[ProjectRead])
async def list_projects(page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), user: CurrentUser = Depends(get_current_user)):
    records, total = await ProjectService(repository).list(user, page, page_size)
    return Page(items=records, page=page, page_size=page_size, total=total)

@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(payload: ProjectCreate, user: CurrentUser = Depends(get_current_user)):
    if "project.write" not in user.permissions:
        from app.core.errors import api_error
        raise api_error("FORBIDDEN", "You do not have permission to create projects.", 403)
    assert user.organization_id is not None
    return await repository.create(user.organization_id, payload)

@router.get("/{project_id}/villas")
async def list_villas(project_id: UUID, user: CurrentUser = Depends(get_current_user)):
    if "villa.read.all" not in user.permissions:
        raise api_error("FORBIDDEN", "You do not have permission to view villas.", 403)
    settings = get_settings()
    headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key}
    params = {"organization_id": f"eq.{user.organization_id}", "project_id": f"eq.{project_id}", "deleted_at": "is.null", "select": "id,villa_number,block,status,villa_type,target_handover_date", "order": "villa_number"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/villas", headers=headers, params=params)
        response.raise_for_status()
    return {"items": response.json()}

@router.post("/{project_id}/villas", status_code=201)
async def create_villa(project_id: UUID, payload: VillaCreate, user: CurrentUser = Depends(get_current_user)):
    if "villa.write" not in user.permissions:
        raise api_error("FORBIDDEN", "You do not have permission to add villas.", 403)
    settings = get_settings(); headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key, "Prefer": "return=representation"}
    record = {"organization_id": str(user.organization_id), "project_id": str(project_id), **payload.model_dump()}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/villas", headers=headers, json=record)
        if response.status_code == 409: raise api_error("VILLA_EXISTS", "This villa number already exists in the project.", 409)
        response.raise_for_status()
    return response.json()[0]
