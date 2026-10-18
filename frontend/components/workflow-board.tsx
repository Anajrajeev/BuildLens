"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import {
  activityState,
  latestEvents,
  reference,
  statusLabels,
  WorkEvent,
  WorkStatus,
} from "@/lib/workflow";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  FormField,
  Icon,
  Input,
  MetricCard,
  ProgressBar,
  Select,
  TableSkeleton,
  Textarea,
} from "@/components/ui";

type Project = { id: string; name: string };
type Villa = { id: string; villa_number: string };
type Activity = (typeof reference.activities)[number];

const statusLeftBorder: Record<WorkStatus, string> = {
  NOT_STARTED: "border-l-zinc-300 dark:border-l-zinc-700",
  IN_PROGRESS: "border-l-amber-500",
  BLOCKED: "border-l-rose-500",
  REWORK_REQUIRED: "border-l-rose-600",
  COMPLETED: "border-l-emerald-500",
};

export default function WorkflowBoard({
  projects,
  canEdit,
}: {
  projects: Project[];
  canEdit: boolean;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [villas, setVillas] = useState<Villa[]>([]);
  const [events, setEvents] = useState<WorkEvent[]>([]);
  const [villaId, setVillaId] = useState("");
  const [view, setView] = useState<"timeline" | "phases" | "register">("timeline");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setVillaId("");
    setSelected(null);
    setEvents([]);
    setVillas([]);
    if (!projectId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const villaResponse = await api<{ items: Villa[] }>(
          `/projects/${projectId}/villas`
        );
        let offset: number | null = 0;
        const history: WorkEvent[] = [];
        while (offset !== null) {
          const page: { items: WorkEvent[]; next_offset: number | null } =
            await api(`/workflow/${projectId}?offset=${offset}`);
          history.push(...page.items);
          offset = page.next_offset;
        }
        if (!cancelled) {
          setVillas(villaResponse.items);
          setEvents(history);
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Could not load workflow."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refresh]);

  const ids = villaId ? [villaId] : villas.map((v) => v.id);
  const states = useMemo(
    () =>
      new Map(
        reference.activities.map((a) => [
          a.id,
          activityState(
            events,
            villaId ? [villaId] : villas.map((v) => v.id),
            a.id
          ),
        ])
      ),
    [events, villaId, villas]
  );
  const current = latestEvents(events);
  const active = reference.activities.filter(
    (a) => states.get(a.id)?.status === "IN_PROGRESS"
  );
  const rework = reference.activities.filter(
    (a) => states.get(a.id)?.status === "REWORK_REQUIRED"
  );
  const completed = reference.activities.filter(
    (a) => states.get(a.id)?.status === "COMPLETED"
  ).length;
  const visible = reference.activities.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || states.get(a.id)?.status === filter)
  );
  const outOfOrder = (activity: Activity) =>
    Boolean(
      villaId &&
        events.some(
          (e) =>
            e.villa_id === villaId &&
            e.activity_key === activity.id &&
            e.status !== "NOT_STARTED"
        ) &&
        reference.activities.some(
          (a) =>
            a.order < activity.order &&
            current.get(`${villaId}/${a.id}`)?.status !== "COMPLETED"
        )
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Filter & Scope Toolbar */}
      <div className="rounded-card border border-border bg-surface p-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
          <FormField label="Project" htmlFor="wf-project-select">
            <Select
              id="wf-project-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {!projects.length && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="View progress for" htmlFor="wf-villa-select">
            <Select
              id="wf-villa-select"
              value={villaId}
              disabled={loading || !!error}
              onChange={(e) => {
                setVillaId(e.target.value);
                setSelected(null);
              }}
            >
              <option value="">All villas · project overview</option>
              {villas.map((v) => (
                <option value={v.id} key={v.id}>
                  Villa {v.villa_number}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" dot={false} mono>
            89 activities · 6 phases
          </Badge>
          <Button
            variant="secondary"
            size="md"
            icon="refresh"
            disabled={loading}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Refresh progress
          </Button>
        </div>
      </div>

      {/* KPI Metrics or Loading/Error State */}
      {loading ? (
        <TableSkeleton rows={3} />
      ) : error ? (
        <ErrorBanner
          message={`Live progress unavailable: ${error} Reference plans remain available below.`}
          onRetry={() => setRefresh((n) => n + 1)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Sections complete"
            value={completed}
            subvalue="/ 89"
            hint={villaId ? "Selected villa" : "Across all villas"}
            icon="check-circle"
          />
          <MetricCard
            label="Active sections"
            value={active.length}
            hint={
              villaId
                ? "Sections in progress together"
                : "Active or partial progress"
            }
            icon="clock"
          />
          <MetricCard
            label="Rework required"
            value={rework.length}
            hint="Flagged for remediation"
            badge={
              rework.length > 0 ? (
                <Badge variant="danger">Action needed</Badge>
              ) : (
                <Badge variant="success">Clear</Badge>
              )
            }
          />
          <MetricCard
            label={villaId ? "Villa scope" : "Villas in project"}
            value={ids.length}
            hint={
              villaId
                ? `Inspecting Villa ${
                    villas.find((v) => v.id === villaId)?.villa_number ?? ""
                  }`
                : "Equal weight in project roll-up"
            }
            icon="villas"
          />
        </div>
      )}

      {/* View Tabs & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border">
          <div
            className="flex items-center gap-1 -mb-px overflow-x-auto"
            role="tablist"
            aria-label="Workflow view"
          >
            {(
              [
                ["timeline", "150-day reference"],
                ["phases", "Phase board"],
                ["register", "Activity register"],
              ] as const
            ).map(([id, label]) => {
              const selectedTab = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab}
                  onClick={() => setView(id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-fast whitespace-nowrap focus-ring ${
                    selectedTab
                      ? "border-accent text-accent-text"
                      : "border-transparent text-ink-secondary hover:text-ink hover:border-border-strong"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted pb-2 sm:pb-0">
            {view === "timeline"
              ? "Sheet2 · Five relative 30-day months. Coloured bands show planned windows."
              : "Sheet1 · 89 activities grouped into six finishing phases. Click any activity to inspect or update."}
          </p>
        </div>

        {/* Search & Filter Toolbar for Phase Board and Register */}
        {view !== "timeline" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="h-4 w-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <Input
                  aria-label="Search activities"
                  placeholder="Find an activity, floor, or trade…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                aria-label="Filter by status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="sm:w-44"
              >
                <option value="all">Every status</option>
                {Object.entries(statusLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
                Not started
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                In progress
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Blocked / Rework
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Complete
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main View Content */}
      {view === "timeline" ? (
        <div
          className="rounded-card border border-border bg-surface card-surface overflow-hidden"
          tabIndex={0}
          aria-label="Reference schedule, scroll horizontally"
        >
          <div className="overflow-x-auto max-h-[680px]">
            <div className="min-w-[960px]">
              {/* Sticky Gantt Header */}
              <div className="sticky top-0 z-10 grid grid-cols-[280px_1fr] border-b border-border bg-surface-subtle text-xs font-medium text-ink-muted">
                <div className="px-4 py-3 border-r border-border flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wider text-accent-text">
                    Work package
                  </span>
                  <span className="rounded bg-accent-subtle border border-accent-border px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-text">
                    45 rows
                  </span>
                </div>
                <div className="grid grid-cols-5 divide-x divide-border">
                  {[1, 2, 3, 4, 5].map((m) => (
                    <div
                      key={m}
                      className="px-3 py-2.5 flex items-center justify-between"
                    >
                      <span className="text-ink font-semibold">Month {m}</span>
                      <span className="rounded bg-surface border border-border px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary tabular-nums">
                        Days {(m - 1) * 30 + 1}–{m * 30}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gantt Rows */}
              <div className="divide-y divide-border-subtle">
                {reference.schedule.map((row) => {
                  const isHeading = row.bands.length === 0;
                  return (
                    <div
                      key={row.row}
                      className={`grid grid-cols-[280px_1fr] min-h-[44px] transition-colors duration-fast ${
                        isHeading
                          ? "bg-surface-subtle"
                          : "bg-surface hover:bg-surface-subtle/60"
                      }`}
                    >
                      <div className="px-4 py-2.5 border-r border-border flex flex-col justify-center">
                        <span
                          className={`text-xs ${
                            isHeading
                              ? "font-semibold text-accent-text uppercase tracking-wider"
                              : "font-medium text-ink"
                          }`}
                        >
                          {row.name}
                        </span>
                        <span className="font-mono text-[11px] text-ink-muted mt-0.5">
                          Sheet2 · row {row.row}
                          {row.row >= 13 && row.row <= 16
                            ? " · repeated label"
                            : ""}
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        {/* 5-month column grid lines */}
                        <div
                          className="absolute inset-0 grid grid-cols-5 divide-x divide-border-subtle pointer-events-none"
                          aria-hidden="true"
                        >
                          <div />
                          <div />
                          <div />
                          <div />
                          <div />
                        </div>

                        {row.bands.map((band, i) => {
                          const span = band.end - band.start + 1;
                          return (
                            <span
                              key={i}
                              title={`${row.name}: day ${band.start}–${band.end}`}
                              style={{
                                left: `${((band.start - 1) / 150) * 100}%`,
                                width: `${(span / 150) * 100}%`,
                              }}
                              className="absolute top-1/2 -translate-y-1/2 h-5 rounded-[4px] bg-accent text-white font-mono text-[10px] font-medium flex items-center justify-center overflow-hidden px-1 shadow-sm"
                            >
                              {span >= 6 ? `${band.start}–${band.end}` : ""}
                            </span>
                          );
                        })}

                        {isHeading && (
                          <span className="relative z-[1] px-3 font-mono text-[11px] text-ink-muted">
                            Section heading · milestone group
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={
            view === "phases"
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start"
              : "flex flex-col gap-6"
          }
        >
          {reference.phases.map((phase, index) => {
            const activities = visible.filter((a) => a.phase === index);
            if (!activities.length) return null;
            const totalInPhase = reference.activities.filter(
              (a) => a.phase === index
            ).length;
            const completedInPhase = reference.activities.filter(
              (a) =>
                a.phase === index &&
                states.get(a.id)?.status === "COMPLETED"
            ).length;

            return (
              <section
                key={phase}
                className="rounded-card border border-border border-t-[3px] border-t-accent bg-surface-subtle card-surface overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-accent-border bg-accent-subtle font-mono text-xs font-semibold text-accent-text">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-sm font-semibold text-ink truncate">
                      {phase}
                    </h3>
                  </div>
                  <span className="rounded-[5px] border border-border bg-surface-subtle px-2 py-0.5 font-mono text-xs font-medium text-ink-secondary tabular-nums shrink-0">
                    {completedInPhase}/{totalInPhase} done
                  </span>
                </div>

                <div
                  className={
                    view === "phases"
                      ? "p-3 flex flex-col gap-2.5 max-h-[540px] overflow-y-auto"
                      : "p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                  }
                >
                  {activities.map((a) => {
                    const state = states.get(a.id)!;
                    const unavailable = loading || !!error;
                    const leftBorder = unavailable
                      ? "border-l-zinc-300"
                      : statusLeftBorder[state.status];

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelected(a)}
                        className={`group text-left rounded-control border border-border border-l-[3px] ${leftBorder} bg-surface p-3.5 transition-colors duration-fast hover:border-border-strong hover:bg-surface-subtle/40 focus-ring flex flex-col justify-between gap-3`}
                      >
                        <div className="w-full">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs font-medium text-ink-muted">
                              #{String(a.order).padStart(2, "0")}
                            </span>
                            <Badge
                              variant={
                                unavailable
                                  ? "neutral"
                                  : !state.recorded
                                  ? "neutral"
                                  : undefined
                              }
                              status={
                                unavailable || !state.recorded
                                  ? undefined
                                  : state.status
                              }
                            >
                              {unavailable
                                ? "Unavailable"
                                : !state.recorded
                                ? "No update yet"
                                : statusLabels[state.status]}
                            </Badge>
                          </div>

                          <h4 className="text-sm font-medium text-ink leading-snug group-hover:text-accent-text transition-colors">
                            {a.name}
                          </h4>
                        </div>

                        <div className="w-full flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs text-ink-muted">
                            <span className="font-mono">
                              {a.duration === null
                                ? "Duration unscheduled"
                                : `${a.duration}d planned`}
                            </span>
                            <span className="font-mono font-semibold text-ink tabular-nums">
                              {unavailable ? "—" : `${state.progress}%`}
                            </span>
                          </div>

                          <ProgressBar
                            value={unavailable ? 0 : state.progress}
                            showLabel={false}
                            variant={
                              state.status === "COMPLETED"
                                ? "success"
                                : state.status === "REWORK_REQUIRED" ||
                                  state.status === "BLOCKED"
                                ? "danger"
                                : "accent"
                            }
                          />

                          {!unavailable &&
                            (state.reworks > 0 ||
                              outOfOrder(a) ||
                              (!villaId && state.recorded > 0)) && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {state.reworks > 0 && (
                                  <span className="font-mono text-[11px] text-danger-text bg-danger-bg px-1.5 py-0.5 rounded">
                                    {state.reworks} rework{" "}
                                    {state.reworks === 1 ? "cycle" : "cycles"}
                                  </span>
                                )}
                                {outOfOrder(a) && (
                                  <span className="font-mono text-[11px] text-warning-text bg-warning-bg px-1.5 py-0.5 rounded">
                                    Earlier work open
                                  </span>
                                )}
                                {!villaId && state.recorded > 0 && (
                                  <span className="font-mono text-[11px] text-ink-muted">
                                    {state.complete}/{ids.length} villas complete ·{" "}
                                    {state.recorded} reported
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {visible.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon="search"
                title="No matching activities"
                description="No workflow activities match your current search query or status filter."
                actionLabel="Reset filters"
                onAction={() => {
                  setQuery("");
                  setFilter("all");
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Workbook Notes & Planning Assumptions */}
      <details className="group rounded-card border border-border bg-surface overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle select-none list-none">
          <span className="flex items-center gap-2">
            <Icon name="documents" className="h-4 w-4 text-ink-muted" />
            <span>Workbook notes & planning assumptions ({reference.source})</span>
          </span>
          <Icon
            name="chevron-down"
            className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border px-5 py-4 text-xs text-ink-secondary space-y-2.5 leading-relaxed">
          <p>
            Source: <span className="font-mono text-ink">{reference.source}</span>.
            All 89 Sheet1 activities and all 45 Sheet2 rows are retained. Phase
            names are suggested groupings, not named phases in the workbook.
            Sheet1 durations are individual activity estimates; their 526-day
            sum is not the project duration.
          </p>
          <p>
            Sheet2 has overlapping bands, four rows labelled “GF Screed for
            tiles”, and duration labels that sometimes differ from painted
            spans. Painted cells define the displayed windows; duration
            annotation cells are excluded.
          </p>
          <p>
            Project percentages give each villa equal weight and count
            unreported activities as 0%. Villa updates here are section-level
            records, separate from task progress in Today.
          </p>
          <details className="pt-2">
            <summary className="cursor-pointer font-medium text-ink hover:text-accent-text">
              View original schedule annotations
            </summary>
            <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-border font-mono text-[11px]">
              {reference.schedule
                .filter((r) => r.annotations.length)
                .map((r) => (
                  <p key={r.row}>
                    <strong className="text-ink">{r.name}</strong> —{" "}
                    {r.annotations.join("; ")}
                  </p>
                ))}
            </div>
          </details>
        </div>
      </details>

      {/* Activity Inspection Slide-Over Drawer */}
      {selected && (
        <ActivityPanel
          key={`${villaId}/${selected.id}`}
          activity={selected}
          projectId={projectId}
          villaId={villaId}
          villaName={villas.find((v) => v.id === villaId)?.villa_number}
          events={events}
          enabled={canEdit && !loading && !error}
          close={() => setSelected(null)}
          saved={(event) => setEvents((previous) => [...previous, event])}
        />
      )}
    </div>
  );
}

function ActivityPanel({
  activity,
  projectId,
  villaId,
  villaName,
  events,
  enabled,
  close,
  saved,
}: {
  activity: Activity;
  projectId: string;
  villaId: string;
  villaName?: string;
  events: WorkEvent[];
  enabled: boolean;
  close: () => void;
  saved: (event: WorkEvent) => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const history = events
    .filter((e) => e.villa_id === villaId && e.activity_key === activity.id)
    .sort((a, b) => b.revision - a.revision);
  const current = history[0];
  const [status, setStatus] = useState<WorkStatus>(
    current?.status || "NOT_STARTED"
  );
  const [progress, setProgress] = useState(current?.progress || 0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMounted(true);
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) close();
      if (e.key === "Tab") {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary"
          ) || []
        ).filter((el) => !el.closest("fieldset:disabled"));
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [close, saving]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const event = await api<WorkEvent & { queued?: boolean }>(
        `/workflow/${projectId}`,
        {
          method: "POST",
          body: JSON.stringify({
            villa_id: villaId,
            activity_key: activity.id,
            revision: (current?.revision || 0) + 1,
            status,
            progress,
            note,
          }),
        }
      );
      if (event.queued)
        setMessage(
          "Queued offline. Progress will appear after synchronization and refresh."
        );
      else {
        saved(event);
        setNote("");
        setMessage("Progress saved.");
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const drawerContent = (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) close();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-detail-title"
        className="relative flex h-dvh w-full max-w-[480px] flex-col border-l border-border bg-surface shadow-float overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-medium text-accent-text">
                {villaId ? `Villa ${villaName}` : "Activity reference"} · #
                {String(activity.order).padStart(2, "0")}
              </span>
              <span className="font-mono text-xs text-ink-muted">
                ({activity.source})
              </span>
            </div>
            <h2
              id="wf-detail-title"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              {activity.name}
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">
              {reference.phases[activity.phase]} ·{" "}
              {activity.duration === null
                ? "Duration not specified"
                : `${activity.duration} planned days`}
            </p>
          </div>
          <button
            autoFocus
            type="button"
            disabled={saving}
            onClick={close}
            aria-label="Close activity"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink focus-ring"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activity.remarks && (
            <div className="rounded-control border border-border bg-surface-subtle p-3.5 text-xs">
              <strong className="block font-medium text-ink mb-1">
                Site clearance & work notes
              </strong>
              <p className="text-ink-secondary leading-relaxed">
                {activity.remarks}
              </p>
            </div>
          )}

          {!villaId ? (
            <div className="rounded-control border border-dashed border-border bg-surface-subtle/60 p-4 text-xs text-ink-secondary">
              Select a specific villa in the toolbar above to record progress and
              inspect its activity history.
            </div>
          ) : (
            <>
              <form onSubmit={save} className="space-y-4">
                <fieldset
                  disabled={!enabled || saving}
                  className="space-y-4 border-0 p-0 m-0"
                >
                  <legend className="text-sm font-semibold text-ink mb-2">
                    Update this villa
                  </legend>

                  <FormField label="Status" htmlFor="wf-status-select">
                    <Select
                      id="wf-status-select"
                      value={status}
                      onChange={(e) => {
                        const value = e.target.value as WorkStatus;
                        setStatus(value);
                        setProgress(
                          value === "COMPLETED"
                            ? 100
                            : value === "NOT_STARTED" ||
                              value === "REWORK_REQUIRED"
                            ? 0
                            : Math.min(progress, 99)
                        );
                      }}
                    >
                      {Object.entries(statusLabels).map(([id, label]) => (
                        <option value={id} key={id}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField
                    label="Current completion (%)"
                    htmlFor="wf-progress-input"
                    helperText={
                      status === "REWORK_REQUIRED"
                        ? "Previous completion stays in history. Set the progress of the current rework cycle."
                        : "Enter a percentage between 0 and 100."
                    }
                  >
                    <Input
                      id="wf-progress-input"
                      type="number"
                      min="0"
                      max={status === "COMPLETED" ? 100 : 99}
                      required
                      value={progress}
                      disabled={
                        status === "COMPLETED" || status === "NOT_STARTED"
                      }
                      onChange={(e) => setProgress(Number(e.target.value))}
                      className="font-mono tabular-nums"
                    />
                  </FormField>

                  <FormField
                    label={
                      status === "REWORK_REQUIRED"
                        ? "Rework reason"
                        : "Site note"
                    }
                    htmlFor="wf-note-textarea"
                    required={status === "REWORK_REQUIRED"}
                  >
                    <Textarea
                      id="wf-note-textarea"
                      maxLength={2000}
                      required={status === "REWORK_REQUIRED"}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add inspection findings, trade handover notes, or constraints…"
                    />
                  </FormField>

                  <div className="pt-1 flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={close}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" loading={saving}>
                      {saving ? "Saving…" : "Save villa progress"}
                    </Button>
                  </div>
                </fieldset>
              </form>

              {!enabled && (
                <p className="text-xs text-ink-muted">
                  Live access and work editing permission are required to save.
                </p>
              )}

              {message && (
                <div
                  role="status"
                  className="rounded-control border border-accent-border bg-accent-subtle px-3.5 py-2.5 text-xs font-medium text-accent-text"
                >
                  {message}
                </div>
              )}

              <div className="border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-ink mb-3">
                  Activity history
                </h3>
                {!history.length ? (
                  <p className="text-xs text-ink-muted">
                    No updates recorded for this villa.
                  </p>
                ) : (
                  <ol className="relative border-l border-border ml-2 space-y-4 pl-4">
                    {history.map((event) => (
                      <li key={event.id} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
                        <div className="flex items-center justify-between gap-2">
                          <Badge status={event.status}>
                            {statusLabels[event.status]} · {event.progress}%
                          </Badge>
                          <time className="font-mono text-[11px] text-ink-muted">
                            {new Date(event.created_at).toLocaleString()}
                          </time>
                        </div>
                        {event.note && (
                          <p className="mt-1.5 text-ink-secondary leading-relaxed">
                            {event.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
