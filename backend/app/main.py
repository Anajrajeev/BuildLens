import time, uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1 import auth, operations, people, platform, projects, tasks, workflow
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title="BuildLens API", version="0.1.0", openapi_url="/openapi.json", docs_url="/docs")
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type", "X-Request-ID"])

@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred.", "request_id": request_id}})
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(round((time.perf_counter() - started) * 1000, 2))
    return response

@app.exception_handler(Exception)
async def domain_error_handler(request: Request, exc: Exception):
    if hasattr(exc, "status_code"):
        return JSONResponse(status_code=exc.status_code, content={"error": {**exc.detail, "request_id": request.headers.get("X-Request-ID")}})
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}})

@app.get("/health", tags=["health"])
async def health(): return {"status": "ok"}

app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(people.router, prefix="/api/v1")
app.include_router(operations.router, prefix="/api/v1")
app.include_router(platform.router, prefix="/api/v1")
app.include_router(workflow.router, prefix="/api/v1")
