import asyncio
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from google.cloud import firestore
from app.ai.context import build_context, project_access, FIELDS
from app.core.config import get_settings
from app.core.errors import api_error
from app.core.firebase import database


async def approve(repo, user, draft_id, payload):
    if 'project.write' not in user.permissions:
        raise api_error('FORBIDDEN', 'Project write permission is required to approve drafts.', 403)
    draft = await repo.get('ai_drafts', user.organization_id, draft_id)
    if not draft or draft.get('created_by') != str(user.id):
        raise api_error('NOT_FOUND', 'Draft not found.', 404)
    await project_access(repo, user, draft['project_id'])
    context = await build_context(repo, user, draft['project_id'], draft.get('villa_id'))
    if draft['status'] != 'EXECUTED' and context['snapshot_hash'] != draft['snapshot_hash']:
        raise api_error('STALE_DRAFT', 'Project records changed. Generate a fresh draft before approving.', 409)
    now = datetime.now(timezone.utc).isoformat()
    targets = {'daily_report': 'daily_reports', 'vendor_followup': 'vendor_followups', 'snag': 'snags', 'handover_note': 'handover_notes'}
    target = targets[draft['kind']]
    db = database()
    draft_ref = db.collection('ai_drafts').document(str(draft_id))
    result_ref = db.collection(target).document(str(draft_id))
    audit_ref = db.collection('audit_logs').document(f'ai-{draft_id}')

    @firestore.transactional
    def commit(transaction):
        current = draft_ref.get(transaction=transaction).to_dict()
        if not current or current.get('organization_id') != str(user.organization_id) or current.get('created_by') != str(user.id):
            raise api_error('NOT_FOUND', 'Draft not found.', 404)
        if current['status'] == 'EXECUTED':
            if current['title'] != payload.title or current['content'] != payload.content:
                raise api_error('ALREADY_EXECUTED', 'This draft has already been saved with different content.', 409)
            return {**current, 'id': str(draft_id)}
        if current['status'] != 'DRAFTED' or current['revision'] != payload.revision:
            raise api_error('DRAFT_CONFLICT', 'This draft has changed. Refresh before approving.', 409)
        # Firestore retries this transaction if an evidence document changes
        # between these reads and commit; stale approval can never win that race.
        for source in context['evidence']:
            snapshot = db.collection(source['record_type']).document(source['record_id']).get(transaction=transaction)
            values = snapshot.to_dict() if snapshot.exists else None
            if values is None or values.get('organization_id') != str(user.organization_id):
                raise api_error('STALE_DRAFT', 'A source changed. Generate a fresh draft.', 409)
            actual = {k: v for k, v in {**values, 'id': snapshot.id}.items() if k in FIELDS}
            if actual != source['data']:
                raise api_error('STALE_DRAFT', 'A source changed. Generate a fresh draft.', 409)
        record = {'organization_id': str(user.organization_id), 'project_id': current['project_id'], 'villa_id': current.get('villa_id'), 'created_by': str(user.id), 'created_at': now, 'updated_at': now, 'ai_draft_id': str(draft_id), 'evidence_ids': current['evidence_ids']}
        if current['kind'] == 'daily_report':
            record.update(summary=payload.content, report_date=datetime.now(ZoneInfo(get_settings().site_timezone)).date().isoformat(), weather=None, workforce_count=None)
        elif current['kind'] == 'snag':
            record.update(title=payload.title, description=payload.content, status='OPEN', severity='MEDIUM')
        else:
            record.update(title=payload.title, notes=payload.content, vendor_id=current.get('vendor_id'), status='APPROVED_DRAFT')
        values = {'status': 'EXECUTED', 'revision': current['revision']+1, 'approved_by': str(user.id), 'approved_at': now, 'title': payload.title, 'content': payload.content, 'result_type': target, 'result_id': str(draft_id)}
        transaction.create(result_ref, record)
        transaction.create(audit_ref, {'organization_id': str(user.organization_id), 'actor_id': str(user.id), 'action': 'AI_DRAFT_APPROVED_AND_SAVED', 'entity_type': target, 'entity_id': str(draft_id), 'occurred_at': now, 'new_value': record})
        transaction.update(draft_ref, values)
        return {**current, **values, 'id': str(draft_id)}
    return await asyncio.to_thread(commit, db.transaction())
