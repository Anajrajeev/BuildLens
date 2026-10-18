"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, ErrorBanner, Select, Textarea } from "./ui";

type Source = { evidence_id: string; record_type: string; record_id: string; label: string; url: string; data: Record<string, unknown> };
type Claim = { text: string; evidence_ids: string[] };
type Owner = { id: string | null; name: string | null } | null;
type Attention = { id: string; category: string; title: string; reason: string; owner: Owner; evidence_ids: string[] };
type Risk = { id: string; title: string; risk_level: string; risk_score: number; explanation: string; recommended_next_action: string; owner: Owner; evidence_ids: string[]; villa_id?: string };
type Result = { mode: string; as_of: string; answer: string; claims: Claim[]; missing_information: string[]; fallback_reason?: string; attention_items: Attention[]; risks: Risk[]; sources: Source[]; counts: Record<string, number> };
type ChatMessage = { id: string; role: "user" | "assistant"; text?: string; claims?: Claim[]; missing?: string[]; sources?: Source[]; pending?: boolean };

function normalizeResult(value: Partial<Result>): Result {
  const claims = Array.isArray(value.claims) ? value.claims : [];
  const attentionItems = Array.isArray(value.attention_items) ? value.attention_items : [];
  const risks = Array.isArray(value.risks) ? value.risks : [];
  return {
    ...value,
    mode: value.mode ?? "rules",
    as_of: value.as_of ?? new Date().toISOString(),
    answer: typeof value.answer === "string" ? value.answer : "",
    claims: claims.filter(Boolean).map((claim) => ({ ...claim, text: claim.text ?? "", evidence_ids: Array.isArray(claim.evidence_ids) ? claim.evidence_ids : [] })),
    missing_information: Array.isArray(value.missing_information) ? value.missing_information.filter((item): item is string => typeof item === "string") : [],
    attention_items: attentionItems.filter(Boolean).map((item, index) => ({ ...item, id: item.id ?? `attention-${index}`, evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids : [] })),
    risks: risks.filter(Boolean).map((risk, index) => ({ ...risk, id: risk.id ?? `risk-${index}`, evidence_ids: Array.isArray(risk.evidence_ids) ? risk.evidence_ids : [] })),
    sources: Array.isArray(value.sources) ? value.sources.filter(Boolean) : [],
    counts: value.counts && typeof value.counts === "object" ? value.counts : {},
  } as Result;
}

function Citations({ ids, sources }: { ids: string[]; sources: Source[] }) {
  return <span className="mt-2 flex flex-wrap gap-2">{ids.map((id) => {
    const source = sources.find((item) => item.evidence_id === id);
    return source ? <a key={id} className="text-xs text-accent-text underline underline-offset-2" href={source.url}>{source.label}</a> : null;
  })}</span>;
}

