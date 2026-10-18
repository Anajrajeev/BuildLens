"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type ActiveModule = "Today" | "Quality" | "Materials" | "Procurement" | "Approvals" | "Safety" | "Daily reports" | "Reports" | "Handover" | "Inbox" | "AI";
type Villa = { id: string; villa_number: string };
type Task = { id: string; title?: string; status?: string; progress?: number; priority?: string; villa_id?: string; planned_end_at?: string };
type RecordItem = Record<string, unknown> & { id: string };

const label = (value: unknown) => String(value ?? "Not set").replaceAll("_", " ").toLowerCase();
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString() : "No date";

export function OperationsModule({ active, projectId, villas, tasks }: { active: ActiveModule; projectId?: string; villas: Villa[]; tasks: Task[] }) {
  if (!projectId) return <Empty title={active} text="Create a project before using this operational module." />;
  if (active === "Today") return <Agenda projectId={projectId} villas={villas} />;
  if (active === "Quality") return <Quality projectId={projectId} villas={villas} tasks={tasks} />;
  if (active === "Materials") return <Materials projectId={projectId} />;
  if (active === "Procurement") return <SimpleRegister title="Procurement" eyebrow="Purchase orders" path={`/procurement/purchase-orders?project_id=${projectId}`} />;
  if (active === "Approvals") return <Approvals projectId={projectId} />;
  if (active === "Safety") return <Safety projectId={projectId} villas={villas} />;
  if (active === "Daily reports") return <DailyReports projectId={projectId} villas={villas} />;
  if (active === "Reports") return <Reports projectId={projectId} />;
  if (active === "Handover") return <Handovers projectId={projectId} villas={villas} />;
  if (active === "Inbox") return <Inbox />;
  return <AiBriefing projectId={projectId} />;
}

function useItems(path: string) {
  const [items, setItems] = useState<RecordItem[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setItems((await api<{ items: RecordItem[] }>(path)).items); } catch (e) { setError(e instanceof Error ? e.message : "Could not load records."); } finally { setLoading(false); } }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { items, loading, error, load };
}

function Agenda({ projectId, villas }: { projectId: string; villas: Villa[] }) {
  const data = useItems(`/agenda?project_id=${projectId}`);
  const [show, setShow] = useState(false);
  const update = async (id: string, status: string) => { await api(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await data.load(); };
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api("/tasks", { method: "POST", body: JSON.stringify({ project_id: projectId, villa_id: form.get("villa_id") || null, name: form.get("name"), priority: form.get("priority"), planned_start_at: form.get("planned_start_at") || null, planned_end_at: form.get("planned_end_at") || null }) }); setShow(false); await data.load(); };
  return <Module title="Today" eyebrow="Field agenda" action={<button onClick={() => setShow(true)}>+ Plan work</button>}>
    <State data={data}>{data.items.map(item => <article className="ops-card" key={item.id}><div><span className={`record-badge ${String(item.priority || "normal").toLowerCase()}`}>{label(item.priority || "normal")}</span><h3>{String(item.name || item.title || "Work item")}</h3><p>{label(item.status)} · {date(item.planned_end_at)}</p></div><div className="progress-stack"><div className="progress-track"><i style={{ width: `${Number(item.progress || 0)}%` }} /></div><small>{Number(item.progress || 0)}%</small></div><div className="quick-actions"><button onClick={() => void update(item.id, "IN_PROGRESS")}>Start</button><button onClick={() => void update(item.id, "BLOCKED")}>Block</button><button className="accent" onClick={() => void update(item.id, "COMPLETED")}>Complete</button></div></article>)}</State>
    {show && <Modal title="Plan a work item" close={() => setShow(false)} save={save}><label>Work item<input name="name" required /></label><label>Villa<select name="villa_id"><option value="">Project-wide</option>{villas.map(v => <option key={v.id} value={v.id}>Villa {v.villa_number}</option>)}</select></label><label>Priority<select name="priority"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Planned start<input name="planned_start_at" type="datetime-local" /></label><label>Planned finish<input name="planned_end_at" type="datetime-local" /></label></Modal>}
  </Module>;
}

