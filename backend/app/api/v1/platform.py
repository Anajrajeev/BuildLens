from datetime import date, datetime, timezone
from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.errors import api_error
from app.core.security import CurrentUser, get_current_user
from app.repositories.platform_repository import PlatformRepository
from app.services.platform_service import PlatformService

router = APIRouter(tags=["operations-platform"])
repository = PlatformRepository()
service = PlatformService(repository)


def body(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json", exclude_none=True)


class TaskStatusUpdate(BaseModel):
    status: Literal["NOT_STARTED", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "PENDING_INSPECTION", "REWORK_REQUIRED", "COMPLETED", "CANCELLED"]
    reason: str | None = Field(default=None, max_length=1000)


class ProgressCreate(BaseModel):
    new_progress: float = Field(ge=0, le=100)
    quantity_completed: float = Field(default=0, ge=0)
    unit: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=2000)
    employee_id: UUID | None = None
    vendor_id: UUID | None = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class InspectionCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    task_id: UUID | None = None
    template_id: UUID | None = None
    inspector_id: UUID | None = None
    scheduled_at: datetime | None = None
    inspection_type: str = Field(default="GENERAL", min_length=2, max_length=120)
    notes: str | None = Field(default=None, max_length=2000)


class InspectionUpdate(BaseModel):
    status: Literal["PENDING", "IN_PROGRESS", "PASSED", "FAILED", "REWORK_REQUIRED", "CANCELLED"]
    notes: str | None = Field(default=None, max_length=2000)


class SnagCreate(BaseModel):
    project_id: UUID
    villa_id: UUID
    task_id: UUID | None = None
    title: str = Field(min_length=2, max_length=240)
    description: str = Field(min_length=2, max_length=4000)
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    assigned_employee_id: UUID | None = None
    assigned_vendor_id: UUID | None = None
    due_at: datetime | None = None
    location_label: str | None = Field(default=None, max_length=240)


class SnagUpdate(BaseModel):
    status: Literal["OPEN", "ASSIGNED", "IN_PROGRESS", "READY_FOR_VERIFICATION", "VERIFIED", "CLOSED", "REJECTED"]
    resolution_notes: str | None = Field(default=None, max_length=2000)


class DailyReportCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    report_date: date
    weather: str | None = Field(default=None, max_length=120)
    workforce_count: int = Field(default=0, ge=0)
    summary: str = Field(min_length=2, max_length=6000)
    constraints: str | None = Field(default=None, max_length=4000)


class SafetyCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    observation_type: Literal["OBSERVATION", "INCIDENT", "NEAR_MISS", "TOOLBOX_TALK", "PERMIT"] = "OBSERVATION"
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    description: str = Field(min_length=2, max_length=4000)
    corrective_action: str | None = Field(default=None, max_length=4000)
    due_at: datetime | None = None


class MaterialCreate(BaseModel):
    product_id: UUID
    project_id: UUID
    quantity_on_hand: float = Field(default=0, ge=0)
    reorder_level: float | None = Field(default=None, ge=0)
    unit_cost: float | None = Field(default=None, ge=0)


class StockMovementCreate(BaseModel):
    project_id: UUID
    movement_type: Literal["RECEIPT", "ISSUE", "RETURN", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT"]
    quantity: float = Field(gt=0)
    villa_id: UUID | None = None
    task_id: UUID | None = None
    reference: str | None = Field(default=None, max_length=240)
    notes: str | None = Field(default=None, max_length=2000)


class PurchaseOrderCreate(BaseModel):
    supplier_id: UUID
    project_id: UUID
    po_number: str = Field(min_length=1, max_length=80)
    expected_at: date | None = None
    total_amount: float | None = Field(default=None, ge=0)


class CommitmentCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    task_id: UUID | None = None
    promised_date: date
    quantity: float | None = Field(default=None, ge=0)
    status: str = Field(default="OPEN", max_length=40)


class WirCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    task_id: UUID
    vendor_id: UUID
    description: str = Field(min_length=2, max_length=4000)
    requested_at: datetime | None = None


class WirUpdate(BaseModel):
    status: Literal["DRAFT", "SUBMITTED", "INSPECTION_SCHEDULED", "APPROVED", "REJECTED", "REWORK_REQUIRED"]
    reviewer_notes: str | None = Field(default=None, max_length=2000)


class DocumentCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    entity_type: str = Field(min_length=2, max_length=80)
    entity_id: UUID
    storage_path: str = Field(min_length=2, max_length=1000)
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=2, max_length=120)
    size_bytes: int = Field(ge=0)
    document_type: str | None = Field(default=None, max_length=120)
    revision: str | None = Field(default=None, max_length=40)


