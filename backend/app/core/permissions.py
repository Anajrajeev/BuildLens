from enum import StrEnum
from app.core.errors import api_error
from app.core.security import CurrentUser

class Permission(StrEnum):
    PROJECT_READ = "project.read"
    PROJECT_WRITE = "project.write"
    VILLA_READ = "villa.read"
    TASK_READ = "task.read"
    TASK_WRITE = "task.write"
    TIMER_MANAGE = "timer.manage"

def require_permission(user: CurrentUser, permission: Permission, granted: set[str]) -> None:
    if permission not in granted:
        raise api_error("FORBIDDEN", "You do not have permission for this action.", 403)