function Quality({ projectId, villas, tasks }: { projectId: string; villas: Villa[]; tasks: Task[] }) {
  const [tab, setTab] = useState<"snags" | "inspections">("snags");
  const [show, setShow] = useState(false);
  const data = useItems(`/quality/${tab}?project_id=${projectId}`);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const payload = tab === "snags" ? { project_id: projectId, villa_id: form.get("villa_id"), task_id: form.get("task_id") || null, title: form.get("title"), description: form.get("description"), severity: form.get("severity") } : { project_id: projectId, villa_id: form.get("villa_id"), task_id: form.get("task_id") || null, inspection_type: form.get("inspection_type"), notes: form.get("notes") || null };
    await api(`/quality/${tab}`, { method: "POST", body: JSON.stringify(payload) }); setShow(false); await data.load();
  };
  return <Module title="Quality control" eyebrow="Inspect · snag · verify" action={<button onClick={() => setShow(true)}>+ New {tab === "snags" ? "snag" : "inspection"}</button>}>
    <div className="segmented"><button className={tab === "snags" ? "active" : ""} onClick={() => setTab("snags")}>Snags</button><button className={tab === "inspections" ? "active" : ""} onClick={() => setTab("inspections")}>Inspections</button></div>
    <State data={data}><div className="record-grid">{data.items.map(item => <article className="record-tile" key={item.id}><span className="record-badge">{label(item.severity || item.inspection_type)}</span><h3>{String(item.title || item.inspection_type || "Inspection")}</h3><p>{String(item.description || item.notes || "No notes")}</p><small>{label(item.status || "pending")} · {date(item.due_at || item.scheduled_at)}</small></article>)}</div></State>
    {show && <Modal title={`Create ${tab === "snags" ? "a snag" : "an inspection"}`} close={() => setShow(false)} save={save}><VillaTaskFields villas={villas} tasks={tasks} />{tab === "snags" ? <><label>Title<input name="title" required /></label><label>Description<textarea name="description" required /></label><label>Severity<select name="severity" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label></> : <><label>Inspection type<input name="inspection_type" placeholder="Finishing / MEP / handover" required /></label><label>Notes<textarea name="notes" /></label></>}</Modal>}
  </Module>;
}

function Materials({ projectId }: { projectId: string }) {
  const data = useItems(`/materials?project_id=${projectId}`);
  return <Module title="Materials & inventory" eyebrow="Stock control" action="Receipts, issues and reorder exceptions in one ledger."><State data={data}><div className="record-grid">{data.items.map(item => { const product = (item.products || {}) as Record<string, unknown>; const low = Number(item.quantity_on_hand || 0) <= Number(item.reorder_level || 0); return <article className={`record-tile ${low ? "attention" : ""}`} key={item.id}><span className="record-badge">{String(product.sku || "Material")}</span><h3>{String(product.name || "Unnamed product")}</h3><strong>{Number(item.quantity_on_hand || 0)} {String(product.unit || "units")}</strong><small>{low ? "Reorder required" : `Reorder at ${Number(item.reorder_level || 0)}`}</small></article>; })}</div></State></Module>;
}

function SimpleRegister({ title, eyebrow, path }: { title: string; eyebrow: string; path: string }) {
  const data = useItems(path);
  return <Module title={title} eyebrow={eyebrow} action="Connected to the live operational register."><State data={data}><div className="module-list">{data.items.map(item => <article key={item.id}><b>{String(item.po_number || item.name || item.title || item.description || "Record")}</b><span>{label(item.status)} · {date(item.expected_at || item.created_at || item.requested_at)}</span></article>)}</div></State></Module>;
}

function Approvals({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<"wirs" | "drawings">("wirs");
  const data = useItems(`/${tab}?project_id=${projectId}`);
  return <Module title="Approvals & drawings" eyebrow="Controlled information" action="WIR decisions and current drawing records stay traceable."><div className="segmented"><button className={tab === "wirs" ? "active" : ""} onClick={() => setTab("wirs")}>WIR approvals</button><button className={tab === "drawings" ? "active" : ""} onClick={() => setTab("drawings")}>Drawings</button></div><State data={data}><div className="module-list">{data.items.map(item => <article key={item.id}><b>{String(item.document_type || item.description || "Controlled record")}</b><span>{label(item.status || item.approval_status)} · {String(item.revision || item.version || "Current")}</span></article>)}</div></State></Module>;
}

function Inbox() {
  const data = useItems("/notifications");
  const read = async (id: string) => { await api(`/notifications/${id}/read`, { method: "PATCH" }); await data.load(); };
  return <Module title="Inbox" eyebrow="Alerts & escalations" action="Operational notices remain linked to their source records."><State data={data}><div className="module-list inbox-list">{data.items.map(item => <article key={item.id}><div><b>{String(item.title || "Notification")}</b><span>{String(item.body || label(item.type))}</span></div>{item.read_at ? <small>Read</small> : <button onClick={() => void read(item.id)}>Mark read</button>}</article>)}</div></State></Module>;
}

function Safety({ projectId, villas }: { projectId: string; villas: Villa[] }) {
  const data = useItems(`/safety?project_id=${projectId}`); const [show, setShow] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api("/safety", { method: "POST", body: JSON.stringify({ project_id: projectId, villa_id: form.get("villa_id") || null, observation_type: form.get("observation_type"), severity: form.get("severity"), description: form.get("description"), corrective_action: form.get("corrective_action") || null }) }); setShow(false); await data.load(); };
  return <Module title="Safety" eyebrow="Observe · act · close" action={<button onClick={() => setShow(true)}>+ Log observation</button>}><State data={data}><div className="record-grid">{data.items.map(item => <article className="record-tile" key={item.id}><span className="record-badge">{label(item.observation_type)}</span><h3>{label(item.severity)} severity</h3><p>{String(item.description)}</p><small>{label(item.status || "open")} · {date(item.created_at)}</small></article>)}</div></State>{show && <Modal title="Log a safety observation" close={() => setShow(false)} save={save}><label>Villa<select name="villa_id"><option value="">Project-wide</option>{villas.map(v => <option key={v.id} value={v.id}>Villa {v.villa_number}</option>)}</select></label><label>Type<select name="observation_type"><option>OBSERVATION</option><option>INCIDENT</option><option>NEAR_MISS</option><option>TOOLBOX_TALK</option><option>PERMIT</option></select></label><label>Severity<select name="severity"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Description<textarea name="description" required /></label><label>Corrective action<textarea name="corrective_action" /></label></Modal>}</Module>;
}

