from uuid import UUID
from app.core.errors import api_error
from app.core.security import CurrentUser
from app.repositories.task_repository import TaskRepository
from app.schemas.tasks import TaskCreate, TimerCreate

class TaskService:
    def __init__(self, repository: TaskRepository): self.repository = repository
    def _org(self, user: CurrentUser) -> UUID:
        if not user.organization_id: raise api_error("ORG_CONTEXT_REQUIRED", "An organization context is required.", 403)
        return user.organization_id
    async def list(self, user: CurrentUser, page: int, page_size: int): return await self.repository.list(self._org(user), page, page_size)
    async def create(self, user: CurrentUser, payload: TaskCreate):
        if "task.write" not in user.permissions: raise api_error("FORBIDDEN", "You do not have permission to create work items.", 403)
        organization_id = self._org(user)
        if not await self.repository.belongs_to_organization("projects", payload.project_id, organization_id):
            raise api_error("PROJECT_NOT_FOUND", "Project could not be found.", 404)
        if payload.villa_id and not await self.repository.villa_belongs_to_project(payload.villa_id, payload.project_id, organization_id):
            raise api_error("VILLA_NOT_FOUND", "Villa could not be found within this project.", 404)
        return await self.repository.create(organization_id, user.id, payload)
    async def create_timer(self, user: CurrentUser, task_id: UUID, payload: TimerCreate):
        if "timer.manage" not in user.permissions: raise api_error("FORBIDDEN", "You do not have permission to manage task timers.", 403)
        organization_id = self._org(user)
        if not await self.repository.belongs_to_organization("tasks", task_id, organization_id):
            raise api_error("TASK_NOT_FOUND", "Task could not be found.", 404)
        return await self.repository.create_timer(organization_id, task_id, user.id, payload)
