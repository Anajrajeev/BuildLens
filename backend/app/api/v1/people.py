from uuid import UUID
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.errors import api_error
from app.core.permissions import Permission
from app.core.security import CurrentUser, get_current_user
from app.core.seed_store import create_row, list_rows

router = APIRouter(prefix="/people", tags=["people"])
ADMIN_EMAIL = "anajrajeev@gmail.com"


class PersonCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(default="member@buildlens.local")
    temporary_password: str = Field(default="BuildLensTemp#2026", min_length=8, max_length=128)
    role_id: str | UUID = Field(default="10000000-0000-0000-0000-000000000003")
    employee_code: str | None = None
    manager_employee_id: UUID | None = None
    project_ids: list[UUID] = []


def _use_seed_store(settings: Settings) -> bool:
    return bool(
        settings.auth_disabled
        or not settings.cloud_run_data_api_url
        or "127.0.0.1:8001" in settings.cloud_run_data_api_url
    )


def _admin(user: CurrentUser) -> None:
    if Permission.PEOPLE_MANAGE.value not in user.permissions and (user.email or "").lower() != ADMIN_EMAIL:
        raise api_error(
            "FORBIDDEN",
            "Only the Director role (or BuildLens administrator) can manage people.",
            403,
        )


def _headers(settings: Settings) -> dict[str, str]:
    return {
        "X-Internal-Token": settings.cloud_run_data_api_secret_key,
        "Authorization": f"Bearer {settings.cloud_run_data_api_secret_key}",
        "Content-Type": "application/json",
    }


@router.get("")
async def people(user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    if Permission.PEOPLE_READ.value not in user.permissions and Permission.PEOPLE_MANAGE.value not in user.permissions:
        _admin(user)
    assert user.organization_id
    if _use_seed_store(settings):
        org_str = str(user.organization_id)
        return {
            "employees": list_rows("employees", org_str),
            "roles": list_rows("roles", org_str),
            "projects": list_rows("projects", org_str),
        }
    params = {"organization_id": f"eq.{user.organization_id}", "select": "id,full_name,employee_code,user_id,status"}
    async with httpx.AsyncClient(timeout=15) as client:
        employees = (
            await client.get(f"{settings.cloud_run_data_api_url}/api/v1/employees", params=params, headers=_headers(settings))
        ).json()
        roles = (
            await client.get(
                f"{settings.cloud_run_data_api_url}/api/v1/roles",
                params={"organization_id": f"eq.{user.organization_id}", "select": "id,name,description"},
                headers=_headers(settings),
            )
        ).json()
        memberships = (
            await client.get(
                f"{settings.cloud_run_data_api_url}/api/v1/organization_members",
                params={"organization_id": f"eq.{user.organization_id}", "select": "user_id,role_id"},
                headers=_headers(settings),
            )
        ).json()
        reporting = (
            await client.get(
                f"{settings.cloud_run_data_api_url}/api/v1/employee_reporting_relationships",
                params={"organization_id": f"eq.{user.organization_id}", "select": "employee_id,manager_employee_id,effective_to"},
                headers=_headers(settings),
            )
        ).json()
        assignments = (
            await client.get(
                f"{settings.cloud_run_data_api_url}/api/v1/employee_project_assignments",
                params={"organization_id": f"eq.{user.organization_id}", "select": "employee_id,project_id"},
                headers=_headers(settings),
            )
        ).json()
        projects = (
            await client.get(
                f"{settings.cloud_run_data_api_url}/api/v1/projects",
                params={"organization_id": f"eq.{user.organization_id}", "select": "id,name,project_code,status", "deleted_at": "is.null"},
                headers=_headers(settings),
            )
        ).json()
    role_by_user = {str(row["user_id"]): str(row["role_id"]) for row in memberships}
    manager_by_employee = {str(row["employee_id"]): str(row["manager_employee_id"]) for row in reporting if not row.get("effective_to")}
    projects_by_employee: dict[str, list[str]] = {}
    for row in assignments:
        projects_by_employee.setdefault(str(row["employee_id"]), []).append(str(row["project_id"]))
    return {
        "employees": [
            {
                **row,
                "role_id": role_by_user.get(str(row.get("user_id"))),
                "manager_employee_id": manager_by_employee.get(str(row["id"])),
                "project_ids": projects_by_employee.get(str(row["id"]), []),
            }
            for row in employees
        ],
        "roles": roles,
        "projects": projects,
    }


@router.post("", status_code=201)
@router.post("/employees", status_code=201)
async def create_person(
    payload: PersonCreate,
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    _admin(user)
    assert user.organization_id
    if _use_seed_store(settings):
        employees = list_rows("employees", str(user.organization_id))
        created = create_row(
            "employees",
            {
                "organization_id": str(user.organization_id),
                "full_name": payload.full_name,
                "employee_code": payload.employee_code or f"BL-EMP-{len(employees) + 10}",
                "status": "ACTIVE",
                "role_id": str(payload.role_id),
            },
        )
        return {"id": created["id"], "full_name": payload.full_name, "email": str(payload.email)}
    headers = _headers(settings)
    async with httpx.AsyncClient(timeout=20) as client:
        account = await client.post(
            f"{settings.cloud_run_data_api_url}/auth/v1/admin/users",
            headers=headers,
            json={"email": str(payload.email), "password": payload.temporary_password, "email_confirm": True, "user_metadata": {"full_name": payload.full_name}},
        )
        if account.status_code >= 400:
            raise api_error("ACCOUNT_CREATE_FAILED", account.json().get("msg", "Could not create the account."), 400)
        user_id = account.json()["id"]
        employee = await client.post(
            f"{settings.cloud_run_data_api_url}/api/v1/employees",
            headers={**headers, "Prefer": "return=representation"},
            json={"organization_id": str(user.organization_id), "user_id": user_id, "employee_code": f"SF-{user_id[:8].upper()}", "full_name": payload.full_name},
        )
        employee.raise_for_status()
        employee_id = employee.json()[0]["id"]
        for path, body in [
            ("organization_members", {"organization_id": str(user.organization_id), "user_id": user_id, "role_id": str(payload.role_id), "status": "ACTIVE"}),
            ("employee_roles", {"organization_id": str(user.organization_id), "employee_id": employee_id, "role_id": str(payload.role_id), "assigned_by": str(user.id)}),
        ]:
            response = await client.post(f"{settings.cloud_run_data_api_url}/api/v1/{path}", headers=headers, json=body)
            response.raise_for_status()
        if payload.manager_employee_id:
            response = await client.post(
                f"{settings.cloud_run_data_api_url}/api/v1/employee_reporting_relationships",
                headers=headers,
                json={"organization_id": str(user.organization_id), "employee_id": employee_id, "manager_employee_id": str(payload.manager_employee_id)},
            )
            response.raise_for_status()
        for project_id in payload.project_ids:
            response = await client.post(
                f"{settings.cloud_run_data_api_url}/api/v1/employee_project_assignments",
                headers=headers,
                json={"organization_id": str(user.organization_id), "employee_id": employee_id, "project_id": str(project_id)},
            )
            response.raise_for_status()
    return {"id": employee_id, "full_name": payload.full_name, "email": str(payload.email)}
