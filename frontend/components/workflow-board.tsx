"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  api,
  CustomWorkflowActivity,
  VillaPhaseConfig,
  WorkflowScheduleConfig,
} from "@/lib/api";
import {
  ActivityScheduleOverride,
  activityState,
  computeConflictFreeSchedule,
  DEFAULT_PHASE_WINDOWS,
  latestEvents,
  reference,
  ScheduledActivityMeta,
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
type Villa = {
  id: string;
  villa_number: string;
  phases?: VillaPhaseConfig[];
};
type Activity = {
  id: string;
  order: number;
  name: string;
  duration: number | null;
  phase: number;
  remarks: string | null;
  source: string;
};

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
  canApproveRework = false,
  initialVillaId = "",
  initialPhaseFilter = null,
}: {
  projects: Project[];
  canEdit: boolean;
  canApproveRework?: boolean;
  initialVillaId?: string;
  initialPhaseFilter?: number | null;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [villas, setVillas] = useState<Villa[]>([]);
  const [events, setEvents] = useState<WorkEvent[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<WorkflowScheduleConfig>({
    customPhases: [],
    customActivities: [],
    activityOverrides: {},
  });
  const [villaId, setVillaId] = useState(initialVillaId);
  const [phaseFilter, setPhaseFilter] = useState<string>(
    initialPhaseFilter !== null && initialPhaseFilter !== undefined
      ? String(initialPhaseFilter)
      : "all"
  );
  const [view, setView] = useState<"phases" | "timeline" | "register">("phases");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (initialVillaId) {
      setVillaId(initialVillaId);
    }
  }, [initialVillaId]);

  useEffect(() => {
    if (initialPhaseFilter !== null && initialPhaseFilter !== undefined) {
      setPhaseFilter(String(initialPhaseFilter));
      setView("phases");
    }
  }, [initialPhaseFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSelected(null);
    if (!projectId) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [villaResponse, cfgResponse] = await Promise.all([
          api<{ items: Villa[] }>(`/projects/${projectId}/villas`),
          api<WorkflowScheduleConfig>("/workflow/schedule-config"),
        ]);
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
          if (cfgResponse) {
            setScheduleConfig(cfgResponse);
          }
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

  const selectedVillaObj = useMemo(
    () => villas.find((v) => v.id === villaId),
    [villas, villaId]
  );

  const allPhases = useMemo(() => {
    const base = [...reference.phases];
    for (const cp of scheduleConfig.customPhases || []) {
      if (!base.some((p) => p.toLowerCase() === cp.toLowerCase())) {
        base.push(cp);
      }
    }
    if (selectedVillaObj?.phases) {
      for (const vp of selectedVillaObj.phases) {
        if (!base.some((p) => p.toLowerCase() === vp.name.toLowerCase())) {
          base.push(vp.name);
        }
      }
    }
    return base;
  }, [scheduleConfig.customPhases, selectedVillaObj]);

  const allActivities: Activity[] = useMemo(() => {
    const custom: Activity[] = (scheduleConfig.customActivities || []).map(
      (ca: CustomWorkflowActivity) => ({
        id: ca.id,
        order: ca.order,
        name: ca.name,
        duration: ca.duration,
        phase: ca.phase,
        remarks: ca.remarks,
        source: ca.source,
      })
    );
    return [...reference.activities, ...custom];
  }, [scheduleConfig.customActivities]);

  const scheduleMap = useMemo(
    () =>
      computeConflictFreeSchedule(
        allActivities,
        scheduleConfig.activityOverrides || {}
      ),
    [allActivities, scheduleConfig.activityOverrides]
  );

  const parallelCount = useMemo(
    () =>
      Array.from(scheduleMap.values()).filter(
        (m) => m.allowParallel && m.parallelWithIds.length > 0
      ).length,
    [scheduleMap]
  );

  const conflictCount = useMemo(
    () => Array.from(scheduleMap.values()).filter((m) => m.hasConflict).length,
    [scheduleMap]
  );

  const ids = villaId ? [villaId] : villas.map((v) => v.id);
  const states = useMemo(
    () =>
      new Map(
        allActivities.map((a) => [
          a.id,
          activityState(
            events,
            villaId ? [villaId] : villas.map((v) => v.id),
            a.id
          ),
        ])
      ),
    [allActivities, events, villaId, villas]
  );
  const current = latestEvents(events);
  const active = allActivities.filter(
    (a) => states.get(a.id)?.status === "IN_PROGRESS"
  );
  const rework = allActivities.filter(
    (a) => states.get(a.id)?.status === "REWORK_REQUIRED"
  );
  const completed = allActivities.filter(
    (a) => states.get(a.id)?.status === "COMPLETED"
  ).length;

  const allowedVillaPhaseIndices = useMemo(() => {
    if (!selectedVillaObj?.phases || selectedVillaObj.phases.length === 0) {
      return null;
    }
    return new Set(
      selectedVillaObj.phases.map((p) => {
        const idx = allPhases.findIndex(
          (name) => name.toLowerCase() === p.name.toLowerCase()
        );
        return idx >= 0 ? idx : p.phaseIndex;
      })
    );
  }, [selectedVillaObj, allPhases]);

  const visible = allActivities.filter((a) => {
    if (allowedVillaPhaseIndices && !allowedVillaPhaseIndices.has(a.phase)) {
      return false;
    }
    if (phaseFilter !== "all" && String(a.phase) !== phaseFilter) {
      return false;
    }
    return (
      a.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || states.get(a.id)?.status === filter)
    );
  });

  const outOfOrder = (activity: Activity) => {
    if (!villaId) return false;
    const meta = scheduleMap.get(activity.id);
    if (!meta || meta.allowParallel || !meta.prerequisiteId) return false;
    const hasStarted = events.some(
      (e) =>
        e.villa_id === villaId &&
        e.activity_key === activity.id &&
        e.status !== "NOT_STARTED"
    );
    if (!hasStarted) return false;
    const prereqStatus = current.get(
      `${villaId}/${meta.prerequisiteId}`
    )?.status;
    return prereqStatus !== "COMPLETED";
  };

  const reconciledSchedule = useMemo(() => {
    let screedZoneCounter = 0;
    return reference.schedule.map((row) => {
      const isScreed = row.name.toLowerCase() === "gf screed for tiles";
      if (isScreed) screedZoneCounter += 1;
      const displayName = isScreed
        ? `${row.name} · Zone ${String.fromCharCode(64 + screedZoneCounter)}`
        : row.name;

      const totalBandDays = row.bands.reduce(
        (sum, b) => sum + (b.end - b.start + 1),
        0
      );
      const overlapsWithOtherRow = reference.schedule.some(
        (other) =>
          other.row !== row.row &&
          other.bands.some((ob) =>
            row.bands.some((rb) => rb.start <= ob.end && rb.end >= ob.start)
          )
      );

      return {
        ...row,
        displayName,
        totalBandDays,
        overlapsWithOtherRow,
      };
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Filter & Scope Toolbar */}
      <div className="rounded-card border border-border bg-surface p-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 max-w-3xl">
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

          <FormField
            label="Linked Villa Phase"
            htmlFor="wf-phase-filter-select"
          >
            <Select
              id="wf-phase-filter-select"
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
            >
              <option value="all">
                All phases ({allPhases.length})
              </option>
              {allPhases.map((phaseName, idx) => (
                <option key={phaseName} value={String(idx)}>
                  {String(idx + 1).padStart(2, "0")} · {phaseName}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" dot>
            {conflictCount === 0
              ? "0 duration conflicts"
              : `${conflictCount} conflicts`}
          </Badge>
          <Badge variant="accent" dot={false} mono>
            {parallelCount} parallel works
          </Badge>
          <Badge variant="neutral" dot={false} mono>
            {allActivities.length} activities · {allPhases.length} phases
          </Badge>
          <Button
            variant="secondary"
            size="md"
            icon="refresh"
            disabled={loading}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Conflict-Free Schedule & Parallel Execution Banner */}
      <div className="rounded-card border border-accent-border bg-accent-subtle/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent text-white">
            <Icon name="sliders" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink">
              Conflict-Free Schedule & Parallel Execution Active
            </p>
            <p className="text-xs text-ink-secondary">
              Every work item’s planned day count matches its scheduled{" "}
              <span className="font-mono">Start–End</span> window (0 conflicts).
              Independent floor and facade tracks (<span className="font-mono">GF</span>,{" "}
              <span className="font-mono">FF</span>, <span className="font-mono">SF</span>,{" "}
              <span className="font-mono">External</span>) overlap in parallel
              within the 150-day master window, while sequential dependencies
              auto-shift to prevent overlap conflicts.
            </p>
          </div>
        </div>
        {selectedVillaObj && (
          <Badge variant="accent" mono>
            Linked to Villa {selectedVillaObj.villa_number} (
            {selectedVillaObj.phases?.length || allPhases.length} phases)
          </Badge>
        )}
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
            subvalue={`/ ${allActivities.length}`}
            hint={villaId ? "Selected villa" : "Across all villas"}
            icon="check-circle"
          />
          <MetricCard
            label="Active parallel streams"
            value={active.length}
            subvalue={`${parallelCount} overlap-enabled`}
            hint="Concurrent works without day conflicts"
            icon="clock"
          />
          <MetricCard
            label="Rework required"
            value={rework.length}
            hint={
              canApproveRework
                ? "Click any rework item below to approve"
                : "Flagged for Manager rework approval"
            }
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
                ? `Inspecting Villa ${selectedVillaObj?.villa_number ?? ""}`
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
                ["phases", "Phase board (Linked to Villas)"],
                ["timeline", "150-day parallel schedule"],
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
              ? "150-day master schedule · Parallel tracks overlap cleanly; every band span matches its exact day duration."
              : "Click any work activity to update villa state, approve rework, or configure duration & parallel execution."}
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
              <div className="sticky top-0 z-10 grid grid-cols-[310px_1fr] border-b border-border bg-surface-subtle text-xs font-medium text-ink-muted">
                <div className="px-4 py-3 border-r border-border flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wider text-accent-text">
                    Work package & duration
                  </span>
                  <span className="rounded bg-accent-subtle border border-accent-border px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-text">
                    0 conflicts
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
                {reconciledSchedule.map((row) => {
                  const isHeading = row.bands.length === 0;
                  return (
                    <div
                      key={row.row}
                      className={`grid grid-cols-[310px_1fr] min-h-[46px] transition-colors duration-fast ${
                        isHeading
                          ? "bg-surface-subtle"
                          : "bg-surface hover:bg-surface-subtle/60"
                      }`}
                    >
                      <div className="px-4 py-2.5 border-r border-border flex flex-col justify-center">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs truncate ${
                              isHeading
                                ? "font-semibold text-accent-text uppercase tracking-wider"
                                : "font-medium text-ink"
                            }`}
                          >
                            {row.displayName}
                          </span>
                          {!isHeading && (
                            <span className="shrink-0 font-mono text-[11px] font-semibold text-accent-text bg-accent-subtle border border-accent-border px-1.5 py-0.5 rounded">
                              {row.totalBandDays}d
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-ink-muted">
                            Row {row.row}
                          </span>
                          {!isHeading && (
                            <span className="font-mono text-[10px] text-ink-secondary">
                              ·{" "}
                              {row.overlapsWithOtherRow
                                ? "Parallel overlap enabled"
                                : "Sequential window"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative flex items-center">
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
                              title={`${row.displayName}: Day ${band.start}–${band.end} (${span} days)`}
                              style={{
                                left: `${((band.start - 1) / 150) * 100}%`,
                                width: `${(span / 150) * 100}%`,
                              }}
                              className="absolute top-1/2 -translate-y-1/2 h-5 rounded-[4px] bg-accent text-white font-mono text-[10px] font-medium flex items-center justify-center overflow-hidden px-1 shadow-sm"
                            >
                              {span >= 5
                                ? `D${band.start}–${band.end} (${span}d)`
                                : `${span}d`}
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
          {allPhases.map((phase, index) => {
            const activities = visible.filter((a) => a.phase === index);
            if (!activities.length) return null;
            const totalInPhase = allActivities.filter(
              (a) => a.phase === index
            ).length;
            const completedInPhase = allActivities.filter(
              (a) =>
                a.phase === index &&
                states.get(a.id)?.status === "COMPLETED"
            ).length;

            const villaPhase = selectedVillaObj?.phases?.find(
              (p) =>
                p.phaseIndex === index ||
                p.name.toLowerCase() === phase.toLowerCase()
            );
            const defaultPhaseWindow = DEFAULT_PHASE_WINDOWS[index];
            const phaseStartDay =
              villaPhase?.startDay ?? defaultPhaseWindow?.startDay ?? 1;
            const phaseEndDay =
              villaPhase?.endDay ?? defaultPhaseWindow?.endDay ?? 30;
            const phaseDays =
              villaPhase?.plannedDays ??
              defaultPhaseWindow?.plannedDays ??
              phaseEndDay - phaseStartDay + 1;
            const isParallelPhase =
              villaPhase?.allowParallel ??
              defaultPhaseWindow?.allowParallel ??
              true;

            return (
              <section
                key={phase}
                className="rounded-card border border-border border-t-[3px] border-t-accent bg-surface-subtle card-surface overflow-hidden flex flex-col"
              >
                <div className="border-b border-border bg-surface px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
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
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-ink-muted">
                    <span>
                      Window: Day {phaseStartDay}–{phaseEndDay} ({phaseDays}d)
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        isParallelPhase
                          ? "bg-accent-subtle text-accent-text"
                          : "bg-surface-subtle text-ink-secondary border border-border"
                      }`}
                    >
                      {isParallelPhase ? "Parallel phase" : "Sequential phase"}
                    </span>
                  </div>
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
                    const sched = scheduleMap.get(a.id);
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
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-medium text-ink-muted">
                                #{String(a.order).padStart(2, "0")}
                              </span>
                              {sched && (
                                <span
                                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                    sched.allowParallel
                                      ? "bg-accent-subtle text-accent-text"
                                      : "bg-surface-subtle text-ink-muted border border-border"
                                  }`}
                                >
                                  {sched.allowParallel
                                    ? `Parallel (${sched.parallelWithIds.length})`
                                    : "Sequential"}
                                </span>
                              )}
                            </div>
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
                              {sched
                                ? `${sched.duration}d · Days ${sched.startDay}–${sched.endDay}`
                                : a.duration === null
                                ? "2d planned"
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
                                    Sequential prerequisite open
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
                description="No workflow activities match your current phase, search query, or status filter."
                actionLabel="Reset filters"
                onAction={() => {
                  setQuery("");
                  setFilter("all");
                  setPhaseFilter("all");
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Activity Inspection Slide-Over Drawer */}
      {selected && (
        <ActivityPanel
          key={`${villaId}/${selected.id}`}
          activity={selected}
          phaseName={allPhases[selected.phase] || "Custom Phase"}
          scheduleMeta={scheduleMap.get(selected.id)}
          projectId={projectId}
          villaId={villaId}
          villas={villas}
          villaName={villas.find((v) => v.id === villaId)?.villa_number}
          events={events}
          enabled={canEdit && !loading && !error}
          canApproveRework={canApproveRework && !loading && !error}
          onSelectVilla={(id) => setVillaId(id)}
          onScheduleSaved={(activityId, override) => {
            setScheduleConfig((prev) => ({
              ...prev,
              activityOverrides: {
                ...prev.activityOverrides,
                [activityId]: override,
              },
            }));
          }}
          close={() => setSelected(null)}
          saved={(event) => setEvents((previous) => [...previous, event])}
        />
      )}
    </div>
  );
}

function ActivityPanel({
  activity,
  phaseName,
  scheduleMeta,
  projectId,
  villaId,
  villas,
  villaName,
  events,
  enabled,
  canApproveRework,
  onSelectVilla,
  onScheduleSaved,
  close,
  saved,
}: {
  activity: Activity;
  phaseName: string;
  scheduleMeta?: ScheduledActivityMeta;
  projectId: string;
  villaId: string;
  villas: Villa[];
  villaName?: string;
  events: WorkEvent[];
  enabled: boolean;
  canApproveRework: boolean;
  onSelectVilla: (id: string) => void;
  onScheduleSaved: (
    activityId: string,
    override: ActivityScheduleOverride
  ) => void;
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

  const [plannedDays, setPlannedDays] = useState<number>(
    scheduleMeta?.duration ?? (activity.duration || 2)
  );
  const [startDay, setStartDay] = useState<number>(
    scheduleMeta?.startDay ?? 1
  );
  const [allowParallel, setAllowParallel] = useState<boolean>(
    scheduleMeta?.allowParallel ?? true
  );
  const [scheduleSaving, setScheduleSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) close();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [close, saving]);

  async function saveScheduleOverride(e: FormEvent) {
    e.preventDefault();
    setScheduleSaving(true);
    setMessage("");
    try {
      const cleanDuration = Math.max(1, Math.min(90, Number(plannedDays) || 1));
      const cleanStart = Math.max(
        1,
        Math.min(150 - cleanDuration + 1, Number(startDay) || 1)
      );
      const override: ActivityScheduleOverride = {
        duration: cleanDuration,
        startDay: cleanStart,
        allowParallel,
      };
      await api("/workflow/schedule-config", {
        method: "POST",
        body: JSON.stringify({
          activityId: activity.id,
          override,
        }),
      });
      onScheduleSaved(activity.id, override);
      setMessage(
        `Schedule updated: ${cleanDuration} days (Days ${cleanStart}–${
          cleanStart + cleanDuration - 1
        }, ${
          allowParallel ? "Parallel overlap enabled" : "Sequential mode"
        }) with 0 duration conflicts.`
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Could not update schedule."
      );
    } finally {
      setScheduleSaving(false);
    }
  }

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

  async function approveActivityRework() {
    if (!villaId) return;
    setSaving(true);
    setMessage("");
    try {
      const approvalNote =
        note.trim() ||
        "Rework inspected and approved by Manager/Director. Quality hold cleared.";
      const event = await api<WorkEvent>(`/workflow/${projectId}`, {
        method: "POST",
        body: JSON.stringify({
          villa_id: villaId,
          activity_key: activity.id,
          revision: (current?.revision || 0) + 1,
          status: "IN_PROGRESS",
          progress: Math.max(current?.progress || 50, 65),
          note: `REWORK APPROVED: ${approvalNote}`,
        }),
      });
      saved(event);
      setStatus("IN_PROGRESS");
      setProgress(event.progress);
      setNote("");
      setMessage("Rework approved and activity cleared for continuation.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Could not approve rework."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const computedEndDay =
    Math.max(1, Math.min(150 - plannedDays + 1, startDay)) + plannedDays - 1;

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
        className="relative flex h-dvh w-full max-w-[500px] flex-col border-l border-border bg-surface shadow-float overflow-hidden"
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
              {phaseName} ·{" "}
              {scheduleMeta
                ? `${scheduleMeta.duration} planned days (Days ${scheduleMeta.startDay}–${scheduleMeta.endDay})`
                : `${activity.duration || 2} planned days`}
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
          {/* Duration & Parallel Execution Configuration Card */}
          <div className="rounded-control border border-border bg-surface-subtle p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-text">
                Duration & Parallel Schedule (0 Conflicts)
              </span>
              <Badge variant="success" dot={false}>
                {plannedDays}d = Day {startDay}–{computedEndDay}
              </Badge>
            </div>

            {scheduleMeta && scheduleMeta.parallelWithNames.length > 0 && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                <strong className="text-ink">
                  Overlaps in parallel with ({scheduleMeta.parallelWithIds.length}):
                </strong>{" "}
                {scheduleMeta.parallelWithNames.join(", ")}
                {scheduleMeta.parallelWithIds.length >
                scheduleMeta.parallelWithNames.length
                  ? ` +${
                      scheduleMeta.parallelWithIds.length -
                      scheduleMeta.parallelWithNames.length
                    } more`
                  : ""}
              </p>
            )}

            <form onSubmit={saveScheduleOverride} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Duration (Days)" htmlFor="wf-sched-days">
                  <Input
                    id="wf-sched-days"
                    type="number"
                    min={1}
                    max={90}
                    value={plannedDays}
                    onChange={(e) =>
                      setPlannedDays(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="font-mono"
                  />
                </FormField>
                <FormField label="Start Day (1–150)" htmlFor="wf-sched-start">
                  <Input
                    id="wf-sched-start"
                    type="number"
                    min={1}
                    max={150}
                    value={startDay}
                    onChange={(e) =>
                      setStartDay(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="font-mono"
                  />
                </FormField>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowParallel}
                  onChange={(e) => setAllowParallel(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <span>
                  Allow parallel overlap with concurrent works (uncheck for strict
                  sequential dependency)
                </span>
              </label>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  loading={scheduleSaving}
                >
                  Update work duration & parallelism
                </Button>
              </div>
            </form>
          </div>

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
            <div className="rounded-control border border-dashed border-border bg-surface-subtle/60 p-4 space-y-3">
              <p className="text-xs text-ink-secondary">
                Select a specific villa below to upload progress, approve
                rework, or inspect its activity history:
              </p>
              <Select
                aria-label="Select villa"
                value={villaId}
                onChange={(e) => onSelectVilla(e.target.value)}
              >
                <option value="">Choose a villa…</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    Villa {v.villa_number}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <>
              {current?.status === "REWORK_REQUIRED" && canApproveRework && (
                <div className="rounded-control border border-danger-border bg-danger-bg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-danger-text">
                      Rework Approval Required
                    </span>
                    <Badge variant="danger">Rework hold</Badge>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    Latest rework reason:{" "}
                    <strong className="text-ink">
                      {current.note || "Flagged for rework"}
                    </strong>
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    loading={saving}
                    onClick={() => void approveActivityRework()}
                  >
                    Approve rework & clear hold
                  </Button>
                </div>
              )}

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
                  Engineer or Director role is required to upload new activity
                  states.{" "}
                  {canApproveRework
                    ? "As Manager, you can approve any item flagged for rework."
                    : ""}
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
