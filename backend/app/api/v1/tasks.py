from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.security import CurrentUser, get_current_user
from app.repositories.task_repository import TaskRepository
from app.schemas.common import Page
from app.schemas.tasks import TaskCreate, TaskRead, TimerCreate
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])
repository = TaskRepository()

@router.get("", response_model=Page[TaskRead])
async def list_tasks(page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), user: CurrentUser = Depends(get_current_user)):
    records, total = await TaskService(repository).list(user, page, page_size)
    return Page(items=records, page=page, page_size=page_size, total=total)

@router.post("", response_model=TaskRead, status_code=201)
async def create_task(payload: TaskCreate, user: CurrentUser = Depends(get_current_user)):
    return await TaskService(repository).create(user, payload)

@router.post("/{task_id}/timer", status_code=201)
async def create_timer(task_id: UUID, payload: TimerCreate, user: CurrentUser = Depends(get_current_user)):
    return await TaskService(repository).create_timer(user, task_id, payload)
