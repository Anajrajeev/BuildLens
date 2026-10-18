from datetime import datetime, timedelta, timezone

DONE = {'COMPLETED', 'CANCELLED', 'CLOSED', 'VERIFIED', 'APPROVED', 'PASSED', 'HANDED_OVER', 'ACCEPTED', 'RESOLVED', 'DELIVERED', 'FULFILLED'}


def date_value(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def attention(context, now=None):
    now = now or datetime.now(timezone.utc)
    items = []
    for source in context['evidence']:
        row, table = source['data'], source['record_type']
        status = row.get('status', '')
        if status in DONE or table == 'ai_document_chunks':
            continue
        reasons = []
        due = date_value(row.get('planned_end_at') or row.get('due_at') or row.get('expected_at') or row.get('promised_date'))
        if due and due < now:
            reasons.append(('overdue', 'Past the recorded due date', 65))
        if status in {'BLOCKED', 'REWORK_REQUIRED', 'FAILED', 'REJECTED'}:
            reasons.append(('blocked', f'Recorded status: {status.replace("_", " ").lower()}', 80))
        if table in {'inspections', 'work_inspection_requests'} and status in {'PENDING', 'SUBMITTED', 'INSPECTION_SCHEDULED', 'IN_PROGRESS'}:
            reasons.append(('approval', 'Inspection or review is pending', 50))
        if table in {'snags', 'quality_issues'}:
            reasons.append(('quality', 'Open quality issue', 85 if row.get('severity') in {'HIGH', 'CRITICAL'} else 55))
        if table == 'materials' and row.get('reorder_level') is not None and float(row.get('quantity_on_hand') or 0) <= float(row['reorder_level']):
            reasons.append(('materials', 'Stock is at or below reorder level; task shortage is not yet confirmed', 60))
        if table == 'delay_events':
            reasons.append(('delay', 'Open recorded delay', 75))
        if table == 'safety_observations' and row.get('severity') in {'HIGH', 'CRITICAL'}:
            reasons.append(('safety', 'Open high-severity safety observation', 95))
        if table == 'handover_items' and row.get('required') and status not in {'READY', 'ACCEPTED'}:
            reasons.append(('handover', 'Required handover item is incomplete', 65))
        if reasons:
            category, reason, score = max(reasons, key=lambda r: r[2])
            items.append({'id': source['evidence_id'], 'category': category, 'title': source['label'], 'reason': reason, 'score': score, 'owner': source['owner'], 'evidence_ids': [source['evidence_id']], 'due_at': due.isoformat() if due else None})
    return sorted(items, key=lambda r: (-r['score'], r['due_at'] or 'z', r['id']))


def risk_cards(context, horizon_days=14, now=None):
    now = now or datetime.now(timezone.utc)
    end = now + timedelta(days=horizon_days)
    evidence = context['evidence']
    tasks = {s['record_id']: s for s in evidence if s['record_type'] == 'tasks'}
    cards = []
    for task_id, source in tasks.items():
        row = source['data']
        due = date_value(row.get('planned_end_at'))
        if row.get('status') in DONE or not due or due > end:
            continue
        signals = []
        refs = {source['evidence_id']}
        def add(text, weight, related=None, signals=signals, refs=refs):
            signals.append({'text': text, 'weight': weight})
            if related:
                refs.add(related['evidence_id'])
        if due < now:
            add('Already overdue', 60)
        if row.get('status') in {'BLOCKED', 'REWORK_REQUIRED'}:
            add('Work is blocked or requires rework', 55)
        start = date_value(row.get('planned_start_at'))
        if start and due > start and start < now < due:
            expected = min(100, (now-start).total_seconds() / (due-start).total_seconds()*100)
            if expected - float(row.get('progress') or 0) >= 20:
                add('Progress trails a linear plan by at least 20 points (heuristic)', 30)
        updated = date_value(row.get('updated_at'))
        if updated and updated < now-timedelta(days=7):
            add('Record has not been updated in seven days', 15)
        if not source['owner']:
            add('No responsible owner is recorded', 15)
        for other in evidence:
            record = other['data']
            if record.get('task_id') != task_id:
                continue
            if other['record_type'] == 'task_dependencies':
                predecessor = tasks.get(record.get('depends_on_task_id'))
                if predecessor and predecessor['data'].get('status') not in DONE:
                    add('A recorded predecessor remains incomplete', 35, other)
                    refs.add(predecessor['evidence_id'])
            if other['record_type'] in {'inspections', 'work_inspection_requests', 'snags', 'delay_events'} and record.get('status') not in DONE:
                add('An associated inspection, defect or delay remains open', 25, other)
            if other['record_type'] == 'vendor_commitments' and record.get('status') not in DONE and date_value(record.get('promised_date')) and date_value(record['promised_date']) < now:
                add('A linked vendor commitment is overdue', 30, other)
            if other['record_type'] == 'material_allocations':
                material = next((s for s in evidence if s['record_type'] == 'materials' and s['record_id'] == record.get('material_id')), None)
                if material and float(record.get('quantity') or 0) > float(material['data'].get('quantity_on_hand') or 0):
                    add('A task material allocation exceeds current stock', 35, other)
                    refs.add(material['evidence_id'])
        if not signals:
            continue
        score = min(100, sum(s['weight'] for s in signals))
        cards.append({'id': task_id, 'entity_type': 'task', 'villa_id': row.get('villa_id'), 'title': source['label'], 'risk_level': 'critical' if score >= 85 else 'high' if score >= 60 else 'medium' if score >= 30 else 'low', 'risk_score': score, 'owner': source['owner'], 'evidence_ids': sorted(refs), 'signals': signals, 'explanation': '; '.join(s['text'] for s in signals), 'recommended_next_action': 'Review the linked blockers with the responsible owner and record a recovery date.', 'data_quality': 'owner_missing' if not source['owner'] else 'recorded', 'due_at': due.isoformat()})
    # Villa roll-ups retain the underlying evidence and never claim calibrated
    # probabilities. A missing handover date remains a data gap, not a prediction.
    for villa in (s for s in evidence if s['record_type'] == 'villas'):
        children = [card for card in cards if card['villa_id'] == villa['record_id']]
        packages = [s for s in evidence if s['record_type'] == 'handover_packages' and s['data'].get('villa_id') == villa['record_id'] and s['data'].get('status') != 'HANDED_OVER']
        for package in packages:
            target = date_value(package['data'].get('target_date') or villa['data'].get('target_handover_date'))
            pending = [s for s in evidence if s['record_type'] == 'handover_items' and s['data'].get('handover_id') == package['record_id'] and s['data'].get('required') and s['data'].get('status') not in {'READY', 'ACCEPTED'}]
            if target and target <= end and pending:
                children.append({'risk_score': 85 if target < now else 65, 'risk_level': 'critical' if target < now else 'high', 'villa_id': villa['record_id'], 'evidence_ids': [package['evidence_id']] + [s['evidence_id'] for s in pending], 'signals': [{'text': 'Required handover items are incomplete near the target date', 'weight': 65}], 'due_at': target.isoformat()})
        if not children:
            continue
        worst = max(children, key=lambda card: card['risk_score'])
        cards.append({**worst, 'id': villa['record_id'], 'entity_type': 'villa', 'title': villa['label'], 'owner': None, 'risk_score': worst['risk_score'], 'evidence_ids': sorted({villa['evidence_id']} | {id for card in children for id in card['evidence_ids']}), 'explanation': f"{len(children)} work or handover risks have recorded evidence in this villa.", 'recommended_next_action': 'Review the affected work and handover items with their owners and confirm the villa recovery plan.', 'data_quality': 'villa_owner_not_recorded'})
    return sorted(cards, key=lambda r: (-r['risk_score'], r['due_at'], r['id']))
