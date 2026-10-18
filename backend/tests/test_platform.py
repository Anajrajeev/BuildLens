from uuid import uuid4

import pytest

from app.core.security import CurrentUser
from app.main import app
from app.services.platform_service import PlatformService


class FakeRepository:
    async def list(self, table, organization_id, **kwargs):
        records = {
            "tasks": [
                {"id": "1", "title": "Late work", "status": "IN_PROGRESS", "progress": 20, "planned_end_at": "2020-01-01T00:00:00Z"},
                {"id": "2", "title": "Blocked work", "status": "BLOCKED", "progress": 40, "planned_end_at": None},
            ],
            "villas": [{"id": "v1"}],
            "snags": [{"id": "s1", "title": "Paint defect", "status": "OPEN"}],
            "inspections": [{"id": "i1", "status": "PENDING"}],
            "materials": [{"id": "m1", "quantity_on_hand": 2, "reorder_level": 5, "products": {"name": "Cement"}}],
        }
        return records.get(table, [])


@pytest.mark.anyio
async def test_dashboard_aggregates_attention_signals():
    service = PlatformService(FakeRepository())
    user = CurrentUser(id=uuid4(), email="site@example.com", organization_id=uuid4())

    result = await service.dashboard(user)

    assert result["metrics"]["tasks_total"] == 2
    assert result["metrics"]["average_progress"] == 30
    assert result["metrics"]["overdue"] == 1
    assert result["metrics"]["blocked"] == 1
    assert result["metrics"]["open_snags"] == 1
    assert result["metrics"]["low_stock_items"] == 1
    assert {item["type"] for item in result["exceptions"]} == {"overdue_task", "blocked_task", "open_snag", "low_stock"}


def test_operational_contract_is_published():
    paths = app.openapi()["paths"]
    expected = {
        "/api/v1/agenda",
        "/api/v1/quality/inspections",
        "/api/v1/quality/snags",
        "/api/v1/daily-reports",
        "/api/v1/safety",
        "/api/v1/materials",
        "/api/v1/procurement/purchase-orders",
        "/api/v1/wirs",
        "/api/v1/drawings",
        "/api/v1/handovers",
        "/api/v1/checklists/templates",
        "/api/v1/ai/briefing",
    }
    assert expected <= set(paths)
