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
        "/api/v1/villas/{villa_id}/state",
        "/api/v1/villas/{villa_id}/approve-rework",
        "/api/v1/villas/{villa_id}/edit",
    }
    assert expected <= set(paths)


@pytest.mark.anyio
async def test_backend_rbac_role_permissions_and_enforcement():
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Verify /api/v1/auth/me resolves each role via X-BuildLens-Role header
        director_me = await client.get("/api/v1/auth/me", headers={"X-BuildLens-Role": "Director"})
        assert director_me.status_code == 200
        assert director_me.json()["role_name"] == "Director"
        assert "rework.approve" in director_me.json()["permissions"]
        assert "villa.state.upload" in director_me.json()["permissions"]
        assert "people.manage" in director_me.json()["permissions"]

        manager_me = await client.get("/api/v1/auth/me", headers={"X-BuildLens-Role": "Manager"})
        assert manager_me.status_code == 200
        assert manager_me.json()["role_name"] == "Manager"
        assert "rework.approve" in manager_me.json()["permissions"]
        assert "villa.state.upload" not in manager_me.json()["permissions"]
        assert "people.manage" not in manager_me.json()["permissions"]

        engineer_me = await client.get("/api/v1/auth/me", headers={"X-BuildLens-Role": "Engineer"})
        assert engineer_me.status_code == 200
        assert engineer_me.json()["role_name"] == "Engineer"
        assert "villa.state.upload" in engineer_me.json()["permissions"]
        assert "rework.approve" not in engineer_me.json()["permissions"]

        # 2. Engineer can upload villa state, Manager cannot (403)
        villa_102_id = "40000000-0000-0000-0000-000000000102"
        state_payload = {
            "status": "REWORK_REQUIRED",
            "progress": 60,
            "work_section": "Flooring & Wall Finishes",
            "note": "Tile alignment issue",
            "evidence_file": "tile.jpg",
        }
        manager_upload = await client.post(
            f"/api/v1/villas/{villa_102_id}/state",
            headers={"X-BuildLens-Role": "Manager"},
            json=state_payload,
        )
        assert manager_upload.status_code == 403

        engineer_upload = await client.post(
            f"/api/v1/villas/{villa_102_id}/state",
            headers={"X-BuildLens-Role": "Engineer"},
            json=state_payload,
        )
        assert engineer_upload.status_code == 200
        assert engineer_upload.json()["status"] == "REWORK_REQUIRED"
        assert engineer_upload.json()["rework_approved_by"] is None

        # 3. Engineer cannot approve rework (403), Manager can approve rework (200)
        approve_payload = {
            "next_status": "IN_PROGRESS",
            "progress": 75,
            "note": "Approved corrective tile work",
        }
        engineer_approve = await client.post(
            f"/api/v1/villas/{villa_102_id}/approve-rework",
            headers={"X-BuildLens-Role": "Engineer"},
            json=approve_payload,
        )
        assert engineer_approve.status_code == 403

        manager_approve = await client.post(
            f"/api/v1/villas/{villa_102_id}/approve-rework",
            headers={"X-BuildLens-Role": "Manager"},
            json=approve_payload,
        )
        assert manager_approve.status_code == 200
        assert manager_approve.json()["status"] == "IN_PROGRESS"
        assert manager_approve.json()["rework_approved_by"] == "Manager"

        # 4. Only Director can manage people (POST /api/v1/people/employees)
        manager_people = await client.post(
            "/api/v1/people/employees",
            headers={"X-BuildLens-Role": "Manager"},
            json={"employee_code": "EMP-999", "full_name": "Test User"},
        )
        assert manager_people.status_code == 403


