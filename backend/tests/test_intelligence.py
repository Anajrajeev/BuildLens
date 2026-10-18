from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from app.ai.context import build_context, project_access
from app.ai.gemini import valid_claims
from app.ai.risk_engine import attention, risk_cards
from app.ai.schemas import Claim, Query, Answer
from app.ai.service import Intelligence
from app.core.security import CurrentUser

NOW = datetime(2026, 10, 18, 8, tzinfo=timezone.utc)


def source(table, id, **data):
    return {'evidence_id': f'{table}:{id}', 'record_id': id, 'record_type': table, 'label': id, 'owner': None, 'data': {'id': id, **data}}


def test_closed_records_and_reorder_threshold():
    context = {'evidence': [source('tasks', 'done', status='COMPLETED', planned_end_at='2020-01-01'), source('materials', 'stock', quantity_on_hand=2, reorder_level=2), source('snags', 'closed', status='CLOSED')]}
    result = attention(context, NOW)
    assert len(result) == 1 and result[0]['category'] == 'materials'
    assert 'not yet confirmed' in result[0]['reason']


def test_risk_horizon_dependencies_and_unknown_dates():
    context = {'evidence': [source('tasks', 't1', status='BLOCKED', planned_end_at='2026-10-25T07:00:00Z'), source('tasks', 't2', status='IN_PROGRESS', planned_end_at='2026-10-29T07:00:00Z'), source('tasks', 'unscheduled', status='BLOCKED'), source('task_dependencies', 'dep', task_id='t1', depends_on_task_id='t2')]}
    week = risk_cards(context, 7, NOW)
    assert [r['id'] for r in week] == ['t1']
    assert 'tasks:t2' in week[0]['evidence_ids']
    assert week[0]['risk_score'] <= 100
    assert len(risk_cards(context, 14, NOW)) == 2


def test_citations_cannot_reference_unknown_records():
    assert not valid_claims([Claim(text='Invented', evidence_ids=['tasks:other-org'])], [source('tasks', 'allowed')])
    assert valid_claims([Claim(text='Supported', evidence_ids=['tasks:allowed'])], [source('tasks', 'allowed')])


@pytest.mark.asyncio
async def test_project_access_is_not_implied_by_org_membership():
    repo = AsyncMock()
    repo.get.return_value = {'id': 'project'}
    repo.list.return_value = []
    with pytest.raises(HTTPException) as error:
        await project_access(repo, CurrentUser(uuid4(), None, uuid4()), uuid4())
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_explicit_project_assignment_grants_access():
    repo = AsyncMock()
    repo.get.return_value = {'id': 'project'}
    repo.list.side_effect = [[{'id': 'employee'}], [{'project_id': 'project'}]]
    assert await project_access(repo, CurrentUser(uuid4(), None, uuid4()), uuid4())


@pytest.mark.asyncio
async def test_foreign_villa_is_rejected():
    repo = AsyncMock()
    repo.get.return_value = {'id': 'project'}
    repo.list.return_value = []
    user = CurrentUser(uuid4(), None, uuid4(), permissions=frozenset({'project.read.all'}))
    with pytest.raises(HTTPException) as error:
        await build_context(repo, user, uuid4(), uuid4())
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_empty_scope_does_not_invoke_gemini(monkeypatch):
    repo = AsyncMock()
    context = {'evidence': [], 'project_id': str(uuid4()), 'as_of': NOW.isoformat(), 'snapshot_hash': 'x'}
    monkeypatch.setattr('app.ai.service.build_context', AsyncMock(return_value=context))
    generation = AsyncMock()
    monkeypatch.setattr('app.ai.service.generate', generation)
    result = await Intelligence(repo).run(CurrentUser(uuid4(), None, uuid4()), Query(project_id=context['project_id']), 'briefing')
    assert result['mode'] == 'rules' and result['missing_information']
    generation.assert_not_called()


@pytest.mark.asyncio
async def test_fabricated_citations_fall_back(monkeypatch):
    repo = AsyncMock()
    context = {'evidence': [source('tasks', 't1', status='BLOCKED')], 'project_id': str(uuid4()), 'as_of': NOW.isoformat(), 'snapshot_hash': 'x'}
    monkeypatch.setattr('app.ai.service.build_context', AsyncMock(return_value=context))
    output = Answer(claims=[Claim(text='Invented', evidence_ids=['tasks:foreign'])], missing_information=[])
    monkeypatch.setattr('app.ai.service.generate', AsyncMock(return_value=(output, None)))
    result = await Intelligence(repo).run(CurrentUser(uuid4(), None, uuid4()), Query(project_id=context['project_id']), 'briefing')
    assert result['mode'] == 'rules'
    assert 'validation' in result['fallback_reason']
    assert all('Invented' not in c['text'] for c in result['claims'])


@pytest.mark.asyncio
async def test_draft_creation_requires_write_permission():
    from app.ai.schemas import DraftRequest
    with pytest.raises(HTTPException) as error:
        await Intelligence(AsyncMock()).draft(CurrentUser(uuid4(), None, uuid4()), DraftRequest(project_id=uuid4(), kind='daily_report'))
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_changed_evidence_prevents_approval(monkeypatch):
    from app.ai.drafts import approve
    from app.ai.schemas import DraftApproval
    user = CurrentUser(uuid4(), None, uuid4(), permissions=frozenset({'project.write'}))
    repo = AsyncMock()
    repo.get.return_value = {'created_by': str(user.id), 'project_id': str(uuid4()), 'status': 'DRAFTED', 'snapshot_hash': 'old'}
    monkeypatch.setattr('app.ai.drafts.project_access', AsyncMock())
    monkeypatch.setattr('app.ai.drafts.build_context', AsyncMock(return_value={'snapshot_hash': 'new'}))
    with pytest.raises(HTTPException) as error:
        await approve(repo, user, uuid4(), DraftApproval(revision=1, title='Report', content='Reviewed report'))
    assert error.value.status_code == 409
    repo.update.assert_not_called()
