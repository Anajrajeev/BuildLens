"""Explicit opt-in tests against an isolated, disposable tenant in Firestore.

No seeded record enters the user's organization. Teardown removes only document
IDs recorded by this test and verifies their organization before deletion.
"""
import os
from uuid import uuid4
import pytest
from app.core.firebase import database
from app.core.security import CurrentUser
from app.repositories.platform_repository import PlatformRepository
from app.ai.service import Intelligence
from app.ai.schemas import DraftRequest, DraftApproval, Query
from app.ai.drafts import approve
from app.ai.context import build_context

pytestmark = [pytest.mark.asyncio, pytest.mark.skipif(os.environ.get('BUILDLENS_FIRESTORE_TEST') != '1', reason='Opt-in live Firestore verification')]


async def test_live_isolation_draft_approval_idempotency_and_audit(monkeypatch):
    from unittest.mock import AsyncMock
    monkeypatch.setattr('app.ai.service.generate', AsyncMock(return_value=(None, 'Test deterministic fallback')))
    org = uuid4()
    user = CurrentUser(str(uuid4()), 'test@invalid.example', org, permissions=frozenset({'project.read.all', 'project.write'}))
    repo = PlatformRepository()
    created = []
    async def add(table, values):
        row = await repo.create(table, org, values)
        created.append((table, row['id']))
        return row
    try:
        project = await add('projects', {'name': 'Isolated integration test', 'project_code': 'TEST'})
        task = await add('tasks', {'project_id': project['id'], 'name': 'Test blocked work', 'status': 'BLOCKED', 'planned_end_at': '2020-01-01T00:00:00Z'})
        assert await repo.get('tasks', uuid4(), task['id']) is None
        context = await build_context(repo, user, project['id'])
        assert any(s['record_id'] == task['id'] for s in context['evidence'])
        result = await Intelligence(repo).run(user, Query(project_id=project['id']), 'briefing')
        created.append(('ai_runs', result['run_id']))
        assert result['attention_items'] and result['mode'] == 'rules'
        for kind in ('daily_report',):
            draft = await Intelligence(repo).draft(user, DraftRequest(project_id=project['id'], kind=kind))
            created.extend([('ai_drafts', draft['id']), ('daily_reports', draft['id']), ('audit_logs', 'ai-'+draft['id'])])
            approval = DraftApproval(revision=1, title=draft['title'], content=draft['content'])
            first = await approve(repo, user, draft['id'], approval)
            second = await approve(repo, user, draft['id'], approval)
            assert first['result_id'] == second['result_id'] == draft['id']
            assert first['status'] == 'EXECUTED'
            reports = await repo.list('daily_reports', org)
            assert len(reports) == 1 and reports[0]['ai_draft_id'] == draft['id']
            assert await repo.get('audit_logs', org, 'ai-'+draft['id'])
    finally:
        db = database()
        for table, id in reversed(created):
            ref = db.collection(table).document(id)
            doc = ref.get(timeout=15)
            if doc.exists:
                assert doc.to_dict()['organization_id'] == str(org)
                ref.delete(timeout=15)