function DailyReports({ projectId, villas }: { projectId: string; villas: Villa[] }) {
  const data = useItems(`/daily-reports?project_id=${projectId}`); const [show, setShow] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api("/daily-reports", { method: "POST", body: JSON.stringify({ project_id: projectId, villa_id: form.get("villa_id") || null, report_date: form.get("report_date"), weather: form.get("weather") || null, workforce_count: Number(form.get("workforce_count") || 0), summary: form.get("summary"), constraints: form.get("constraints") || null }) }); setShow(false); await data.load(); };
  return <Module title="Daily reports" eyebrow="Site diary" action={<button onClick={() => setShow(true)}>+ Submit report</button>}><State data={data}><div className="timeline">{data.items.map(item => <article key={item.id}><time>{date(item.report_date)}</time><div><h3>{String(item.summary)}</h3><p>{Number(item.workforce_count || 0)} workers · {String(item.weather || "Weather not recorded")}</p>{item.constraints ? <small>Constraint: {String(item.constraints)}</small> : null}</div></article>)}</div></State>{show && <Modal title="Submit daily report" close={() => setShow(false)} save={save}><label>Date<input name="report_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><label>Villa<select name="villa_id"><option value="">Project-wide</option>{villas.map(v => <option key={v.id} value={v.id}>Villa {v.villa_number}</option>)}</select></label><label>Weather<input name="weather" /></label><label>Workforce<input name="workforce_count" type="number" min="0" defaultValue="0" /></label><label>Summary<textarea name="summary" required /></label><label>Constraints<textarea name="constraints" /></label></Modal>}</Module>;
}

function Reports({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null), [error, setError] = useState("");
  useEffect(() => { void api<Record<string, unknown>>(`/reports/overview?project_id=${projectId}`).then(setReport).catch(e => setError(e instanceof Error ? e.message : "Could not load report.")); }, [projectId]);
  const metrics = (report?.metrics || {}) as Record<string, unknown>; const exceptions = (report?.exceptions || []) as RecordItem[];
  return <Module title="Operational intelligence" eyebrow="Live reporting" action="Every metric links back to current project records.">{error ? <Notice text={error} /> : !report ? <Loading /> : <><div className="metric-grid ops-metrics"><Metric value={metrics.tasks_total} label="Tasks" /><Metric value={`${metrics.average_progress || 0}%`} label="Average progress" /><Metric value={metrics.open_snags} label="Open snags" /><Metric value={metrics.low_stock_items} label="Low-stock items" /></div><h3 className="section-label">Exceptions requiring attention</h3>{exceptions.length ? <div className="module-list">{exceptions.map((item, index) => <article key={`${item.type}-${index}`}><b>{label(item.type)}</b><span>{String(item.message || item.title || "Review this exception")}</span></article>)}</div> : <p className="empty-inline">No exceptions are currently reported.</p>}</>}</Module>;
}