class HandoverCreate(BaseModel):
    project_id: UUID
    villa_id: UUID
    target_date: date | None = None
    customer_name: str | None = Field(default=None, max_length=240)
    notes: str | None = Field(default=None, max_length=4000)


class HandoverUpdate(BaseModel):
    status: Literal["NOT_READY", "IN_REVIEW", "READY", "CUSTOMER_INSPECTION", "HANDED_OVER"]
    readiness_score: float = Field(ge=0, le=100)
    notes: str | None = Field(default=None, max_length=4000)


class BriefingRequest(BaseModel):
    project_id: UUID | None = None
    question: str = Field(default="What needs attention today?", min_length=2, max_length=1000)


class ChecklistTemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=240)
    category: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ChecklistItemCreate(BaseModel):
    label: str = Field(min_length=2, max_length=500)
    sort_order: int = Field(default=0, ge=0)
    required: bool = True
    evidence_required: bool = False


class LevelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    level_number: int


class RoomCreate(BaseModel):
    level_id: UUID | None = None
    room_type: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    area: float | None = Field(default=None, ge=0)
    area_unit: str = Field(default="SQFT", max_length=20)
    specifications: dict[str, Any] = Field(default_factory=dict)


class SafetyUpdate(BaseModel):
    status: Literal["OPEN", "ACTIONED", "CLOSED"]
    corrective_action: str | None = Field(default=None, max_length=4000)


class PurchaseOrderItemCreate(BaseModel):
    product_id: UUID
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class VendorScoreCreate(BaseModel):
    measured_on: date
    on_time_score: float = Field(ge=0, le=100)
    quality_score: float = Field(ge=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)


class DrawingAcknowledgementCreate(BaseModel):
    notes: str | None = Field(default=None, max_length=1000)


class HandoverItemCreate(BaseModel):
    category: str = Field(min_length=2, max_length=120)
    label: str = Field(min_length=2, max_length=500)
    required: bool = True


class HandoverItemUpdate(BaseModel):
    status: Literal["PENDING", "READY", "ACCEPTED", "REJECTED"]
    notes: str | None = Field(default=None, max_length=2000)


class TaskAssignmentCreate(BaseModel):
    employee_id: UUID | None = None
    team_id: UUID | None = None
    vendor_id: UUID | None = None


class TaskDependencyCreate(BaseModel):
    depends_on_task_id: UUID
    dependency_status: str = Field(default="REQUIRED", max_length=40)


class TimerAction(BaseModel):
    action: Literal["START", "PAUSE", "RESUME", "COMPLETE"]
    reason: str | None = Field(default=None, max_length=1000)


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    leader_employee_id: UUID | None = None


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=240)
    sku: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=120)
    unit: str = Field(min_length=1, max_length=30)


class SupplierCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=240)
    contact_name: str | None = Field(default=None, max_length=240)
    phone: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=320)


class DelayCreate(BaseModel):
    task_id: UUID | None = None
    villa_id: UUID | None = None
    reason_id: UUID | None = None
    started_at: datetime
    notes: str | None = Field(default=None, max_length=2000)


class DelayUpdate(BaseModel):
    status: Literal["OPEN", "RESOLVED"]
    resolved_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=2000)


