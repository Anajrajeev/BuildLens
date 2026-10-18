import asyncio
import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urlencode

from app.core.errors import api_error

PROJECT_TABLES = ('tasks', 'villas', 'snags', 'inspections', 'materials', 'purchase_orders', 'vendor_commitments', 'work_inspection_requests', 'daily_reports', 'safety_observations', 'handover_packages', 'villa_workflow_events', 'villa_documents', 'ai_document_chunks')
RELATED = {'task_dependencies': 'task_id', 'progress_updates': 'task_id', 'delay_events': 'task_id', 'task_comments': 'task_id', 'quality_issues': 'task_id', 'handover_items': 'handover_id', 'material_allocations': 'task_id'}
FIELDS = {'id', 'name', 'title', 'description', 'status', 'progress', 'planned_start_at', 'planned_end_at', 'updated_at', 'created_at', 'due_at', 'scheduled_at', 'notes', 'severity', 'quantity_on_hand', 'reorder_level', 'product_id', 'expected_at', 'promised_date', 'task_id', 'villa_id', 'project_id', 'responsible_employee_id', 'assigned_employee_id', 'assigned_vendor_id', 'vendor_id', 'assigned_team_id', 'inspector_id', 'depends_on_task_id', 'previous_progress', 'new_progress', 'reason_id', 'started_at', 'resolved_at', 'summary', 'constraints', 'report_date', 'target_date', 'target_handover_date', 'handover_id', 'required', 'label', 'villa_number', 'work_section_id', 'activity_key', 'revision', 'note', 'text', 'attachment_id', 'page', 'document_revision', 'is_current', 'approval_status', 'document_type', 'version', 'effective_date', 'superseded_at', 'plan_version_id', 'issued_at', 'drawing_revision_id', 'acknowledged_at'}
SECTIONS = {'tasks': 'Today', 'villas': 'Villas', 'materials': 'Materials', 'purchase_orders': 'Procurement', 'vendor_commitments': 'Vendors', 'work_inspection_requests': 'Quality', 'handover_packages': 'Handover', 'handover_items': 'Handover', 'ai_document_chunks': 'Documents'}
RELATED['task_assignments'] = 'task_id'
FIELDS.update({'material_id', 'quantity', 'employee_id', 'team_id'})


async def all_rows(repo, table, org, filters=None):
    rows = []
    for offset in range(0, 10000, 500):
        page = await repo.list(table, org, filters={**(filters or {}), 'offset': str(offset)}, order='id.asc', limit=500)
        rows.extend(page)
        if len(page) < 500:
            return rows
    raise api_error('CONTEXT_TOO_LARGE', 'Select a narrower project scope.', 422)


async def project_access(repo, user, project_id):
    if not user.organization_id:
        raise api_error('FORBIDDEN', 'Organization membership required.', 403)
    project = await repo.get('projects', user.organization_id, project_id)
    if not project or project.get('deleted_at'):
        raise api_error('NOT_FOUND', 'Project not found.', 404)
    if {'project.read.all', 'project.read'} & user.permissions:
        return project
    employees = await repo.list('employees', user.organization_id, filters={'user_id': f'eq.{user.id}'}, limit=20)
    for employee in employees:
        assignments = await repo.list('employee_project_assignments', user.organization_id, filters={'employee_id': f"eq.{employee['id']}", 'project_id': f'eq.{project_id}'}, limit=1)
        if assignments:
            return project
    # AI currently requires project-level access. It must not expand a villa-only grant.
    raise api_error('FORBIDDEN', 'Project access is required for project intelligence.', 403)


