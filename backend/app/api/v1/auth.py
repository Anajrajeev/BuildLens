from uuid import UUID
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.security import CurrentUser, get_current_user
from app.core.config import Settings, get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

class SessionContext(BaseModel):
    user_id: UUID
    email: str | None
    organization_id: UUID
    role_id: UUID | None
    permissions: list[str]
    full_name: str | None = None
    employee_code: str | None = None
    role_name: str | None = None

@router.get("/me", response_model=SessionContext)
async def me(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    assert user.organization_id is not None
    if settings.auth_disabled:
        return SessionContext(
            user_id=user.id,
            email=user.email,
            organization_id=user.organization_id,
            role_id=None,
            permissions=sorted(user.permissions),
            full_name="Local preview",
            employee_code="BL-LOCAL",
            role_name="Preview",
        )
    params = {"organization_id": f"eq.{user.organization_id}", "user_id": f"eq.{user.id}", "select": "full_name,employee_code", "limit": "1"}
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/employees", params=params, headers={"X-Internal-Token": settings.cloud_run_data_api_secret_key})
        response.raise_for_status()
    employee = response.json()[0] if response.json() else {}
    role_name = None
    if user.role_id:
        async with httpx.AsyncClient(timeout=5) as client:
            role_response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/roles", params={"id": f"eq.{user.role_id}", "select": "name", "limit": "1"}, headers={"X-Internal-Token": settings.cloud_run_data_api_secret_key})
            role_response.raise_for_status()
        role_records = role_response.json()
        role_name = role_records[0].get("name") if role_records else None
    return SessionContext(user_id=user.id, email=user.email, organization_id=user.organization_id, role_id=user.role_id, permissions=sorted(user.permissions), full_name=employee.get("full_name"), employee_code=employee.get("employee_code"), role_name=role_name)
