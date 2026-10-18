from typing import Any
from uuid import UUID

import httpx

from app.core.config import get_settings
from app.core.seed_store import create_row, get_row, list_rows, update_row


class PlatformRepository:
    """Tenant-scoped Cloud SQL adapter used by the operational modules, with seeded local store support."""

    def __init__(self) -> None:
        self.settings = get_settings()
        if self.settings.data_backend == "firestore":
            from app.repositories.firestore_repository import FirestoreRepository
            adapter = FirestoreRepository()
            self.list = adapter.list
            self.get = adapter.get
            self.create = adapter.create
            self.update = adapter.update

    def _use_seed_store(self) -> bool:
        return bool(self.settings.auth_disabled or not self.settings.cloud_run_data_api_url or "127.0.0.1:8001" in self.settings.cloud_run_data_api_url)

    def _headers(self, representation: bool = False, count: bool = False) -> dict[str, str]:
        prefer: list[str] = []
        if representation:
            prefer.append("return=representation")
        if count:
            prefer.append("count=exact")
        headers = {"X-Internal-Token": self.settings.cloud_run_data_api_secret_key}
        if prefer:
            headers["Prefer"] = ",".join(prefer)
        return headers

    async def list(
        self,
        table: str,
        organization_id: UUID,
        *,
        select: str = "*",
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        if self._use_seed_store():
            return list_rows(table, str(organization_id), filters=filters, limit=limit)
        params: dict[str, str] = {"organization_id": f"eq.{organization_id}", "select": select, "limit": str(limit)}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/{table}",
                headers=self._headers(),
                params=params,
            )
            response.raise_for_status()
        return response.json()

    async def get(self, table: str, organization_id: UUID, record_id: UUID, select: str = "*") -> dict[str, Any] | None:
        if self._use_seed_store():
            return get_row(table, str(record_id))
        records = await self.list(table, organization_id, select=select, filters={"id": f"eq.{record_id}"}, limit=1)
        return records[0] if records else None

    async def create(self, table: str, organization_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        record = {**payload, "organization_id": str(organization_id)}
        if self._use_seed_store():
            return create_row(table, record)
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/{table}",
                headers=self._headers(representation=True),
                json=record,
            )
            response.raise_for_status()
        return response.json()[0]

    async def update(self, table: str, organization_id: UUID, record_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        if self._use_seed_store():
            updated = update_row(table, str(record_id), payload)
            if not updated:
                raise LookupError(f"{table} record not found")
            return updated
        params = {"organization_id": f"eq.{organization_id}", "id": f"eq.{record_id}"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.patch(
                f"{self.settings.cloud_run_data_api_url.rstrip('/')}/api/v1/{table}",
                headers=self._headers(representation=True),
                params=params,
                json=payload,
            )
            response.raise_for_status()
        records = response.json()
        if not records:
            raise LookupError(f"{table} record not found")
        return records[0]

    async def audit(
        self,
        organization_id: UUID,
        actor_id: UUID,
        action: str,
        entity_type: str,
        entity_id: str | UUID | None,
        new_value: dict[str, Any] | None,
        request_id: str | None,
    ) -> None:
        await self.create(
            "audit_logs",
            organization_id,
            {
                "actor_id": str(actor_id),
                "action": action,
                "entity_type": entity_type,
                "entity_id": str(entity_id) if entity_id else None,
                "new_value": new_value,
                "request_id": request_id,
            },
        )
