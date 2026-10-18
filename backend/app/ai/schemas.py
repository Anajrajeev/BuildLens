from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Query(StrictModel):
    project_id: UUID
    villa_id: UUID | None = None
    question: str = Field(default='What needs attention today?', min_length=2, max_length=2000)
    horizon_days: Literal[7, 14] = 14


class Claim(StrictModel):
    text: str = Field(min_length=1, max_length=1600)
    evidence_ids: list[str] = Field(min_length=1, max_length=12)


class Answer(StrictModel):
    claims: list[Claim] = Field(max_length=12)
    missing_information: list[str] = Field(max_length=8)


class ToolSelection(StrictModel):
    tool: Literal['attention', 'schedule', 'quality', 'materials', 'handover', 'records', 'documents']


class RiskExplanation(StrictModel):
    risk_id: str
    explanation: str = Field(min_length=1, max_length=1600)
    evidence_ids: list[str] = Field(min_length=1, max_length=12)
    recommended_next_action: str = Field(max_length=600)


class RiskOutput(StrictModel):
    risks: list[RiskExplanation] = Field(max_length=30)


class DraftRequest(Query):
    kind: Literal['daily_report', 'vendor_followup', 'snag', 'handover_note']
    vendor_id: UUID | None = None


class DraftText(StrictModel):
    title: str = Field(min_length=2, max_length=240)
    content: str = Field(min_length=2, max_length=6000)
    evidence_ids: list[str] = Field(min_length=1, max_length=30)


class DraftApproval(StrictModel):
    revision: int = Field(ge=1)
    title: str = Field(min_length=2, max_length=240)
    content: str = Field(min_length=2, max_length=6000)


class DocumentText(StrictModel):
    project_id: UUID
    villa_id: UUID | None = None
    attachment_id: UUID
    revision: str = Field(min_length=1, max_length=40)
    page: int = Field(ge=1, le=100000)
    text: str = Field(min_length=20, max_length=30000)