@router.get("/dashboard")
async def dashboard(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    return await service.dashboard(user, project_id)


@router.get("/agenda")
async def agenda(project_id: UUID | None = None, villa_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters: dict[str, str] = {"status": "not.in.(COMPLETED,CANCELLED)"}
    if project_id:
        filters["project_id"] = f"eq.{project_id}"
    if villa_id:
        filters["villa_id"] = f"eq.{villa_id}"
    items = await service.list(user, "tasks", filters=filters, order="priority.desc,planned_end_at.asc.nullslast", limit=300)
    return {"items": items}


@router.patch("/tasks/{task_id}/status")
async def set_task_status(task_id: UUID, payload: TaskStatusUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    values: dict[str, Any] = {"status": payload.status, "updated_by": str(user.id)}
    if payload.status == "IN_PROGRESS":
        values["actual_start_at"] = datetime.now(timezone.utc).isoformat()
    if payload.status == "COMPLETED":
        values.update({"progress": 100, "actual_end_at": datetime.now(timezone.utc).isoformat()})
    record = await service.update(user, "tasks", task_id, values, request.headers.get("X-Request-ID"))
    if payload.reason:
        await service.create(user, "task_comments", {"task_id": str(task_id), "body": payload.reason, "created_by": str(user.id)}, request.headers.get("X-Request-ID"))
    return record


@router.post("/tasks/{task_id}/progress", status_code=201)
async def add_progress(task_id: UUID, payload: ProgressCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    current = await repository.get("tasks", service.org(user), task_id, "id,progress")
    previous = float(current.get("progress") or 0) if current else 0
    progress = await service.create(user, "progress_updates", {**body(payload), "task_id": str(task_id), "previous_progress": previous, "created_by": str(user.id)}, request.headers.get("X-Request-ID"))
    await service.update(user, "tasks", task_id, {"progress": payload.new_progress, "updated_by": str(user.id)}, request.headers.get("X-Request-ID"))
    return progress


@router.post("/tasks/{task_id}/comments", status_code=201)
async def add_comment(task_id: UUID, payload: CommentCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "task_comments", {"task_id": str(task_id), "body": payload.body, "created_by": str(user.id)}, request.headers.get("X-Request-ID"))


@router.get("/tasks/{task_id}/history")
async def task_history(task_id: UUID, user: CurrentUser = Depends(get_current_user)):
    progress = await service.list(user, "progress_updates", filters={"task_id": f"eq.{task_id}"}, order="created_at.desc", limit=200)
    comments = await service.list(user, "task_comments", filters={"task_id": f"eq.{task_id}"}, order="created_at.desc", limit=200)
    timers = await service.list(user, "task_time_trackers", filters={"task_id": f"eq.{task_id}"}, limit=1)
    events = await service.list(user, "task_time_events", filters={"tracker_id": f"eq.{timers[0]['id']}"}, order="occurred_at.desc", limit=200) if timers else []
    return {"progress": progress, "comments": comments, "timer": timers[0] if timers else None, "timer_events": events}


@router.post("/tasks/{task_id}/assignments", status_code=201)
async def create_task_assignment(task_id: UUID, payload: TaskAssignmentCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    if sum(value is not None for value in (payload.employee_id, payload.team_id, payload.vendor_id)) != 1:
        raise api_error("INVALID_ASSIGNMENT", "Exactly one employee, team, or vendor is required.", 422)
    return await service.create(user, "task_assignments", {**body(payload), "task_id": str(task_id)}, request.headers.get("X-Request-ID"))


@router.get("/tasks/{task_id}/assignments")
async def task_assignments(task_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "task_assignments", filters={"task_id": f"eq.{task_id}"}, order="assigned_at.desc", limit=100)}


@router.post("/tasks/{task_id}/dependencies", status_code=201)
async def create_task_dependency(task_id: UUID, payload: TaskDependencyCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    if task_id == payload.depends_on_task_id:
        raise api_error("INVALID_DEPENDENCY", "A task cannot depend on itself.", 422)
    return await service.create(user, "task_dependencies", {**body(payload), "task_id": str(task_id)}, request.headers.get("X-Request-ID"))


@router.post("/tasks/{task_id}/timer-action")
async def timer_action(task_id: UUID, payload: TimerAction, request: Request, user: CurrentUser = Depends(get_current_user)):
    trackers = await service.list(user, "task_time_trackers", filters={"task_id": f"eq.{task_id}"}, limit=1)
    if not trackers:
        raise api_error("TIMER_NOT_FOUND", "Create a timer before using timer actions.", 404)
    tracker = trackers[0]
    status = {"START": "RUNNING", "PAUSE": "PAUSED", "RESUME": "RUNNING", "COMPLETE": "COMPLETED"}[payload.action]
    values: dict[str, Any] = {"status": status, "updated_by": str(user.id)}
    now = datetime.now(timezone.utc).isoformat()
    if payload.action == "START" and not tracker.get("started_at"):
        values["started_at"] = now
    if payload.action == "COMPLETE":
        values["completed_at"] = now
    updated = await service.update(user, "task_time_trackers", UUID(tracker["id"]), values, request.headers.get("X-Request-ID"))
    event_type = {"START": "STARTED", "PAUSE": "PAUSED", "RESUME": "RESUMED", "COMPLETE": "COMPLETED"}[payload.action]
    await service.create(user, "task_time_events", {"tracker_id": tracker["id"], "event_type": event_type, "actor_id": str(user.id), "previous_value": {"status": tracker.get("status")}, "new_value": {"status": status}, "reason": payload.reason}, request.headers.get("X-Request-ID"))
    if payload.action in {"START", "COMPLETE"}:
        await set_task_status(task_id, TaskStatusUpdate(status="IN_PROGRESS" if payload.action == "START" else "COMPLETED"), request, user)
    return updated


@router.get("/quality/inspections")
async def inspections(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "inspections", filters=filters, order="scheduled_at.asc.nullslast", limit=300)}


@router.post("/quality/inspections", status_code=201)
async def create_inspection(payload: InspectionCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "inspections", body(payload), request.headers.get("X-Request-ID"))


@router.patch("/quality/inspections/{inspection_id}")
async def update_inspection(inspection_id: UUID, payload: InspectionUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    values = body(payload)
    if payload.status in {"PASSED", "FAILED", "REWORK_REQUIRED"}:
        values["completed_at"] = datetime.now(timezone.utc).isoformat()
    return await service.update(user, "inspections", inspection_id, values, request.headers.get("X-Request-ID"))


@router.get("/quality/snags")
async def snags(project_id: UUID | None = None, villa_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters: dict[str, str] = {}
    if project_id:
        filters["project_id"] = f"eq.{project_id}"
    if villa_id:
        filters["villa_id"] = f"eq.{villa_id}"
    return {"items": await service.list(user, "snags", filters=filters or None, order="created_at.desc", limit=300)}


@router.post("/quality/snags", status_code=201)
async def create_snag(payload: SnagCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "snags", body(payload), request.headers.get("X-Request-ID"))


@router.patch("/quality/snags/{snag_id}")
async def update_snag(snag_id: UUID, payload: SnagUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    values = body(payload)
    if payload.status in {"CLOSED", "VERIFIED"}:
        values["closed_at"] = datetime.now(timezone.utc).isoformat()
    return await service.update(user, "snags", snag_id, values, request.headers.get("X-Request-ID"))


@router.get("/daily-reports")
async def daily_reports(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "daily_reports", filters=filters, order="report_date.desc", limit=100)}


@router.post("/daily-reports", status_code=201)
async def create_daily_report(payload: DailyReportCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "daily_reports", {**body(payload), "created_by": str(user.id)}, request.headers.get("X-Request-ID"))


@router.get("/safety")
async def safety(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "safety_observations", filters=filters, order="created_at.desc", limit=200)}


@router.post("/safety", status_code=201)
async def create_safety(payload: SafetyCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "safety_observations", {**body(payload), "reported_by": str(user.id)}, request.headers.get("X-Request-ID"))


@router.get("/materials")
async def materials(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    items = await service.list(user, "materials", select="*,products(name,sku,category,unit)", filters=filters, order="updated_at.desc", limit=300)
    return {"items": items}


@router.post("/materials", status_code=201)
async def create_material(payload: MaterialCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "materials", body(payload), request.headers.get("X-Request-ID"))


@router.post("/materials/{material_id}/movements", status_code=201)
async def move_material(material_id: UUID, payload: StockMovementCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    material = await repository.get("materials", service.org(user), material_id, "id,quantity_on_hand")
    current = float(material.get("quantity_on_hand") or 0) if material else 0
    delta = payload.quantity if payload.movement_type in {"RECEIPT", "RETURN", "TRANSFER_IN"} else -payload.quantity
    if payload.movement_type == "ADJUSTMENT":
        delta = payload.quantity
    movement = await service.create(user, "stock_movements", {**body(payload), "material_id": str(material_id), "recorded_by": str(user.id)}, request.headers.get("X-Request-ID"))
    await service.update(user, "materials", material_id, {"quantity_on_hand": max(0, current + delta)}, request.headers.get("X-Request-ID"))
    return movement


@router.get("/procurement/purchase-orders")
async def purchase_orders(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "purchase_orders", select="*,suppliers(company_name)", filters=filters, order="ordered_at.desc.nullslast", limit=200)}


@router.post("/procurement/purchase-orders", status_code=201)
async def create_purchase_order(payload: PurchaseOrderCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "purchase_orders", {**body(payload), "ordered_at": datetime.now(timezone.utc).isoformat()}, request.headers.get("X-Request-ID"))


@router.get("/vendors/{vendor_id}/commitments")
async def commitments(vendor_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "vendor_commitments", filters={"vendor_id": f"eq.{vendor_id}"}, order="promised_date.asc", limit=200)}


@router.post("/vendors/{vendor_id}/commitments", status_code=201)
async def create_commitment(vendor_id: UUID, payload: CommitmentCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "vendor_commitments", {**body(payload), "vendor_id": str(vendor_id)}, request.headers.get("X-Request-ID"))


@router.get("/wirs")
async def wirs(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "work_inspection_requests", filters=filters, order="created_at.desc", limit=300)}


@router.post("/wirs", status_code=201)
async def create_wir(payload: WirCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "work_inspection_requests", {**body(payload), "requested_by": str(user.id)}, request.headers.get("X-Request-ID"))


@router.patch("/wirs/{wir_id}")
async def update_wir(wir_id: UUID, payload: WirUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.update(user, "work_inspection_requests", wir_id, body(payload), request.headers.get("X-Request-ID"))


@router.get("/drawings")
async def drawings(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "villa_documents", filters=filters, order="uploaded_at.desc", limit=200)}


@router.post("/documents/register", status_code=201)
async def register_document(payload: DocumentCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    attachment = await service.create(user, "attachments", {"entity_type": payload.entity_type, "entity_id": str(payload.entity_id), "storage_path": payload.storage_path, "file_name": payload.file_name, "mime_type": payload.mime_type, "size_bytes": payload.size_bytes, "uploaded_by": str(user.id)}, request.headers.get("X-Request-ID"))
    if payload.document_type and payload.villa_id:
        await service.create(user, "villa_documents", {"villa_id": str(payload.villa_id), "project_id": str(payload.project_id), "attachment_id": attachment["id"], "document_type": payload.document_type, "version": payload.revision or "1", "revision": payload.revision, "uploaded_by": str(user.id)}, request.headers.get("X-Request-ID"))
    return attachment


@router.get("/handovers")
async def handovers(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters = {"project_id": f"eq.{project_id}"} if project_id else None
    return {"items": await service.list(user, "handover_packages", filters=filters, order="target_date.asc.nullslast", limit=300)}


@router.post("/handovers", status_code=201)
async def create_handover(payload: HandoverCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "handover_packages", body(payload), request.headers.get("X-Request-ID"))


@router.patch("/handovers/{handover_id}")
async def update_handover(handover_id: UUID, payload: HandoverUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    values = body(payload)
    if payload.status == "HANDED_OVER":
        values["handed_over_at"] = datetime.now(timezone.utc).isoformat()
    return await service.update(user, "handover_packages", handover_id, values, request.headers.get("X-Request-ID"))


@router.get("/notifications")
async def notifications(unread_only: bool = False, user: CurrentUser = Depends(get_current_user)):
    filters = {"user_id": f"eq.{user.id}"}
    if unread_only:
        filters["read_at"] = "is.null"
    return {"items": await service.list(user, "notifications", filters=filters, order="created_at.desc", limit=100)}


@router.patch("/notifications/{notification_id}/read")
async def read_notification(notification_id: UUID, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.update(user, "notifications", notification_id, {"read_at": datetime.now(timezone.utc).isoformat()}, request.headers.get("X-Request-ID"))


@router.get("/reports/overview")
async def report_overview(project_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    return await service.dashboard(user, project_id)


@router.get("/teams")
async def teams(user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "teams", order="name.asc", limit=300)}


@router.post("/teams", status_code=201)
async def create_team(payload: TeamCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "teams", body(payload), request.headers.get("X-Request-ID"))


@router.get("/catalog/products")
async def products(user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "products", order="name.asc", limit=500)}


@router.post("/catalog/products", status_code=201)
async def create_product(payload: ProductCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "products", body(payload), request.headers.get("X-Request-ID"))


@router.get("/catalog/suppliers")
async def suppliers(user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "suppliers", order="company_name.asc", limit=500)}


@router.post("/catalog/suppliers", status_code=201)
async def create_supplier(payload: SupplierCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "suppliers", body(payload), request.headers.get("X-Request-ID"))


@router.get("/delays")
async def delays(user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "delay_events", order="started_at.desc", limit=300)}


@router.post("/delays", status_code=201)
async def create_delay(payload: DelayCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "delay_events", body(payload), request.headers.get("X-Request-ID"))


@router.patch("/delays/{delay_id}")
async def update_delay(delay_id: UUID, payload: DelayUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.update(user, "delay_events", delay_id, body(payload), request.headers.get("X-Request-ID"))


@router.get("/activity")
async def activity(entity_type: str | None = None, entity_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    filters: dict[str, str] = {}
    if entity_type:
        filters["entity_type"] = f"eq.{entity_type}"
    if entity_id:
        filters["entity_id"] = f"eq.{entity_id}"
    return {"items": await service.list(user, "activity_events", filters=filters or None, order="occurred_at.desc", limit=300)}


@router.get("/checklists/templates")
async def checklist_templates(user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "checklist_templates", order="name.asc", limit=300)}


@router.post("/checklists/templates", status_code=201)
async def create_checklist_template(payload: ChecklistTemplateCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "checklist_templates", {**body(payload), "created_by": str(user.id)}, request.headers.get("X-Request-ID"))


@router.get("/checklists/templates/{template_id}/items")
async def checklist_items(template_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "checklist_template_items", filters={"template_id": f"eq.{template_id}"}, order="sequence.asc", limit=300)}


@router.post("/checklists/templates/{template_id}/items", status_code=201)
async def create_checklist_item(template_id: UUID, payload: ChecklistItemCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "checklist_template_items", {**body(payload), "template_id": str(template_id)}, request.headers.get("X-Request-ID"))


@router.get("/villas/{villa_id}/levels")
async def villa_levels(villa_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "villa_levels", filters={"villa_id": f"eq.{villa_id}"}, order="level_number.asc", limit=100)}


@router.post("/villas/{villa_id}/levels", status_code=201)
async def create_villa_level(villa_id: UUID, payload: LevelCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "villa_levels", {**body(payload), "villa_id": str(villa_id)}, request.headers.get("X-Request-ID"))


@router.get("/villas/{villa_id}/rooms")
async def villa_rooms(villa_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "villa_rooms", filters={"villa_id": f"eq.{villa_id}"}, order="name.asc", limit=300)}


@router.post("/villas/{villa_id}/rooms", status_code=201)
async def create_villa_room(villa_id: UUID, payload: RoomCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "villa_rooms", {**body(payload), "villa_id": str(villa_id)}, request.headers.get("X-Request-ID"))


@router.patch("/safety/{observation_id}")
async def update_safety(observation_id: UUID, payload: SafetyUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    values = body(payload)
    if payload.status == "CLOSED":
        values["closed_at"] = datetime.now(timezone.utc).isoformat()
    return await service.update(user, "safety_observations", observation_id, values, request.headers.get("X-Request-ID"))


@router.get("/procurement/purchase-orders/{purchase_order_id}/items")
async def purchase_order_items(purchase_order_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "purchase_order_items", select="*,products(name,sku,unit)", filters={"purchase_order_id": f"eq.{purchase_order_id}"}, limit=300)}


@router.post("/procurement/purchase-orders/{purchase_order_id}/items", status_code=201)
async def create_purchase_order_item(purchase_order_id: UUID, payload: PurchaseOrderItemCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "purchase_order_items", {**body(payload), "purchase_order_id": str(purchase_order_id)}, request.headers.get("X-Request-ID"))


@router.get("/vendors/{vendor_id}/performance")
async def vendor_performance(vendor_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "vendor_performance", filters={"vendor_id": f"eq.{vendor_id}"}, order="measured_on.desc", limit=100)}


@router.post("/vendors/{vendor_id}/performance", status_code=201)
async def create_vendor_performance(vendor_id: UUID, payload: VendorScoreCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "vendor_performance", {**body(payload), "vendor_id": str(vendor_id)}, request.headers.get("X-Request-ID"))


@router.get("/drawings/revisions/{revision_id}/acknowledgements")
async def drawing_acknowledgements(revision_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "drawing_acknowledgements", filters={"drawing_revision_id": f"eq.{revision_id}"}, order="acknowledged_at.desc", limit=300)}


@router.post("/drawings/revisions/{revision_id}/acknowledgements", status_code=201)
async def acknowledge_drawing(revision_id: UUID, payload: DrawingAcknowledgementCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "drawing_acknowledgements", {"drawing_revision_id": str(revision_id), "user_id": str(user.id), **body(payload)}, request.headers.get("X-Request-ID"))


@router.get("/handovers/{handover_id}/items")
async def handover_items(handover_id: UUID, user: CurrentUser = Depends(get_current_user)):
    return {"items": await service.list(user, "handover_items", filters={"handover_id": f"eq.{handover_id}"}, order="category.asc,label.asc", limit=500)}


@router.post("/handovers/{handover_id}/items", status_code=201)
async def create_handover_item(handover_id: UUID, payload: HandoverItemCreate, request: Request, user: CurrentUser = Depends(get_current_user)):
    return await service.create(user, "handover_items", {**body(payload), "handover_id": str(handover_id)}, request.headers.get("X-Request-ID"))


@router.patch("/handovers/items/{item_id}")
async def update_handover_item(item_id: UUID, payload: HandoverItemUpdate, request: Request, user: CurrentUser = Depends(get_current_user)):
    values = {**body(payload), "completed_at": datetime.now(timezone.utc).isoformat() if payload.status in {"READY", "ACCEPTED"} else None, "completed_by": str(user.id) if payload.status in {"READY", "ACCEPTED"} else None}
    return await service.update(user, "handover_items", item_id, values, request.headers.get("X-Request-ID"))


@router.post("/ai/briefing")
async def ai_briefing(payload: BriefingRequest, request: Request, user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    context, deterministic = await service.deterministic_briefing(user, payload.project_id)
    answer = deterministic
    mode = "rules"
    model = None
    if settings.gemini_api_key:
        prompt = f"User question: {payload.question}\nOperational context: {context}\nProvide a concise site operations briefing. Cite figures from the context. Never invent facts, approvals, or completed work."
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}",
                    json={"system_instruction": {"parts": [{"text": "You are BuildLens's construction operations analyst. Use only the supplied operational context. Identify risks, owners to confirm, and next actions. Human approval is required for every operational change."}]}, "contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"maxOutputTokens": 700}},
                )
                response.raise_for_status()
            result = response.json()
            texts = [part.get("text", "") for candidate in result.get("candidates", []) for part in candidate.get("content", {}).get("parts", [])]
            if texts:
                answer = "\n".join(texts)
                mode = "gemini"
                model = result.get("model", settings.gemini_model)
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            mode = "rules-fallback"
    run = await service.create(user, "ai_runs", {"project_id": str(payload.project_id) if payload.project_id else None, "run_type": "OPERATIONS_BRIEFING", "question": payload.question, "answer": answer, "model": model or "deterministic-v1", "citations": context["metrics"], "created_by": str(user.id)}, request.headers.get("X-Request-ID"))
    return {"answer": answer, "mode": mode, "model": model, "metrics": context["metrics"], "run_id": run["id"]}
