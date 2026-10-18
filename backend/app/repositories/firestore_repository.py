"""Firestore adapter for the existing repository query contract.

Every query starts with an organization filter. Remaining predicates are evaluated
within that tenant; bounded scans fail explicitly rather than silently undercount.
"""
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from google.cloud.firestore_v1.base_query import FieldFilter
from app.core.firebase import database
from app.core.errors import api_error

TABLES = {'organizations', 'organization_members', 'roles', 'role_permissions', 'permissions', 'employees', 'teams', 'employee_project_assignments', 'employee_villa_assignments', 'employee_roles', 'employee_reporting_relationships', 'projects', 'villas', 'villa_levels', 'villa_rooms', 'tasks', 'task_assignments', 'task_dependencies', 'task_comments', 'task_time_trackers', 'task_time_events', 'progress_updates', 'vendors', 'vendor_commitments', 'vendor_work_assignments', 'vendor_performance_scores', 'delay_events', 'delay_reasons', 'inspections', 'inspection_items', 'quality_issues', 'snags', 'products', 'suppliers', 'materials', 'material_allocations', 'material_usage', 'material_deliveries', 'stock_movements', 'purchase_orders', 'purchase_order_items', 'work_inspection_requests', 'attachments', 'villa_documents', 'drawing_revisions', 'drawing_acknowledgements', 'drawings', 'daily_reports', 'safety_observations', 'handover_packages', 'handover_items', 'checklist_templates', 'checklist_template_items', 'notifications', 'activity_events', 'audit_logs', 'ai_runs', 'ai_drafts', 'ai_document_chunks', 'work_sections', 'work_categories', 'villa_workflow_events', 'sync_mutations'}


TABLES.update({'vendor_performance', 'vendor_followups', 'handover_notes'})


def matches(row, filters):
    for key, expression in filters.items():
        if key == 'offset':
            continue
        value = row.get(key)
        if expression.startswith('eq.') and str(value) != expression[3:]:
            return False
        if expression == 'is.null' and value is not None:
            return False
        if expression.startswith('not.in.') and str(value) in expression[8:].strip('()').split(','):
            return False
        if expression.startswith('in.') and str(value) not in expression[3:].strip('()').split(','):
            return False
        if not expression.startswith(('eq.', 'is.null', 'not.in.', 'in.')):
            raise ValueError('Unsupported query predicate')
    return True


class FirestoreRepository:
    def collection(self, table):
        if table not in TABLES:
            raise ValueError('Unsupported collection')
        return database().collection(table)

    async def list(self, table, organization_id, *, select='*', filters=None, order=None, limit=200):
        filters = filters or {}
        def fetch():
            query = self.collection(table).where(filter=FieldFilter('organization_id', '==', str(organization_id)))
            # Exact project filters reduce reads before processing optional predicates.
            for field in ('project_id', 'villa_id', 'task_id', 'user_id', 'employee_id'):
                expression = filters.get(field, '')
                if expression.startswith('eq.'):
                    query = query.where(filter=FieldFilter(field, '==', expression[3:]))
            docs = list(query.limit(10001).stream(timeout=20))
            if len(docs) > 10000:
                raise api_error('QUERY_TOO_LARGE', 'Narrow the project or villa scope before querying.', 422)
            rows = [{**doc.to_dict(), 'id': doc.id} for doc in docs]
            rows = [row for row in rows if matches(row, filters)]
            for clause in reversed((order or '').split(',')):
                if not clause:
                    continue
                field, *direction = clause.split('.')
                populated = [r for r in rows if r.get(field) is not None]
                missing = [r for r in rows if r.get(field) is None]
                populated.sort(key=lambda r: r[field], reverse='desc' in direction)
                rows = populated + missing
            offset = int(filters.get('offset', 0))
            rows = rows[offset:offset + limit]
            # Expand only known relations; tenant equality is checked again.
            for relation, foreign in [('products', 'product_id'), ('permissions', 'permission_id')]:
                if relation + '(' in select:
                    for row in rows:
                        related = self.collection(relation).document(str(row.get(foreign, '_missing'))).get(timeout=10)
                        data = related.to_dict() if related.exists else None
                        row[relation] = data if data and data.get('organization_id') == str(organization_id) else None
            return rows
        return await asyncio.to_thread(fetch)

    async def get(self, table, organization_id, record_id, select='*'):
        doc = await asyncio.to_thread(self.collection(table).document(str(record_id)).get, timeout=15)
        row = doc.to_dict() if doc.exists else None
        return {**row, 'id': doc.id} if row and row.get('organization_id') == str(organization_id) else None

    async def create(self, table, organization_id, payload):
        now = datetime.now(timezone.utc).isoformat()
        row = {'created_at': now, 'updated_at': now, **payload, 'organization_id': str(organization_id)}
        if table in {'projects', 'villas'}:
            row.setdefault('status', 'PLANNING')
        if table == 'tasks':
            row.setdefault('status', 'NOT_STARTED')
            row.setdefault('progress', 0)
            row['title'] = row.get('name', row.get('title', 'Work item'))
        doc = self.collection(table).document(str(row.pop('id', uuid4())))
        await asyncio.to_thread(doc.create, row, timeout=15)
        return {**row, 'id': doc.id}

    async def update(self, table, organization_id, record_id, payload):
        from google.cloud import firestore
        ref = self.collection(table).document(str(record_id))
        @firestore.transactional
        def change(transaction):
            doc = ref.get(transaction=transaction)
            if not doc.exists or doc.to_dict().get('organization_id') != str(organization_id):
                raise LookupError('Record not found')
            values = {k: v for k, v in payload.items() if k not in {'organization_id', 'id'}}
            values['updated_at'] = datetime.now(timezone.utc).isoformat()
            transaction.update(ref, values)
            return {**doc.to_dict(), **values, 'id': doc.id}
        return await asyncio.to_thread(change, database().transaction())