function Handovers({ projectId, villas }: { projectId: string; villas: Villa[] }) {
  const data = useItems(`/handovers?project_id=${projectId}`); const [show, setShow] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api("/handovers", { method: "POST", body: JSON.stringify({ project_id: projectId, villa_id: form.get("villa_id"), target_date: form.get("target_date") || null, customer_name: form.get("customer_name") || null, notes: form.get("notes") || null }) }); setShow(false); await data.load(); };
  return <Module title="Handover readiness" eyebrow="Closeout" action={<button onClick={() => setShow(true)}>+ Start handover</button>}><State data={data}><div className="record-grid">{data.items.map(item => <article className="record-tile" key={item.id}><span className="record-badge">{label(item.status)}</span><h3>{String(item.customer_name || "Customer pending")}</h3><div className="progress-stack"><div className="progress-track"><i style={{ width: `${Number(item.readiness_score || 0)}%` }} /></div><small>{Number(item.readiness_score || 0)}% ready</small></div><small>Target {date(item.target_date)}</small></article>)}</div></State>{show && <Modal title="Start handover package" close={() => setShow(false)} save={save}><label>Villa<select name="villa_id" required><option value="">Select villa</option>{villas.map(v => <option key={v.id} value={v.id}>Villa {v.villa_number}</option>)}</select></label><label>Target date<input name="target_date" type="date" /></label><label>Customer<input name="customer_name" /></label><label>Notes<textarea name="notes" /></label></Modal>}</Module>;
}

function AiBriefing({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("What needs attention today?"), [answer, setAnswer] = useState(""), [mode, setMode] = useState(""), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const ask = async (event?: FormEvent) => { event?.preventDefault(); setLoading(true); setError(""); try { const result = await api<{ answer: string; mode: string }>("/ai/briefing", { method: "POST", body: JSON.stringify({ project_id: projectId, question }) }); setAnswer(result.answer); setMode(result.mode); } catch (e) { setError(e instanceof Error ? e.message : "AI briefing failed."); } finally { setLoading(false); } };
  return <Module title="BuildLens AI" eyebrow="Operations copilot" action="Grounded in your live project data; no operational change is made without a human."><section className="ai-console"><form onSubmit={ask}><label>Ask about project risk, schedule, quality or materials<textarea value={question} onChange={event => setQuestion(event.target.value)} /></label><div className="prompt-chips"><button type="button" onClick={() => setQuestion("Summarise today's critical risks and next actions.")}>Critical risks</button><button type="button" onClick={() => setQuestion("Which villas or tasks are most likely to slip?")}>Likely delays</button><button type="button" onClick={() => setQuestion("Prepare a concise morning briefing for the site team.")}>Morning briefing</button></div><button className="primary" disabled={loading}>{loading ? "Analysing…" : "Generate briefing"} <span>✦</span></button></form>{error && <Notice text={error} />}{answer && <article className="ai-answer"><div><span>AI briefing</span><small>{mode === "gemini" ? "Gemini-grounded analysis" : "Deterministic project analysis"}</small></div><p>{answer}</p></article>}</section></Module>;
}

function Module({ title, eyebrow, action, children }: { title: string; eyebrow: string; action: ReactNode; children: ReactNode }) { return <section className="panel module-panel operations-module"><div className="panel-head"><div><p className="overline">{eyebrow}</p><h2>{title}</h2></div><div className="module-action">{action}</div></div>{children}</section>; }
function State({ data, children }: { data: { items: RecordItem[]; loading: boolean; error: string }; children: ReactNode }) { if (data.loading) return <Loading />; if (data.error) return <Notice text={data.error} />; if (!data.items.length) return <p className="empty-inline">No records yet. Add the first one to begin the workflow.</p>; return <>{children}</>; }
function Loading() { return <p className="module-loading">Loading live records…</p>; }
function Notice({ text }: { text: string }) { return <p className="notice">{text}</p>; }
function Empty({ title, text }: { title: string; text: string }) { return <section className="empty-module"><p className="overline">Module unavailable</p><h2>{title}</h2><p>{text}</p></section>; }
function Metric({ value, label: metricLabel }: { value: unknown; label: string }) { return <article className="metric"><b>{String(value ?? 0)}</b><span>{metricLabel}</span></article>; }
function VillaTaskFields({ villas, tasks }: { villas: Villa[]; tasks: Task[] }) { return <><label>Villa<select name="villa_id" required><option value="">Select villa</option>{villas.map(v => <option key={v.id} value={v.id}>Villa {v.villa_number}</option>)}</select></label><label>Task<select name="task_id"><option value="">No linked task</option>{tasks.map((task, index) => <option key={task.id} value={task.id}>{task.title || `Task ${index + 1}`}</option>)}</select></label></>; }
function Modal({ title, close, save, children }: { title: string; close: () => void; save: (event: FormEvent<HTMLFormElement>) => Promise<void>; children: ReactNode }) { const [error, setError] = useState(""), [saving, setSaving] = useState(false); return <div className="modal"><form onSubmit={async event => { setSaving(true); setError(""); try { await save(event); } catch (e) { setError(e instanceof Error ? e.message : "Could not save the record."); } finally { setSaving(false); } }}><button type="button" className="close" onClick={close}>×</button><p className="overline">Operational workflow</p><h2>{title}</h2>{children}<button className="primary" disabled={saving}>{saving ? "Saving…" : "Save record"} <span>→</span></button>{error && <Notice text={error} />}</form></div>; }
