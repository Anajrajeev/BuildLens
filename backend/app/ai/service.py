import re
from uuid import uuid4

from app.ai.context import build_context
from app.ai.gemini import generate, valid_claims
from app.ai.risk_engine import attention, risk_cards
from app.ai.schemas import Answer, Claim, DraftText, RiskOutput
from app.core.config import get_settings
from app.core.errors import api_error


def recorded_claims(evidence, question):
    """Build a small, citation-backed answer without an LLM when it is unavailable."""
    words = set(re.findall(r'\w+', question.lower()))
    def relevance(source):
        searchable = f"{source['label']} {source['record_type']} {source['data']}".lower()
        return -len(words & set(re.findall(r'\w+', searchable)))

    ranked = sorted(evidence, key=relevance)
    claims = []
    for source in ranked:
        row = source['data']
        details = []
        if row.get('status'):
            details.append(f"recorded status: {str(row['status']).replace('_', ' ').lower()}")
        for key, label in (('planned_end_at', 'planned finish'), ('due_at', 'due date'), ('target_date', 'target date'), ('target_handover_date', 'target handover')):
            if row.get(key):
                details.append(f"{label}: {str(row[key])[:10]}")
        for key in ('reason', 'summary', 'description', 'notes', 'note'):
            value = row.get(key)
            if isinstance(value, str) and value.strip():
                details.append(value.strip()[:300])
                break
        if not details:
            continue
        claims.append({'text': f"{source['label']}: " + '; '.join(details) + '.', 'evidence_ids': [source['evidence_id']]})
        if len(claims) == 5:
            break
    return claims


