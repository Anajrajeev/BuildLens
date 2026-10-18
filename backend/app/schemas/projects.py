from datetime import date
from uuid import UUID
from pydantic import BaseModel, Field

class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    project_code: str = Field(min_length=2, max_length=40)
    location: str | None = None
    target_completion_date: date | None = None

class ProjectRead(ProjectCreate):
    id: UUID
    organization_id: UUID
    status: str
