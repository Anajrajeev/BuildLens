from uuid import UUID
from fastapi import APIRouter, Depends
from app.ai.context import build_context, project_access
from app.ai.drafts import approve
from app.ai.schemas import Query, DraftRequest, DraftApproval, DocumentText
from app.ai.service import Intelligence
from app.core.security import CurrentUser, get_current_user
from app.core.errors import api_error
from app.repositories.platform_repository import PlatformRepository

router = APIRouter(prefix='/ai', tags=['project-intelligence'])
repository = PlatformRepository()


@router.post('/briefing')
async def briefing(payload: Query, user: CurrentUser = Depends(get_current_user)):
    return await Intelligence(repository).run(user, payload, 'briefing')


@router.post('/risks')
async def risks(payload: Query, user: CurrentUser = Depends(get_current_user)):
    return await Intelligence(repository).run(user, payload, 'risks')


@router.post('/ask')
async def ask(payload: Query, user: CurrentUser = Depends(get_current_user)):
    return await Intelligence(repository).run(user, payload, 'ask')


@router.get('/attention')
async def attention(project_id: UUID, villa_id: UUID | None = None, user: CurrentUser = Depends(get_current_user)):
    return await Intelligence(repository).run(user, Query(project_id=project_id, villa_id=villa_id), 'attention')


@router.get('/sources/{record_type}/{record_id}')
async def source(record_type: str, record_id: UUID, project_id: UUID, user: CurrentUser = Depends(get_current_user)):
    context = await build_context(repository, user, project_id)
    found = next((s for s in context['evidence'] if s['record_type'] == record_type and s['record_id'] == str(record_id)), None)
    if not found:
        raise api_error('NOT_FOUND', 'Source no longer exists or is not accessible.', 404)
    return found


@router.post('/drafts', status_code=201)
async def draft(payload: DraftRequest, user: CurrentUser = Depends(get_current_user)):
    return await Intelligence(repository).draft(user, payload)


@router.get('/drafts')
async def drafts(project_id: UUID, user: CurrentUser = Depends(get_current_user)):
    await project_access(repository, user, project_id)
    return {'items': await repository.list('ai_drafts', user.organization_id, filters={'project_id': f'eq.{project_id}', 'created_by': f'eq.{user.id}'}, order='created_at.desc', limit=50)}


@router.post('/drafts/{draft_id}/approve')
async def approve_draft(draft_id: UUID, payload: DraftApproval, user: CurrentUser = Depends(get_current_user)):
    return await approve(repository, user, draft_id, payload)


@router.post('/drafts/{draft_id}/reject')
async def reject_draft(draft_id: UUID, user: CurrentUser = Depends(get_current_user)):
    draft = await repository.get('ai_drafts', user.organization_id, draft_id)
    if not draft or draft.get('created_by') != str(user.id):
        raise api_error('NOT_FOUND', 'Draft not found.', 404)
    await project_access(repository, user, draft['project_id'])
    # Atomic state change: never overwrite an executed draft during a race.
    import asyncio
    from google.cloud import firestore
    from app.core.firebase import database
    db = database()
    ref = db.collection('ai_drafts').document(str(draft_id))
    @firestore.transactional
    def reject(transaction):
        current = ref.get(transaction=transaction).to_dict()
        if current['status'] != 'DRAFTED':
            raise api_error('DRAFT_CONFLICT', 'Only pending drafts can be rejected.', 409)
        transaction.update(ref, {'status': 'REJECTED', 'revision': current['revision']+1})
        return {'status': 'REJECTED'}
    return await asyncio.to_thread(reject, db.transaction())


@router.post('/documents/index', status_code=201)
async def index_document(payload: DocumentText, user: CurrentUser = Depends(get_current_user)):
    await project_access(repository, user, payload.project_id)
    if 'project.write' not in user.permissions:
        raise api_error('FORBIDDEN', 'Document indexing requires project write permission.', 403)
    attachment = await repository.get('attachments', user.organization_id, payload.attachment_id)
    if not attachment or attachment.get('project_id') != str(payload.project_id):
        raise api_error('NOT_FOUND', 'Register the document in this project before indexing.', 404)
    if payload.villa_id:
        villa = await repository.get('villas', user.organization_id, payload.villa_id)
        if not villa or villa['project_id'] != str(payload.project_id):
            raise api_error('NOT_FOUND', 'Villa not found.', 404)
    # User-reviewed text ingestion; page/revision metadata remains attached to every chunk.
    import asyncio
    from uuid import uuid5, NAMESPACE_URL
    from app.core.firebase import database
    db = database()
    existing = await repository.list('ai_document_chunks', user.organization_id, filters={'attachment_id': f'eq.{payload.attachment_id}'}, limit=481)
    if len(existing) > 480:
        raise api_error('DOCUMENT_TOO_LARGE', 'This document needs batched ingestion by an administrator.', 422)
    batch = db.batch()
    for row in existing:
        if row.get('document_revision') != payload.revision or row.get('page') == payload.page:
            batch.update(db.collection('ai_document_chunks').document(row['id']), {'is_current': False})
    chunks = []
    for offset in range(0, len(payload.text), 1800):
        id = str(uuid5(NAMESPACE_URL, f'{payload.attachment_id}/{payload.revision}/{payload.page}/{offset}'))
        chunk = {'organization_id': str(user.organization_id), 'project_id': str(payload.project_id), 'villa_id': str(payload.villa_id) if payload.villa_id else None, 'attachment_id': str(payload.attachment_id), 'document_revision': payload.revision, 'page': payload.page, 'text': payload.text[offset:offset+2000], 'label': attachment.get('file_name', 'Document') + f' · p.{payload.page} · rev.{payload.revision}', 'is_current': True, 'created_by': str(user.id)}
        batch.set(db.collection('ai_document_chunks').document(id), chunk)
        chunks.append({**chunk, 'id': id})
    await asyncio.to_thread(batch.commit)
    return {'items': chunks}