class Intelligence:
    def __init__(self, repository):
        self.repo = repository

    async def run(self, user, query, mode):
        context = await build_context(self.repo, user, query.project_id, query.villa_id)
        entity_missing = None
        if mode == 'ask' and not query.villa_id:
            match = re.search(r'\bvilla\s+([\w-]+)', query.question, re.IGNORECASE)
            if match and match.group(1).lower() not in {'delayed', 'is', 'has', 'handover', 'work'}:
                villas = [s for s in context['evidence'] if s['record_type'] == 'villas' and str(s['data'].get('villa_number', '')).lower() == match.group(1).lower()]
                if len(villas) == 1:
                    context = await build_context(self.repo, user, query.project_id, villas[0]['record_id'])
                else:
                    entity_missing = 'The named villa could not be resolved in this project. Select a villa before asking again.'
            elif 'this villa' in query.question.lower():
                entity_missing = 'Select a villa so the answer can use the right records.'
        evidence = context['evidence']
        items = attention(context)
        cards = risk_cards(context, query.horizon_days)
        selected = evidence
        tool = 'attention'
        fallback = None
        model_used = False
        if mode == 'ask' and evidence and not entity_missing:
            text = query.question.lower()
            if any(term in text for term in ('inspection', 'snag', 'quality', 'defect', 'handover')):
                tool = 'handover' if 'handover' in text else 'quality'
            elif any(term in text for term in ('material', 'stock', 'supply', 'vendor', 'purchase')):
                tool = 'materials'
            elif any(term in text for term in ('schedule', 'delay', 'late', 'slip', 'blocked', 'blocker', 'task')):
                tool = 'schedule'
            elif any(term in text for term in ('drawing', 'document', 'plan')):
                tool = 'documents'
            else:
                tool = 'records'
            categories = {'quality': {'inspections', 'snags', 'quality_issues', 'work_inspection_requests'}, 'schedule': {'tasks', 'task_dependencies', 'delay_events', 'progress_updates', 'vendor_commitments', 'villa_workflow_events'}, 'materials': {'materials', 'purchase_orders', 'material_allocations'}, 'handover': {'handover_packages', 'handover_items', 'inspections', 'snags'}, 'documents': {'ai_document_chunks'}}
            if tool in categories:
                selected = [s for s in evidence if s['record_type'] in categories[tool] | {'villas'}]
            words = set(re.findall(r'\w+', query.question.lower()))
            selected = sorted(selected, key=lambda s: -len(words & set(re.findall(r'\w+', str(s['data']).lower()))))[:60]
        elif mode == 'briefing':
            ids = {r['id'] for r in items[:40]}
            selected = [s for s in evidence if s['evidence_id'] in ids]
        elif mode == 'risks':
            ids = {e for card in cards[:30] for e in card['evidence_ids']}
            selected = [s for s in evidence if s['evidence_id'] in ids]
        claims = []
        missing = []
        if mode == 'risks' and cards:
            output, fallback = await generate(RiskOutput, 'Explain these deterministic schedule risk cards. Do not change their identity, scores, owners or evidence. Recommend next actions.', {'cards': cards[:30], 'sources': selected})
            if output and valid_claims([Claim(text=r.explanation, evidence_ids=r.evidence_ids) for r in output.risks], selected):
                by_id = {r.risk_id: r for r in output.risks}
                for card in cards:
                    explanation = by_id.get(card['id'])
                    if explanation and set(explanation.evidence_ids) <= set(card['evidence_ids']):
                        card['explanation'] = explanation.explanation
                        card['recommended_next_action'] = explanation.recommended_next_action
                        model_used = True
            elif output:
                fallback = 'Generated evidence references failed validation; showing rule-based risk explanations.'
        elif selected and mode != 'attention' and not entity_missing:
            output, fallback = await generate(Answer, f'{mode}: {query.question}. Only cite sources that support each claim. An incomplete inspection is not automatically a handover blocker without a recorded link or requirement.', selected)
            if output and valid_claims(output.claims, selected):
                claims = [r.model_dump() for r in output.claims]
                missing = output.missing_information
                model_used = True
            elif output:
                fallback = 'Generated evidence references failed validation; showing recorded facts.'
        if not claims and mode in {'briefing', 'attention'}:
            claims = [{'text': f"{item['title']}: {item['reason']}.", 'evidence_ids': item['evidence_ids']} for item in items[:8]]
        if mode == 'ask' and not model_used and not entity_missing:
            claims = recorded_claims(selected, query.question)
            if claims:
                missing = ['Gemini is unavailable, so this is a summary of recorded fields, not an inferred explanation.']
            else:
                missing = ['The selected records do not contain fields that answer this question. Try a villa, task, inspection, material, or approval name.']
        if entity_missing:
            missing = [entity_missing]
            selected = []
        if not evidence:
            missing = ['No operational records exist in the selected scope yet. Add tasks, inspections, materials or handover records to begin.']
        if mode == 'risks':
            unscheduled = sum(1 for s in evidence if s['record_type'] == 'tasks' and not s['data'].get('planned_end_at'))
            if unscheduled:
                missing.append(f'{unscheduled} tasks have no planned finish and cannot be evaluated against the forecast horizon.')
        response = {'run_id': str(uuid4()), 'mode': 'gemini' if model_used else 'rules', 'fallback_reason': fallback, 'as_of': context['as_of'], 'project_id': context['project_id'], 'snapshot_hash': context['snapshot_hash'], 'claims': claims, 'answer': '\n'.join(r['text'] for r in claims), 'missing_information': missing, 'attention_items': items, 'risks': cards, 'horizon_days': query.horizon_days, 'sources': selected, 'counts': {category: sum(i['category'] == category for i in items) for category in sorted({i['category'] for i in items})}, 'tool_used': tool, 'can_draft': 'project.write' in user.permissions}
        await self.repo.create('ai_runs', user.organization_id, {'id': response['run_id'], 'project_id': str(query.project_id), 'created_by': str(user.id), 'run_type': mode, 'model': get_settings().gemini_model if model_used else 'rules-v1', 'prompt_version': 'operations-v1', 'snapshot_hash': context['snapshot_hash'], 'evidence_ids': [s['evidence_id'] for s in selected], 'mode': response['mode'], 'fallback_reason': fallback})
        if mode != 'ask':
            visible_ids = {ref for item in items for ref in item['evidence_ids']} | {ref for card in cards for ref in card['evidence_ids']}
            response['sources'] = [s for s in evidence if s['evidence_id'] in visible_ids]
        return response

    async def draft(self, user, query):
        if 'project.write' not in user.permissions:
            raise api_error('FORBIDDEN', 'Project write permission is required to prepare drafts.', 403)
        context = await build_context(self.repo, user, query.project_id, query.villa_id)
        if query.kind in {'snag', 'handover_note'} and not query.villa_id:
            raise api_error('VILLA_REQUIRED', 'Select a villa for this draft.', 422)
        if query.kind == 'vendor_followup':
            vendor = await self.repo.get('vendors', user.organization_id, query.vendor_id) if query.vendor_id else None
            if not vendor:
                raise api_error('VENDOR_REQUIRED', 'Select a vendor for this follow-up.', 422)
        sources = [s for s in context['evidence'] if s['record_type'] != 'ai_document_chunks'][:80]
        if not sources:
            raise api_error('NO_EVIDENCE', 'Add project records before generating a draft.', 422)
        if query.vendor_id:
            sources = [s for s in sources if s['data'].get('vendor_id') == str(query.vendor_id) or s['data'].get('assigned_vendor_id') == str(query.vendor_id)]
        if not sources:
            raise api_error('NO_EVIDENCE', 'There are no records linked to this vendor in the selected scope.', 422)
        result, fallback = await generate(DraftText, f'Prepare a {query.kind} draft for review. User guidance: {query.question}. Do not invent weather, workforce, completion or delivery dates. Do not say anything was sent or saved.', sources)
        if not result or not valid_claims([Claim(text=result.content, evidence_ids=result.evidence_ids)], sources):
            result = DraftText(title=query.kind.replace('_', ' ').title(), content='Please review the following recorded items:\n' + '\n'.join(f"- {s['label']}: {s['data'].get('status', 'status not recorded')}" for s in sources[:12]), evidence_ids=[s['evidence_id'] for s in sources[:12]])
            fallback = fallback or 'Showing a factual draft template for review.'
        return await self.repo.create('ai_drafts', user.organization_id, {**result.model_dump(), 'project_id': str(query.project_id), 'villa_id': str(query.villa_id) if query.villa_id else None, 'vendor_id': str(query.vendor_id) if query.vendor_id else None, 'kind': query.kind, 'status': 'DRAFTED', 'revision': 1, 'created_by': str(user.id), 'snapshot_hash': context['snapshot_hash'], 'sources': [s for s in sources if s['evidence_id'] in result.evidence_ids], 'fallback_reason': fallback})