export function IntelligencePanel({ projectId, projectName, surface = "ai", villas = [] }: { projectId?: string; projectName?: string; surface?: "ai" | "dashboard" | "today"; villas?: { id: string; villa_number: string }[] }) {
  const [tab, setTab] = useState("briefing");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("What needs attention today?");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [horizon, setHorizon] = useState(14);
  const [villa, setVilla] = useState("");
  const [category, setCategory] = useState("all");
  const full = surface === "ai";
  const chatTitle = `Chat with ${projectName || "this project"}`;

  const run = useCallback(async (endpoint: string, prompt?: string) => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    if (endpoint !== "ask") setResult(null);
    try {
      const raw = endpoint === "attention"
        ? await api<Partial<Result>>(`/ai/attention?project_id=${projectId}${villa ? `&villa_id=${villa}` : ""}`)
        : await api<Partial<Result>>(`/ai/${endpoint}`, { method: "POST", body: JSON.stringify({ project_id: projectId, villa_id: villa || null, question: prompt ?? question, horizon_days: horizon }) });
      const data = normalizeResult(raw);
      setResult(data);
      if (endpoint === "ask") {
        const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", text: data.answer, claims: data.claims, missing: data.missing_information, sources: data.sources };
        setChatMessages((messages) => [...messages.filter((message) => !message.pending), assistantMessage]);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load project intelligence.";
      setError(message);
      if (endpoint === "ask") {
        setChatMessages((messages) => [...messages.filter((item) => !item.pending), { id: crypto.randomUUID(), role: "assistant", text: message }]);
      }
    } finally {
      setBusy(false);
    }
  }, [projectId, villa, question, horizon]);

  useEffect(() => {
    setResult(null);
    setChatMessages([]);
    setError("");
    if (projectId) void run(surface === "today" ? "attention" : "briefing");
    // The effect intentionally runs when project or surface changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, surface]);

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || busy) return;
    setChatInput("");
    setError("");
    setChatMessages((messages) => [...messages, { id: crypto.randomUUID(), role: "user", text: prompt }, { id: crypto.randomUUID(), role: "assistant", text: "Searching this project’s records…", pending: true }]);
    await run("ask", prompt);
  }

  if (!projectId) return null;
  return <section className="space-y-4" aria-label="Project intelligence">
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent-text">{surface === "today" ? "Attention queue" : "BuildLens intelligence"}</p>
          <h2 className="mt-1 text-xl font-semibold">{surface === "today" ? "What needs attention today" : full ? chatTitle : "Your morning site briefing"}</h2>
          <p className="mt-1 text-sm text-ink-secondary">{full ? "Ask a question and get answers grounded in this project’s records." : "Recorded facts, linked evidence, and actions for your review."}</p>
        </div>
        {!full && <Button size="sm" variant="secondary" loading={busy} onClick={() => void run(surface === "today" ? "attention" : "briefing")}>Refresh</Button>}
      </div>

      {full && <div className="flex flex-wrap gap-2" role="tablist" aria-label="AI features">
        {[["briefing", "Morning briefing"], ["risks", "Risk radar"], ["chat", chatTitle]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={`rounded-control border px-4 py-2 text-sm ${tab === value ? "border-accent-border bg-accent-subtle text-accent-text" : "border-border text-ink-secondary"}`} onClick={() => { setTab(value); setResult(null); setError(""); }}>{label}</button>)}
      </div>}

      {full && tab !== "chat" && <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-secondary">Villa<Select value={villa} onChange={(event) => { setVilla(event.target.value); setResult(null); }}><option value="">All villas</option>{villas.map((item) => <option key={item.id} value={item.id}>Villa {item.villa_number}</option>)}</Select></label>
        {tab === "risks" && <label className="text-xs text-ink-secondary">Forecast horizon<Select value={horizon} onChange={(event) => { setHorizon(Number(event.target.value)); setResult(null); }}><option value={7}>Next 7 days</option><option value={14}>Next 14 days</option></Select></label>}
      </div>}

      {full && tab === "chat" && <div className="space-y-4">
        <div className="max-h-[min(55vh,520px)] min-h-64 space-y-4 overflow-y-auto rounded-card border border-border bg-surface-subtle p-4" aria-live="polite" aria-label={`${chatTitle} conversation`}>
          {!chatMessages.length && <div className="space-y-3 py-8 text-center"><p className="font-medium text-ink">Ask about {projectName || "this project"}</p><p className="mx-auto max-w-lg text-sm text-ink-secondary">Answers use recorded project data and include links to the source records. If the records don’t establish an answer, the assistant will say so.</p><div className="flex flex-wrap justify-center gap-2">{["What needs attention today?", "Why is Villa 102 delayed?", "Which inspections are blocking handover?"].map((sample) => <button key={sample} type="button" className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-accent-text hover:border-accent-border" onClick={() => setChatInput(sample)}>{sample}</button>)}</div></div>}
          {chatMessages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-card px-4 py-3 ${message.role === "user" ? "bg-accent text-white" : "border border-border bg-surface"}`}>
              {message.claims?.length ? message.claims.map((claim, index) => <div key={`${message.id}-${index}`} className="mb-3 last:mb-0"><p className="whitespace-pre-wrap text-sm leading-relaxed">{claim.text}</p><Citations ids={claim.evidence_ids} sources={message.sources || []} /></div>) : <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>}
              {message.missing?.map((item, index) => <p key={index} className="mt-2 text-xs text-ink-muted">{item}</p>)}
              {message.pending && <span className="mt-2 block animate-pulse text-xs text-ink-muted">Looking through project records…</span>}
            </div>
          </div>)}
        </div>
        {error && <ErrorBanner message={error} />}
        <form className="flex items-end gap-3" onSubmit={(event) => void sendChat(event)}>
          <label className="min-w-0 flex-1 text-xs text-ink-secondary">Message {projectName || "project"}<Textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask a question about tasks, quality, materials, approvals…" rows={2} maxLength={2000} /></label>
          <Button type="submit" loading={busy} disabled={!chatInput.trim()}>Send</Button>
        </form>
        <p className="text-xs text-ink-muted">Project records only · cited answers · no automatic changes</p>
      </div>}

      {full && tab !== "chat" && <Button loading={busy} onClick={() => void run(tab)}>{tab === "risks" ? "Review schedule risks" : "Generate briefing"}</Button>}
      {busy && surface !== "ai" && <p role="status" className="animate-pulse text-sm text-ink-secondary">Reviewing project records…</p>}
      {error && surface !== "ai" && <ErrorBanner message={error} />}
      {result && !(full && tab === "chat") && <>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted"><Badge>{result.mode === "gemini" ? "AI summary with sources" : "Recorded facts"}</Badge><span>As of {new Date(result.as_of).toLocaleString()}</span></div>
        {result.fallback_reason && <p className="text-xs text-ink-muted">{result.fallback_reason}</p>}
        {result.missing_information.map((item, index) => <p key={index} className="rounded-control bg-surface-subtle p-3 text-sm text-ink-secondary">{item}</p>)}
        {surface !== "today" && result.claims.map((claim, index) => <div key={index} className="border-l-2 border-accent-border py-1 pl-4"><p className="text-sm leading-relaxed">{claim.text}</p><Citations ids={claim.evidence_ids} sources={result.sources} /></div>)}
      </>}
    </Card>

    {result && (surface === "today" || (full && tab === "briefing")) && <>
      <div className="flex flex-wrap gap-2"><button className="text-xs underline" onClick={() => setCategory("all")}>All attention items ({result.attention_items.length})</button>{Object.entries(result.counts).map(([key, count]) => <button key={key} className="text-xs text-accent-text underline" onClick={() => setCategory(key)}>{key} ({count})</button>)}</div>
      {result.attention_items.filter((item) => category === "all" || item.category === category).map((item) => <Card key={item.id}><div className="flex justify-between gap-2"><h3 className="font-medium">{item.title}</h3><Badge>{item.category}</Badge></div><p className="mt-2 text-sm text-ink-secondary">{item.reason}</p><p className="mt-2 text-xs">Owner: {item.owner?.name || "Not recorded — assign an owner"}</p><Citations ids={item.evidence_ids} sources={result.sources} /></Card>)}
      {!result.attention_items.length && <p className="text-sm text-ink-secondary">No attention items were found in the available records.</p>}
    </>}

    {result && (tab === "risks" || surface === "dashboard") && <div className="grid gap-4 md:grid-cols-2">{result.risks.slice(0, surface === "dashboard" ? 3 : 30).map((risk) => <Card key={risk.id} className="space-y-3"><div className="flex justify-between gap-2"><h3 className="font-medium">{risk.title}</h3><Badge status={risk.risk_level}>{risk.risk_level} · {risk.risk_score}</Badge></div><p className="text-sm text-ink-secondary">{risk.explanation}</p><p className="text-xs">Owner: {risk.owner?.name || "Not recorded"}</p><p className="text-sm">Next: {risk.recommended_next_action}</p><Citations ids={risk.evidence_ids} sources={result.sources} /></Card>)}{full && !result.risks.length && <p className="text-sm text-ink-secondary">No schedule risks were identified among tasks with recorded finish dates. This is not a guarantee of on-time completion.</p>}</div>}

    {!full && <a href="/workspace?section=AI" className="text-sm text-accent-text underline">Open {chatTitle} →</a>}
  </section>;
}

export function SourceViewer() {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const reference = query.get("source");
    const project = query.get("project");
    if (!reference || !project) return;
    const [type, id] = reference.split(":");
    void api<Source>(`/ai/sources/${encodeURIComponent(type)}/${encodeURIComponent(id)}?project_id=${encodeURIComponent(project)}`).then(setSource).catch((cause) => setError(cause.message));
  }, []);
  if (error) return <ErrorBanner message={error} />;
  return source ? <Card><Badge>{source.record_type}</Badge><h2 className="mt-2 text-lg font-semibold">{source.label}</h2><pre className="mt-3 whitespace-pre-wrap text-xs text-ink-secondary">{JSON.stringify(source.data, null, 2)}</pre></Card> : null;
}
