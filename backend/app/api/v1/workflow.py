from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, model_validator

from app.core.errors import api_error
from app.core.security import CurrentUser, get_current_user
from app.core.seed_store import SCHEDULE_CONFIG
from app.repositories.platform_repository import PlatformRepository

router = APIRouter(prefix="/workflow", tags=["workflow"])
repository = PlatformRepository()


class WorkflowUpdate(BaseModel):
    villa_id: UUID
    activity_key: str = Field(pattern=r"^(elle-0(0[1-9]|[1-8][0-9])|custom-act-[a-zA-Z0-9-]+)$")
    revision: int = Field(ge=1)
    status: Literal["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REWORK_REQUIRED", "COMPLETED"]
    progress: int = Field(ge=0, le=100)
    note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def validate_progress(self):
        if self.status == "COMPLETED" and self.progress != 100:
            raise ValueError("Completed work must be 100%.")
        if self.status == "NOT_STARTED" and self.progress != 0:
            raise ValueError("Work not started must be 0%.")
        if self.status not in {"COMPLETED", "NOT_STARTED"} and self.progress == 100:
            raise ValueError("Open work must be below 100%.")
        if self.status == "REWORK_REQUIRED" and not self.note.strip():
            raise ValueError("Explain why the work is being redone.")
        return self


class ScheduleConfigUpdate(BaseModel):
    activityId: str | None = None
    override: dict[str, Any] | None = None
    customActivity: dict[str, Any] | None = None


@router.get("/schedule-config")
async def get_schedule_config(user: CurrentUser = Depends(get_current_user)):
    if "villa.read.all" not in user.permissions:
        raise api_error("FORBIDDEN", "You do not have permission to view workflow schedules.", 403)
    return SCHEDULE_CONFIG


@router.post("/schedule-config")
async def update_schedule_config(payload: ScheduleConfigUpdate, user: CurrentUser = Depends(get_current_user)):
    if not ({"task.write", "villa.write", "rework.approve", "project.write"} & set(user.permissions)):
        raise api_error("FORBIDDEN", "You do not have permission to update workflow schedule configuration.", 403)
    if payload.activityId and payload.override:
        SCHEDULE_CONFIG["activityOverrides"][payload.activityId] = payload.override
    if payload.customActivity:
        SCHEDULE_CONFIG["customActivities"].append(payload.customActivity)
    return SCHEDULE_CONFIG


async def check_project(user, project_id):
    if not user.organization_id or not await repository.get("projects", user.organization_id, project_id):
        raise api_error("NOT_FOUND", "Project not found.", 404)


@router.get("/{project_id}")
async def get_workflow(
    project_id: UUID,
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    if "villa.read.all" not in user.permissions:
        raise api_error("FORBIDDEN", "You do not have permission to view villa workflows.", 403)
    await check_project(user, project_id)
    rows = await repository.list(
        "villa_workflow_events",
        user.organization_id,
        filters={"project_id": f"eq.{project_id}", "offset": str(offset)},
        order="created_at.asc,id.asc",
        limit=500,
    )
    return {"items": rows, "next_offset": offset + 500 if len(rows) == 500 else None}


@router.post("/{project_id}", status_code=201)
async def update_workflow(
    project_id: UUID,
    payload: WorkflowUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    has_task_write = "task.write" in user.permissions
    has_rework_approve = "rework.approve" in user.permissions
    if not has_task_write and not has_rework_approve:
        raise api_error("FORBIDDEN", "You do not have permission to update work.", 403)
    await check_project(user, project_id)
    villa = await repository.get("villas", user.organization_id, payload.villa_id)
    if not villa or villa["project_id"] != str(project_id):
        raise api_error("NOT_FOUND", "Villa not found in this project.", 404)
    previous = await repository.list(
        "villa_workflow_events",
        user.organization_id,
        filters={"villa_id": f"eq.{payload.villa_id}", "activity_key": f"eq.{payload.activity_key}"},
        order="revision.desc",
        limit=1,
    )
    latest = max(previous, key=lambda r: int(r.get("revision", 0))) if previous else None
    if not has_task_write and has_rework_approve:
        if not latest or latest.get("status") != "REWORK_REQUIRED":
            raise api_error(
                "FORBIDDEN",
                "Manager role can only approve activities currently flagged as REWORK_REQUIRED.",
                403,
            )
    if payload.revision != (int(latest["revision"]) if latest else 0) + 1:
        raise api_error("WORKFLOW_CONFLICT", "This activity changed. Refresh before saving again.", 409)
    try:
        return await repository.create(
            "villa_workflow_events",
            user.organization_id,
            {**payload.model_dump(mode="json"), "project_id": str(project_id), "actor_id": str(user.id)},
        )
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 409:
            raise api_error("WORKFLOW_CONFLICT", "Another update was saved. Refresh before saving again.", 409)
        raise
