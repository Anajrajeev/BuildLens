import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.errors import api_error
from app.core.security import CurrentUser, get_current_user

router = APIRouter(prefix="/operations", tags=["operations"])


class WorkSectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class VendorCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=160)
    category: str | None = Field(default=None, max_length=120)


def _can_manage(user: CurrentUser) -> None:
    if "project.write" not in user.permissions:
        raise api_error("FORBIDDEN", "You do not have permission to manage operational records.", 403)


def _headers(settings: Settings, representation: bool = False) -> dict[str, str]:
    headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key}
    if representation:
        headers["Prefer"] = "return=representation"
    return headers


@router.get("/work-sections")
async def list_work_sections(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    assert user.organization_id
    params = {"organization_id": f"eq.{user.organization_id}", "select": "id,name,active", "order": "name"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/work_sections", params=params, headers=_headers(settings))
        response.raise_for_status()
    return {"items": response.json()}


@router.post("/work-sections", status_code=201)
async def create_work_section(payload: WorkSectionCreate, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    _can_manage(user); assert user.organization_id
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/work_sections", headers=_headers(settings, True), json={"organization_id": str(user.organization_id), "name": payload.name.strip()})
        if response.status_code == 409:
            raise api_error("WORK_SECTION_EXISTS", "That work section already exists.", 409)
        response.raise_for_status()
    return response.json()[0]


@router.get("/vendors")
async def list_vendors(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    assert user.organization_id
    params = {"organization_id": f"eq.{user.organization_id}", "select": "id,company_name,category,status", "order": "company_name"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/vendors", params=params, headers=_headers(settings))
        response.raise_for_status()
    return {"items": response.json()}


@router.post("/vendors", status_code=201)
async def create_vendor(payload: VendorCreate, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    _can_manage(user); assert user.organization_id
    record = {"organization_id": str(user.organization_id), "company_name": payload.company_name.strip(), "category": payload.category.strip() if payload.category else None}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/vendors", headers=_headers(settings, True), json=record)
        if response.status_code == 409:
            raise api_error("VENDOR_EXISTS", "That vendor already exists.", 409)
        response.raise_for_status()
    return response.json()[0]


@router.get("/documents")
async def list_documents(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    assert user.organization_id
    params = {"organization_id": f"eq.{user.organization_id}", "select": "id,entity_type,mime_type,size_bytes,uploaded_at", "order": "uploaded_at.desc", "limit": "100"}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/attachments", params=params, headers=_headers(settings))
        response.raise_for_status()
    return {"items": response.json()}
