from enum import StrEnum
from typing import Final
from uuid import UUID

from app.core.errors import api_error
from app.core.security import CurrentUser


class Permission(StrEnum):
    PROJECT_READ = "project.read"
    PROJECT_WRITE = "project.write"
    VILLA_READ = "villa.read"
    VILLA_READ_ALL = "villa.read.all"
    VILLA_WRITE = "villa.write"
    VILLA_STATE_UPLOAD = "villa.state.upload"
    REWORK_APPROVE = "rework.approve"
    TASK_READ = "task.read"
    TASK_WRITE = "task.write"
    QUALITY_MANAGE = "quality.manage"
    PEOPLE_MANAGE = "people.manage"
    VENDOR_MANAGE = "vendor.manage"
    HANDOVER_MANAGE = "handover.manage"
    TIMER_MANAGE = "timer.manage"


ROLE_METADATA: Final[dict[str, dict[str, str]]] = {
    "Director": {
        "role_id": "20000000-0000-0000-0000-000000000001",
        "user_id": "60000000-0000-0000-0000-000000000001",
        "email": "director@buildlens.io",
        "full_name": "Arjun Menon (Executive Director)",
        "employee_code": "DIR-001",
        "description": "Can do anything and see anything across the entire platform.",
    },
    "Manager": {
        "role_id": "20000000-0000-0000-0000-000000000002",
        "user_id": "60000000-0000-0000-0000-000000000002",
        "email": "manager@buildlens.io",
        "full_name": "Nadia Al-Mansoor (Project Manager)",
        "employee_code": "MGR-104",
        "description": "Reviews flagged defects and approves rework across villas.",
    },
    "Engineer": {
        "role_id": "20000000-0000-0000-0000-000000000003",
        "user_id": "60000000-0000-0000-0000-000000000003",
        "email": "engineer@buildlens.io",
        "full_name": "Karthik Nair (Site Engineer)",
        "employee_code": "ENG-208",
        "description": "Uploads live villa states and progress in the Operations, Villas page.",
    },
}

ROLE_PERMISSIONS: Final[dict[str, frozenset[str]]] = {
    "Director": frozenset(p.value for p in Permission),
    "Manager": frozenset(
        {
            Permission.PROJECT_READ.value,
            Permission.VILLA_READ.value,
            Permission.VILLA_READ_ALL.value,
            Permission.REWORK_APPROVE.value,
            Permission.TASK_READ.value,
            Permission.QUALITY_MANAGE.value,
        }
    ),
    "Engineer": frozenset(
        {
            Permission.PROJECT_READ.value,
            Permission.VILLA_READ.value,
            Permission.VILLA_READ_ALL.value,
            Permission.VILLA_STATE_UPLOAD.value,
            Permission.TASK_READ.value,
            Permission.TASK_WRITE.value,
            Permission.TIMER_MANAGE.value,
        }
    ),
}


def resolve_role_name(raw_role: str | None) -> str:
    if not raw_role:
        return "Director"
    cleaned = raw_role.strip().capitalize()
    if cleaned in ROLE_PERMISSIONS:
        return cleaned
    raise api_error(
        "INVALID_ROLE",
        f"Role '{raw_role}' is not valid. Choose Director, Manager, or Engineer.",
        400,
    )


def build_role_user(role_name: str, organization_id: UUID) -> CurrentUser:
    canonical = resolve_role_name(role_name)
    meta = ROLE_METADATA[canonical]
    return CurrentUser(
        id=UUID(meta["user_id"]),
        email=meta["email"],
        organization_id=organization_id,
        role_id=UUID(meta["role_id"]),
        permissions=ROLE_PERMISSIONS[canonical],
        role_name=canonical,
        full_name=meta["full_name"],
        employee_code=meta["employee_code"],
    )


def require_permission(
    user: CurrentUser,
    permission: Permission | str,
    granted: set[str] | frozenset[str] | None = None,
) -> None:
    effective = granted if granted is not None else user.permissions
    perm_key = permission.value if isinstance(permission, Permission) else str(permission)
    if perm_key not in effective:
        role_label = user.role_name or "current role"
        raise api_error(
            "FORBIDDEN",
            f"Your active role ({role_label}) does not have permission '{perm_key}' for this action.",
            403,
        )