async def build_context(repo, user, project_id, villa_id=None):
    project = await project_access(repo, user, project_id)
    org = user.organization_id
    results = await asyncio.gather(*(all_rows(repo, table, org, {'project_id': f'eq.{project_id}'}) for table in PROJECT_TABLES))
    tables = dict(zip(PROJECT_TABLES, results))
    # Legacy inspections/snags may only carry a villa/task FK. Include these via
    # explicit scoped joins rather than relying on an optional project_id.
    task_ids = {r['id'] for r in tables['tasks']}
    villa_ids = {r['id'] for r in tables['villas']}
    villa_names = {r['id']: f"Villa {r.get('villa_number')}" for r in tables['villas']}
    handover_ids = {r['id'] for r in tables['handover_packages']}
    if villa_id and str(villa_id) not in villa_ids:
        raise api_error('NOT_FOUND', 'Villa not found in this project.', 404)
    for table, field in RELATED.items():
        rows = await all_rows(repo, table, org)
        ids = handover_ids if field == 'handover_id' else task_ids
        tables[table] = [r for r in rows if r.get(field) in ids or (table in {'delay_events', 'quality_issues'} and r.get('villa_id') in villa_ids)]
    for table in ('snags', 'inspections'):
        rows = await all_rows(repo, table, org)
        tables[table] = [r for r in rows if r.get('project_id') == str(project_id) or r.get('task_id') in task_ids or r.get('villa_id') in villa_ids]
    employees, vendors, teams, products = await asyncio.gather(*(all_rows(repo, t, org) for t in ('employees', 'vendors', 'teams', 'products')))
    names = {r['id']: r.get('full_name') or r.get('company_name') or r.get('name') for r in employees + vendors + teams}
    product_names = {r['id']: r.get('name') for r in products}
    if villa_id:
        tasks = {r['id'] for r in tables['tasks'] if r.get('villa_id') == str(villa_id)}
        packages = {r['id'] for r in tables['handover_packages'] if r.get('villa_id') == str(villa_id)}
        for table, rows in tables.items():
            tables[table] = [r for r in rows if r.get('villa_id') == str(villa_id) or (table == 'villas' and r['id'] == str(villa_id)) or r.get('task_id') in tasks or r.get('handover_id') in packages]
    evidence = []
    for table, rows in tables.items():
        for row in rows:
            if row.get('deleted_at') or (table == 'ai_document_chunks' and row.get('is_current') is not True):
                continue
            data = {k: v for k, v in row.items() if k in FIELDS}
            owner_id = next((row.get(k) for k in ('responsible_employee_id', 'assigned_employee_id', 'assigned_vendor_id', 'vendor_id', 'assigned_team_id', 'inspector_id') if row.get(k)), None)
            if not owner_id and table == 'tasks':
                assignments = [a for a in tables.get('task_assignments', []) if a.get('task_id') == row['id']]
                if len(assignments) == 1:
                    owner_id = next((assignments[0].get(k) for k in ('employee_id', 'vendor_id', 'team_id') if assignments[0].get(k)), None)
            item_name = row.get('name') or row.get('title') or row.get('label') or product_names.get(row.get('product_id')) or table.replace('_', ' ')
            villa_prefix = villa_names.get(row.get('villa_id'))
            evidence.append({'evidence_id': f"{table}:{row['id']}", 'record_type': table, 'record_id': row['id'], 'label': f"{villa_prefix} · {item_name}" if villa_prefix and table != 'villas' else (f"Villa {row['villa_number']}" if table == 'villas' else item_name), 'owner': {'id': owner_id, 'name': names.get(owner_id)} if owner_id else None, 'data': data, 'url': '/workspace?' + urlencode({'section': SECTIONS.get(table, 'Quality'), 'source': f"{table}:{row['id']}", 'project': str(project_id)})})
    evidence.sort(key=lambda r: r['evidence_id'])
    digest = hashlib.sha256(json.dumps(evidence, sort_keys=True, default=str).encode()).hexdigest()
    return {'project_id': str(project_id), 'project_name': project.get('name'), 'villa_id': str(villa_id) if villa_id else None, 'as_of': datetime.now(timezone.utc).isoformat(), 'snapshot_hash': digest, 'evidence': evidence}
