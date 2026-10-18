from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, model_validator

class TaskCreate(BaseModel):
    project_id: UUID
    villa_id: UUID | None = None
    name: str = Field(min_length=2, max_length=240)
    priority: str = "MEDIUM"
    planned_start_at: datetime | None = None
    planned_end_at: datetime | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.planned_start_at and self.planned_end_at and self.planned_end_at <= self.planned_start_at:
            raise ValueError("planned end must be after planned start")
        return self

class TaskRead(TaskCreate):
    id: UUID
    organization_id: UUID
    status: str
    progress: float

class TimerCreate(BaseModel):
    planned_start_at: datetime
    planned_end_at: datetime
    estimated_work_minutes: int = Field(gt=0)
    count_non_working_days: bool = False

    @model_validator(mode="after")
    def validate_deadline(self):
        if self.planned_end_at <= self.planned_start_at:
            raise ValueError("planned end must be after planned start")
        return self
