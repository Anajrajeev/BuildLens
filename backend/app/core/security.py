import asyncio
from dataclasses import dataclass
from uuid import UUID
import time
import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from app.core.config import Settings, get_settings
from app.core.errors import api_error

bearer = HTTPBearer(auto_error=False)
_jwks_cache: tuple[float, dict] | None = None
_access_context_cache: dict[tuple[str, str | None], tuple[float, tuple[UUID, UUID | None, frozenset[str]]]] = {}
_access_context_lock = asyncio.Lock()

@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    organization_id: UUID | None = None
    role_id: UUID | None = None
    permissions: frozenset[str] = frozenset()


async def _jwks(settings: Settings) -> dict:
    global _jwks_cache
    if _jwks_cache and _jwks_cache[0] > time.monotonic():
        return _jwks_cache[1]
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/auth/v1/.well-known/jwks.json")
        response.raise_for_status()
    document = response.json()
    _jwks_cache = (time.monotonic() + 300, document)
    return document


async def _load_organization_for_user(user_id: UUID, requested_organization: str | None, settings: Settings) -> tuple[UUID, UUID | None, frozenset[str]]:
    params = {"user_id": f"eq.{user_id}", "status": "eq.ACTIVE", "select": "organization_id,role_id"}
    if requested_organization:
        params["organization_id"] = f"eq.{requested_organization}"
    # Cloud SQL's current sb_secret keys are API keys, not JWT bearer tokens.
    headers = {"X-Internal-Token": settings.cloud_run_data_api_secret_key}
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/organization_members", params=params, headers=headers)
        response.raise_for_status()
    memberships = response.json()
    if not memberships:
        raise api_error("ORG_ACCESS_DENIED", "You are not assigned to this organization.", 403)
    membership = memberships[0]
    role_id = UUID(membership["role_id"]) if membership.get("role_id") else None
    permissions: frozenset[str] = frozenset()
    if role_id:
        permission_params = {"role_id": f"eq.{role_id}", "select": "permissions(key)"}
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{settings.cloud_run_data_api_url.rstrip('/')}/api/v1/role_permissions", params=permission_params, headers=headers)
            response.raise_for_status()
        permissions = frozenset(row["permissions"]["key"] for row in response.json() if row.get("permissions"))
    return UUID(membership["organization_id"]), role_id, permissions


async def _organization_for_user(user_id: UUID, requested_organization: str | None, settings: Settings) -> tuple[UUID, UUID | None, frozenset[str]]:
    """Cache authorization context briefly to avoid repeated Cloud SQL reads per page load."""
    cache_key = (str(user_id), requested_organization)
    now = time.monotonic()
    cached = _access_context_cache.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]
    async with _access_context_lock:
        cached = _access_context_cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        context = await _load_organization_for_user(user_id, requested_organization, settings)
        _access_context_cache[cache_key] = (time.monotonic() + 30, context)
        return context


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    request: Request = None,
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if settings.auth_disabled:
        return CurrentUser(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            email="local@buildlens.dev",
            organization_id=UUID("00000000-0000-0000-0000-000000000002"),
            permissions=frozenset({"task.write", "villa.read.all"}),
        )
    if credentials is None:
        raise api_error("AUTH_REQUIRED", "Authentication is required.", 401)
    try:
        header = jwt.get_unverified_header(credentials.credentials)
        key_data = next(key for key in (await _jwks(settings))["keys"] if key.get("kid") == header.get("kid"))
        key = jwk.construct(key_data, header["alg"])
        claims = jwt.decode(credentials.credentials, key, algorithms=[header["alg"]], audience=settings.jwt_audience, issuer=settings.jwt_issuer or None)
        user_id = UUID(claims["sub"])
        organization_id, role_id, permissions = await _organization_for_user(user_id, request.headers.get("X-Organization-ID"), settings)
        return CurrentUser(id=user_id, email=claims.get("email"), organization_id=organization_id, role_id=role_id, permissions=permissions)
    except (JWTError, KeyError, StopIteration, ValueError, httpx.HTTPError):
        raise api_error("INVALID_TOKEN", "Authentication token is invalid.", 401)
