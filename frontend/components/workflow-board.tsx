"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { activityState, latestEvents, reference, statusLabels, WorkEvent, WorkStatus } from '@/lib/workflow';
import './workflow-board.css';

type Project = { id: string; name: string };
type Villa = { id: string; villa_number: string };
type Activity = typeof reference.activities[number];

export default function WorkflowBoard({ projects, canEdit }: { projects: Project[]; canEdit: boolean }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [villas, setVillas] = useState<Villa[]>([]), [events, setEvents] = useState<WorkEvent[]>([]);
  const [villaId, setVillaId] = useState(''), [view, setView] = useState('timeline');
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setVillaId(''); setSelected(null); setEvents([]); setVillas([]);
    if (!projectId) { setLoading(false); return; }
    void (async () => {
      try {
        const villaResponse = await api<{ items: Villa[] }>(`/projects/${projectId}/villas`);
        let offset: number | null = 0; const history: WorkEvent[] = [];
        while (offset !== null) {
          const page: { items: WorkEvent[]; next_offset: number | null } = await api(`/workflow/${projectId}?offset=${offset}`);
          history.push(...page.items); offset = page.next_offset;
        }
        if (!cancelled) { setVillas(villaResponse.items); setEvents(history); }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load workflow.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId, refresh]);
  const ids = villaId ? [villaId] : villas.map(v => v.id);
  const states = useMemo(() => new Map(reference.activities.map(a => [a.id, activityState(events, villaId ? [villaId] : villas.map(v => v.id), a.id)])), [events, villaId, villas]);
  const current = latestEvents(events);
  const active = reference.activities.filter(a => states.get(a.id)?.status === 'IN_PROGRESS');
  const rework = reference.activities.filter(a => states.get(a.id)?.status === 'REWORK_REQUIRED');
  const completed = reference.activities.filter(a => states.get(a.id)?.status === 'COMPLETED').length;
  const visible = reference.activities.filter(a => a.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || states.get(a.id)?.status === filter));
  const outOfOrder = (activity: Activity) => Boolean(villaId && events.some(e => e.villa_id === villaId && e.activity_key === activity.id && e.status !== 'NOT_STARTED') && reference.activities.some(a => a.order < activity.order && current.get(`${villaId}/${a.id}`)?.status !== 'COMPLETED'));
  return <div className="wf">
    <section className="wf-hero"><div><p className="overline">Ellegenza finishing workflow</p><h2>Every stage. Every villa.<br/><em>One connected view.</em></h2><p>Follow the plan, see work happening together, and keep every return to a section visible.</p></div><div className="wf-orbit" aria-hidden="true"><span>PLAN</span><i/><b>89</b><small>activities</small><span>BUILD · REVIEW · REFINE</span></div></section>
    <div className="wf-toolbar"><label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)}>{!projects.length && <option value="">No projects</option>}{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>View progress for<select value={villaId} disabled={loading || !!error} onChange={e => { setVillaId(e.target.value); setSelected(null); }}><option value="">All villas · project overview</option>{villas.map(v => <option value={v.id} key={v.id}>Villa {v.villa_number}</option>)}</select></label><button onClick={() => setRefresh(n => n + 1)} disabled={loading}>Refresh progress ↻</button></div>
    {loading ? <p className="wf-message" role="status">Loading villa workflow…</p> : error ? <p className="wf-message wf-error" role="alert">Live progress unavailable: {error} Reference plans remain available below.</p> : <div className="wf-metrics"><div><b>{completed}<small> / 89</small></b><span>Sections complete{!villaId ? ' across all villas' : ''}</span></div><div><b>{active.length}</b><span>{villaId ? 'Sections in progress together' : 'Sections with active or partial progress'}</span></div><div><b>{rework.length}</b><span>Sections needing rework</span></div><div><b>{ids.length}</b><span>{villaId ? 'Villa selected' : 'Villas in this project'}</span></div></div>}
    <div className="wf-tabs" role="tablist" aria-label="Workflow view">{[['timeline','150-day reference'],['phases','Phase board'],['register','Activity register']].map(([id,label]) => <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
    <p className="wf-caption">{view === 'timeline' ? 'Sheet2 · Five relative 30-day months. Coloured bands reproduce the workbook schedule, including parallel windows; these are not actual villa dates.' : 'Sheet1 · Original activity order, grouped into six suggested phases. Phases can overlap; the order does not block work.'}</p>
    {view !== 'timeline' && <><div className="wf-search"><input aria-label="Search activities" placeholder="Find an activity, floor or trade…" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Every status</option>{Object.entries(statusLabels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></div><div className="wf-legend"><span>○ Not started</span><span>◉ In progress</span><span>! Blocked</span><span>↺ Rework</span><span>✓ Complete</span></div></>}
    {view === 'timeline' ? <div className="wf-timeline-scroll" tabIndex={0} aria-label="Reference schedule, scroll horizontally"><div className="wf-timeline"><div className="wf-timeline-head"><b>Work package</b><div>{[1,2,3,4,5].map(m => <span key={m}>Month {m}<small>Days {(m-1)*30+1}–{m*30}</small></span>)}</div></div>{reference.schedule.map(row => <div className="wf-timeline-row" key={row.row}><div><b>{row.name}</b><small>Sheet2 · row {row.row}{row.row >= 13 && row.row <= 16 ? ' · repeated source label' : ''}</small></div><div className="wf-track">{row.bands.map((band,i) => <span key={i} title={`${row.name}: day ${band.start}–${band.end}`} style={{left:`${(band.start-1)/150*100}%`,width:`${(band.end-band.start+1)/150*100}%`}}>{band.end-band.start+1 >= 6 ? `${band.start}–${band.end}` : ''}</span>)}{!row.bands.length && <small>Section heading · no painted schedule</small>}</div></div>)}</div></div> : <div className={view === 'phases' ? 'wf-phases' : 'wf-register'}>{reference.phases.map((phase,index) => {
      const activities = visible.filter(a => a.phase === index); if (!activities.length) return null;
      return <section className="wf-phase" key={phase}><div className="wf-phase-head"><span>{String(index+1).padStart(2,'0')}</span><div><h3>{phase}</h3><small>{reference.activities.filter(a => a.phase === index && states.get(a.id)?.status === 'COMPLETED').length} / {reference.activities.filter(a => a.phase === index).length} complete</small></div><i aria-hidden="true">→</i></div><div className="wf-cards">{activities.map(a => {
        const state = states.get(a.id)!; const unavailable = loading || !!error;
        return <button key={a.id} className={`wf-card ${unavailable ? '' : state.status}`} onClick={() => setSelected(a)}><div className="wf-card-top"><small>#{String(a.order).padStart(2,'0')}</small><span>{unavailable ? 'Progress unavailable' : !state.recorded ? 'No update yet' : statusLabels[state.status]}</span></div><h4>{a.name}</h4><div className="wf-card-bottom"><span>{a.duration === null ? 'Duration not specified' : `${a.duration} days planned`}</span><b>{unavailable ? '—' : `${state.progress}%`}</b></div><div className="wf-progress"><i style={{width:`${unavailable ? 0 : state.progress}%`}}/></div>{!unavailable && <div className="wf-flags">{state.reworks > 0 && <span>↺ {state.reworks} rework {state.reworks === 1 ? 'cycle' : 'cycles'}</span>}{outOfOrder(a) && <span>Earlier work still open</span>}{!villaId && state.recorded > 0 && <span>{state.complete}/{ids.length} villas complete · {state.recorded} reported</span>}</div>}</button>;
      })}</div></section>;
    })}{visible.length === 0 && <p className="wf-message">No activities match these filters.</p>}</div>}
    <details className="wf-source"><summary>Workbook notes & planning assumptions</summary><p>Source: {reference.source}. All 89 Sheet1 activities and all 45 Sheet2 rows are retained. Phase names are suggested groupings, not named phases in the workbook. Sheet1 durations are individual activity estimates; their 526-day sum is not the project duration.</p><p>Sheet2 has overlapping bands, four rows labelled “GF Screed for tiles”, and duration labels that sometimes differ from painted spans. Painted cells define the displayed windows; duration annotation cells are excluded. No calendar start date or mandatory dependency graph was supplied. Sheet1 and Sheet2 are separate references and have not been forced into a one-to-one match.</p><p>Project percentages give each villa equal weight and count unreported activities as 0%. Villa updates here are section-level records, separate from task progress in Today. “Earlier work still open” is a reference-order observation, not a dependency violation.</p><details><summary>Original schedule annotations</summary>{reference.schedule.filter(r => r.annotations.length).map(r => <p key={r.row}><b>{r.name}</b> — {r.annotations.join('; ')}</p>)}</details></details>
    {selected && <ActivityPanel key={`${villaId}/${selected.id}`} activity={selected} projectId={projectId} villaId={villaId} villaName={villas.find(v => v.id === villaId)?.villa_number} events={events} enabled={canEdit && !loading && !error} close={() => setSelected(null)} saved={event => setEvents(previous => [...previous, event])}/>}
  </div>;
}

function ActivityPanel({ activity, projectId, villaId, villaName, events, enabled, close, saved }: { activity: Activity; projectId: string; villaId: string; villaName?: string; events: WorkEvent[]; enabled: boolean; close: () => void; saved: (event: WorkEvent) => void }) {
  const dialog = useRef<HTMLElement>(null);
  const history = events.filter(e => e.villa_id === villaId && e.activity_key === activity.id).sort((a,b) => b.revision-a.revision);
  const current = history[0];
  const [status, setStatus] = useState<WorkStatus>(current?.status || 'NOT_STARTED'), [progress, setProgress] = useState(current?.progress || 0), [note, setNote] = useState('');
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) close();
      if (e.key === 'Tab') {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary') || []).filter(el => !el.closest('fieldset:disabled'));
        const first = elements[0], last = elements[elements.length-1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown',listener);
  }, [close, saving]);
  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      const event = await api<WorkEvent & { queued?: boolean }>(`/workflow/${projectId}`, { method:'POST', body:JSON.stringify({villa_id:villaId, activity_key:activity.id, revision:(current?.revision || 0)+1,status,progress,note}) });
      if (event.queued) setMessage('Queued offline. Progress will appear after synchronization and refresh.');
      else { saved(event); setNote(''); setMessage('Progress saved.'); }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not save.'); }
    finally { setSaving(false); }
  }
  return <div className="wf-detail-backdrop"><section ref={dialog} className="wf-detail" role="dialog" aria-modal="true" aria-labelledby="wf-detail-title"><button autoFocus className="wf-close" disabled={saving} onClick={close} aria-label="Close activity">×</button><p className="overline">{villaId ? `Villa ${villaName}` : 'Activity reference'} · #{activity.order}</p><h2 id="wf-detail-title">{activity.name}</h2><p>{reference.phases[activity.phase]} · {activity.duration === null ? 'Duration not specified' : `${activity.duration} planned days`}</p><small>{activity.source}</small>{activity.remarks && <div className="wf-remark"><b>Site clearance & work notes</b><p>{activity.remarks}</p></div>}{!villaId ? <p className="wf-message">Select a villa to record progress and see its activity history.</p> : <><form onSubmit={save}><fieldset disabled={!enabled || saving}><legend>Update this villa</legend><label>Status<select value={status} onChange={e => { const value = e.target.value as WorkStatus; setStatus(value); setProgress(value === 'COMPLETED' ? 100 : value === 'NOT_STARTED' || value === 'REWORK_REQUIRED' ? 0 : Math.min(progress,99)); }}>{Object.entries(statusLabels).map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select></label><label>Current completion (%)<input type="number" min="0" max={status === 'COMPLETED' ? 100 : 99} required value={progress} disabled={status === 'COMPLETED' || status === 'NOT_STARTED'} onChange={e => setProgress(Number(e.target.value))}/></label><label>{status === 'REWORK_REQUIRED' ? 'Rework reason (required)' : 'Site note'}<textarea maxLength={2000} required={status === 'REWORK_REQUIRED'} value={note} onChange={e => setNote(e.target.value)}/></label>{status === 'REWORK_REQUIRED' && <p>Previous completion stays in history. Set the progress of the current rework cycle.</p>}<button className="primary" type="submit">{saving ? 'Saving…' : 'Save villa progress'}</button></fieldset></form>{!enabled && <p>Live access and work editing permission are required to save.</p>}<p role="status">{message}</p><h3>Activity history</h3>{!history.length && <p>No updates recorded for this villa.</p>}<ol className="wf-history">{history.map(event => <li key={event.id}><b>{statusLabels[event.status]} · {event.progress}%</b><time>{new Date(event.created_at).toLocaleString()}</time>{event.note && <p>{event.note}</p>}</li>)}</ol></>}</section></div>;
}

