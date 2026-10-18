from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.core.errors import api_error
from app.core.security import CurrentUser
from app.repositories.platform_repository import PlatformRepository


class PlatformService:
    def __init__(self, repository: PlatformRepository):
        self.repository = repository

    @staticmethod
    def org(user: CurrentUser) -> UUID:
        if user.organization_id is None:
            raise api_error("ORG_CONTEXT_REQUIRED", "An organization context is required.", 403)
        return user.organization_id

    async def list(self, user: CurrentUser, table: str, **kwargs: Any) -> list[dict[str, Any]]:
        return await self.repository.list(table, self.org(user), **kwargs)

    async def create(self, user: CurrentUser, table: str, payload: dict[str, Any], request_id: str | None) -> dict[str, Any]:
        record = await self.repository.create(table, self.org(user), payload)
        await self.repository.audit(self.org(user), user.id, f"{table.upper()}_CREATED", table, record.get("id"), record, request_id)
        return record

    async def update(self, user: CurrentUser, table: str, record_id: UUID, payload: dict[str, Any], request_id: str | None) -> dict[str, Any]:
        try:
            record = await self.repository.update(table, self.org(user), record_id, payload)
        except LookupError:
            raise api_error("NOT_FOUND", "The requested record could not be found.", 404)
        await self.repository.audit(self.org(user), user.id, f"{table.upper()}_UPDATED", table, record_id, payload, request_id)
        return record

    async def dashboard(self, user: CurrentUser, project_id: UUID | None = None) -> dict[str, Any]:
        common = {"project_id": f"eq.{project_id}"} if project_id else None
        tasks = await self.list(user, "tasks", filters=common, order="planned_end_at.asc.nullslast", limit=500)
        villas = await self.list(user, "villas", filters=common, limit=500)
        snags = await self.list(user, "snags", filters=common, order="due_at.asc.nullslast", limit=500)
        inspections = await self.list(user, "inspections", filters=common, order="scheduled_at.asc.nullslast", limit=500)
        materials = await self.list(user, "materials", select="id,project_id,quantity_on_hand,reorder_level,products(name,unit)", filters=common, limit=500)
        now = datetime.now(timezone.utc)
        overdue = [task for task in tasks if task.get("planned_end_at") and task.get("status") not in {"COMPLETED", "CANCELLED"} and datetime.fromisoformat(task["planned_end_at"].replace("Z", "+00:00")) < now]
        blocked = [task for task in tasks if task.get("status") in {"BLOCKED", "REWORK_REQUIRED"}]
        low_stock = [item for item in materials if item.get("reorder_level") is not None and float(item.get("quantity_on_hand") or 0) <= float(item["reorder_level"])]
        open_snags = [item for item in snags if item.get("status") not in {"CLOSED", "VERIFIED"}]
        average_progress = round(sum(float(task.get("progress") or 0) for task in tasks) / len(tasks), 1) if tasks else 0
        exceptions = [
            *({"type": "overdue_task", "message": item.get("title") or "Overdue task", "entity_id": item.get("id")} for item in overdue[:8]),
            *({"type": "blocked_task", "message": item.get("title") or "Blocked task", "entity_id": item.get("id")} for item in blocked[:8]),
            *({"type": "open_snag", "message": item.get("title") or item.get("description") or "Open snag", "entity_id": item.get("id")} for item in open_snags[:8]),
            *({"type": "low_stock", "message": ((item.get("products") or {}).get("name") or "Low-stock material"), "entity_id": item.get("id")} for item in low_stock[:8]),
        ]
        return {
            "metrics": {
                "villas": len(villas),
                "tasks": len(tasks),
                "tasks_total": len(tasks),
                "average_progress": average_progress,
                "overdue": len(overdue),
                "blocked": len(blocked),
                "open_snags": len(open_snags),
                "pending_inspections": sum(1 for item in inspections if item.get("status") in {"PENDING", "IN_PROGRESS"}),
                "low_stock": len(low_stock),
                "low_stock_items": len(low_stock),
            },
            "exceptions": exceptions,
            "exception_groups": {
                "overdue_tasks": overdue[:8],
                "blocked_tasks": blocked[:8],
                "open_snags": open_snags[:8],
                "low_stock": low_stock[:8],
            },
        }

    async def deterministic_briefing(self, user: CurrentUser, project_id: UUID | None) -> tuple[dict[str, Any], str]:
        dashboard = await self.dashboard(user, project_id)
        metrics = dashboard["metrics"]
        lines = [
            f"{metrics['tasks']} work items and {metrics['villas']} villas are in the current operating scope.",
            f"Attention is needed on {metrics['overdue']} overdue tasks, {metrics['blocked']} blocked tasks, and {metrics['open_snags']} open snags.",
            f"There are {metrics['pending_inspections']} pending inspections and {metrics['low_stock']} materials at or below reorder level.",
        ]
        if metrics["overdue"] or metrics["blocked"]:
            lines.append("Prioritize blocked and overdue work first, confirm the responsible owner, and record a recovery commitment today.")
        if metrics["open_snags"]:
            lines.append("Review the oldest open snags and verify rectification evidence before allowing dependent finishing work to continue.")
        if metrics["low_stock"]:
            lines.append("Confirm replenishment dates for low-stock materials before releasing dependent work.")
        return dashboard, " ".join(lines)
