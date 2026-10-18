from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import workflow
from app.core.security import CurrentUser


def payload(**values):
    return workflow.WorkflowUpdate(**{'villa_id': uuid4(), 'activity_key': 'elle-001', 'revision': 1,
        'status': 'IN_PROGRESS', 'progress': 20, **values})


@pytest.mark.parametrize('values', [
    {'activity_key': 'elle-090'}, {'status': 'COMPLETED', 'progress': 20},
    {'status': 'NOT_STARTED', 'progress': 20}, {'status': 'REWORK_REQUIRED', 'note': ' '},
    {'status': 'IN_PROGRESS', 'progress': 100},
])
def test_invalid_updates(values):
    with pytest.raises(ValidationError):
        payload(**values)


@pytest.mark.asyncio
async def test_parallel_and_rework_updates_preserve_history(monkeypatch):
    project_id = uuid4()
    user = CurrentUser(uuid4(), 'test@example.com', uuid4(), permissions=frozenset({'task.write'}))
    repo = AsyncMock()
    repo.get.side_effect = [{'id': str(project_id)}, {'project_id': str(project_id)}]
    repo.list.return_value = [{'revision': 4, 'status': 'COMPLETED', 'progress': 100}]
    repo.create.side_effect = lambda table, org, record: record
    monkeypatch.setattr(workflow, 'repository', repo)
    result = await workflow.update_workflow(project_id, payload(revision=5, status='REWORK_REQUIRED', progress=0, note='Leak during retest'), user)
    assert result['revision'] == 5 and result['progress'] == 0
    repo.update.assert_not_called()
    assert result['actor_id'] == str(user.id)


@pytest.mark.asyncio
async def test_stale_revision_rejected(monkeypatch):
    project = uuid4()
    repo = AsyncMock()
    repo.get.side_effect = [{'id': str(project)}, {'project_id': str(project)}]
    repo.list.return_value = [{'revision': 2}]
    monkeypatch.setattr(workflow, 'repository', repo)
    user = CurrentUser(uuid4(), None, uuid4(), permissions=frozenset({'task.write'}))
    with pytest.raises(HTTPException) as error:
        await workflow.update_workflow(project, payload(), user)
    assert error.value.status_code == 409
    repo.create.assert_not_called()


@pytest.mark.asyncio
async def test_cross_project_villa_rejected(monkeypatch):
    repo = AsyncMock()
    repo.get.side_effect = [{'id': str(uuid4())}, {'project_id': str(uuid4())}]
    monkeypatch.setattr(workflow, 'repository', repo)
    user = CurrentUser(uuid4(), None, uuid4(), permissions=frozenset({'task.write'}))
    with pytest.raises(HTTPException) as error:
        await workflow.update_workflow(uuid4(), payload(), user)
    assert error.value.status_code == 404
    repo.create.assert_not_called()


@pytest.mark.asyncio
async def test_write_requires_permission():
    with pytest.raises(HTTPException) as error:
        await workflow.update_workflow(uuid4(), payload(), CurrentUser(uuid4(), None, uuid4()))
    assert error.value.status_code == 403
