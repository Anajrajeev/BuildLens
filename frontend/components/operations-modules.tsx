"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
   formatLabel,
  FormField,
  Icon,
  Input,
  MetricCard,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  TableSkeleton,
  Textarea,
} from "@/components/ui";

export type ActiveModule =
  | "Today"
  | "Quality"
  | "Materials"
  | "Procurement"
  | "Approvals"
  | "Safety"
  | "Daily reports"
  | "Reports"
  | "Handover"
  | "Inbox"
  | "AI";

type Villa = { id: string; villa_number: string };
type Task = {
  id: string;
  title?: string;
  status?: string;
  progress?: number;
  priority?: string;
  villa_id?: string;
  planned_end_at?: string;
};
type RecordItem = Record<string, unknown> & { id: string };

const formatDate = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString() : "Unscheduled";

export function OperationsModule({
  active,
  projectId,
  villas,
  tasks,
}: {
  active: ActiveModule;
  projectId?: string;
  villas: Villa[];
  tasks: Task[];
}) {
  if (!projectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Module unavailable"
          title={active}
          description="Create or select a project before using this operational module."
        />
        <EmptyState
          icon="building"
          title="No active project"
          description="Operational records are scoped to a project. Configure a project first to begin logging field data."
        />
      </div>
    );
  }
  if (active === "Today") return <Agenda projectId={projectId} villas={villas} />;
  if (active === "Quality")
    return <Quality projectId={projectId} villas={villas} tasks={tasks} />;
  if (active === "Materials") return <Materials projectId={projectId} />;
  if (active === "Procurement")
    return (
      <SimpleRegister
        title="Procurement"
        eyebrow="Purchase orders"
        description="Track active purchase orders, supplier commitments, and expected site deliveries."
        path={`/procurement/purchase-orders?project_id=${projectId}`}
      />
    );
  if (active === "Approvals") return <Approvals projectId={projectId} />;
  if (active === "Safety") return <Safety projectId={projectId} villas={villas} />;
  if (active === "Daily reports")
    return <DailyReports projectId={projectId} villas={villas} />;
  if (active === "Reports") return <Reports projectId={projectId} />;
  if (active === "Handover")
    return <Handovers projectId={projectId} villas={villas} />;
  if (active === "Inbox") return <Inbox />;
  return <AiBriefing projectId={projectId} />;
}

function useItems(path: string) {
  const [items, setItems] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems((await api<{ items: RecordItem[] }>(path)).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { items, loading, error, load };
}

function DataState({
  data,
  emptyTitle = "No records found",
  emptyDescription = "Add the first record to begin tracking this workflow.",
  onAdd,
  addLabel,
  children,
}: {
  data: { items: RecordItem[]; loading: boolean; error: string; load: () => Promise<void> };
  emptyTitle?: string;
  emptyDescription?: string;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
}) {
  if (data.loading) return <TableSkeleton rows={4} />;
  if (data.error)
    return <ErrorBanner message={data.error} onRetry={() => void data.load()} />;
  if (!data.items.length)
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={addLabel}
        onAction={onAdd}
      />
    );
  return <>{children}</>;
}

/* ==========================================================================
   TODAY / FIELD AGENDA
   ========================================================================== */

function Agenda({ projectId, villas }: { projectId: string; villas: Villa[] }) {
  const data = useItems(`/agenda?project_id=${projectId}`);
  const [show, setShow] = useState(false);

  const update = async (id: string, status: string) => {
    await api(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await data.load();
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    await api("/tasks", {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        villa_id: form.get("villa_id") || null,
        name: form.get("name"),
        priority: form.get("priority"),
        planned_start_at: form.get("planned_start_at") || null,
        planned_end_at: form.get("planned_end_at") || null,
      }),
    });
    setShow(false);
    await data.load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field agenda"
        title="Today"
        description="Daily field task execution, status transitions, and completion tracking."
        action={
          <Button icon="plus" onClick={() => setShow(true)}>
            Plan work
          </Button>
        }
      />

      <DataState
        data={data}
        emptyTitle="No field tasks scheduled"
        emptyDescription="Plan the first work item to organize daily site execution."
        addLabel="Plan work"
        onAdd={() => setShow(true)}
      >
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Work item</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Target finish</th>
                  <th className="py-3 px-4 w-44">Progress</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {data.items.map((item) => {
                  const villa = villas.find((v) => v.id === item.villa_id);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-subtle/60 transition-colors duration-fast"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-ink">
                          {String(item.name || item.title || "Work item")}
                        </div>
                        <div className="font-mono text-xs text-ink-muted mt-0.5">
                          {villa ? `Villa ${villa.villa_number}` : "Project-wide"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={item.priority || "MEDIUM"}>
                          {formatLabel(item.priority || "Medium")}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={item.status || "NOT_STARTED"} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-ink-secondary tabular-nums whitespace-nowrap">
                        {formatDate(item.planned_end_at)}
                      </td>
                      <td className="py-3.5 px-4">
                        <ProgressBar value={Number(item.progress || 0)} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void update(item.id, "IN_PROGRESS")}
                          >
                            Start
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void update(item.id, "BLOCKED")}
                          >
                            Block
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void update(item.id, "COMPLETED")}
                          >
                            Complete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>

      {show && (
        <Modal
          eyebrow="Field agenda"
          title="Plan a work item"
          description="Schedule a task and assign its priority and target dates."
          onClose={() => setShow(false)}
          onSubmit={save}
          submitLabel="Save work item"
        >
          <FormField label="Work item" htmlFor="task-name" required>
            <Input
              id="task-name"
              name="name"
              placeholder="e.g. First floor internal plastering"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Villa" htmlFor="task-villa">
              <Select id="task-villa" name="villa_id">
                <option value="">Project-wide</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    Villa {v.villa_number}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Priority" htmlFor="task-priority">
              <Select id="task-priority" name="priority" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Planned start" htmlFor="task-start">
              <Input id="task-start" name="planned_start_at" type="datetime-local" />
            </FormField>
            <FormField label="Planned finish" htmlFor="task-end">
              <Input id="task-end" name="planned_end_at" type="datetime-local" />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   QUALITY CONTROL (SNAGS & INSPECTIONS)
   ========================================================================== */

function Quality({
  projectId,
  villas,
  tasks,
}: {
  projectId: string;
  villas: Villa[];
  tasks: Task[];
}) {
  const [tab, setTab] = useState<"snags" | "inspections">("snags");
  const [show, setShow] = useState(false);
  const data = useItems(`/quality/${tab}?project_id=${projectId}`);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    const payload =
      tab === "snags"
        ? {
            project_id: projectId,
            villa_id: form.get("villa_id"),
            task_id: form.get("task_id") || null,
            title: form.get("title"),
            description: form.get("description"),
            severity: form.get("severity"),
          }
        : {
            project_id: projectId,
            villa_id: form.get("villa_id"),
            task_id: form.get("task_id") || null,
            inspection_type: form.get("inspection_type"),
            notes: form.get("notes") || null,
          };
    await api(`/quality/${tab}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setShow(false);
    await data.load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inspect · snag · verify"
        title="Quality control"
        description="Manage field snags, remedial rectifications, and formal QA/QC inspections."
        action={
          <Button icon="plus" onClick={() => setShow(true)}>
            New {tab === "snags" ? "snag" : "inspection"}
          </Button>
        }
      />

      {/* Segmented Control */}
      <div className="flex items-center justify-between gap-4">
        <div
          className="inline-flex rounded-control border border-border bg-surface-subtle p-1"
          role="tablist"
          aria-label="Quality records"
        >
          {(["snags", "inspections"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={`rounded-[6px] px-3.5 py-1.5 text-xs font-medium capitalize transition-colors duration-fast focus-ring ${
                tab === item
                  ? "bg-surface text-ink shadow-sm border border-border"
                  : "text-ink-secondary hover:text-ink border border-transparent"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {data.items.length} {data.items.length === 1 ? "record" : "records"}
        </span>
      </div>

      <DataState
        data={data}
        emptyTitle={`No ${tab} logged yet`}
        emptyDescription={`Create the first ${
          tab === "snags" ? "snag" : "inspection"
        } record to track quality verification.`}
        addLabel={`New ${tab === "snags" ? "snag" : "inspection"}`}
        onAdd={() => setShow(true)}
      >
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">
                    {tab === "snags" ? "Snag title" : "Inspection type"}
                  </th>
                  <th className="py-3 px-4">Notes & findings</th>
                  <th className="py-3 px-4">
                    {tab === "snags" ? "Severity" : "Category"}
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">
                    {tab === "snags" ? "Due date" : "Scheduled"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-subtle/60 transition-colors duration-fast"
                  >
                    <td className="py-3.5 px-4 font-medium text-ink">
                      {String(item.title || item.inspection_type || "Inspection")}
                    </td>
                    <td className="py-3.5 px-4 text-ink-secondary max-w-md">
                      {String(item.description || item.notes || "No notes recorded")}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={item.severity || "ACTIVE"}>
                        {formatLabel(item.severity || "QA Check")}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={item.status || "PENDING"} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-secondary tabular-nums whitespace-nowrap">
                      {formatDate(item.due_at || item.scheduled_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>

      {show && (
        <Modal
          eyebrow="Quality control"
          title={`Create ${tab === "snags" ? "a snag" : "an inspection"}`}
          onClose={() => setShow(false)}
          onSubmit={save}
        >
          <VillaTaskFields villas={villas} tasks={tasks} />
          {tab === "snags" ? (
            <>
              <FormField label="Snag title" htmlFor="snag-title" required>
                <Input
                  id="snag-title"
                  name="title"
                  placeholder="e.g. Hairline crack in ceiling plaster"
                  required
                />
              </FormField>
              <FormField label="Severity" htmlFor="snag-severity">
                <Select id="snag-severity" name="severity" defaultValue="MEDIUM">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </FormField>
              <FormField label="Description" htmlFor="snag-desc" required>
                <Textarea
                  id="snag-desc"
                  name="description"
                  placeholder="Describe location, defect, and required rectification…"
                  required
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Inspection type" htmlFor="insp-type" required>
                <Input
                  id="insp-type"
                  name="inspection_type"
                  placeholder="Finishing / MEP / handover"
                  required
                />
              </FormField>
              <FormField label="Inspection notes" htmlFor="insp-notes">
                <Textarea
                  id="insp-notes"
                  name="notes"
                  placeholder="Checklist observations and tolerance measurements…"
                />
              </FormField>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   MATERIALS & INVENTORY
   ========================================================================== */

function Materials({ projectId }: { projectId: string }) {
  const data = useItems(`/materials?project_id=${projectId}`);
  const lowCount = data.items.filter(
    (item) =>
      Number(item.quantity_on_hand || 0) <= Number(item.reorder_level || 0)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock control"
        title="Materials & inventory"
        description="Receipts, issues, and reorder exceptions tracked in one site ledger."
      />

      {!data.loading && !data.error && data.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Tracked materials"
            value={data.items.length}
            hint="Active SKUs in site stores"
            icon="materials"
          />
          <MetricCard
            label="Reorder alerts"
            value={lowCount}
            hint="Below minimum buffer threshold"
            badge={
              lowCount > 0 ? (
                <Badge variant="danger">Reorder required</Badge>
              ) : (
                <Badge variant="success">Healthy</Badge>
              )
            }
          />
          <MetricCard
            label="Healthy stock"
            value={data.items.length - lowCount}
            hint="Above reorder threshold"
            icon="check-circle"
          />
        </div>
      )}

      <DataState
        data={data}
        emptyTitle="No materials in inventory"
        emptyDescription="Stock balances and reorder alerts appear here once materials are registered."
      >
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Material description</th>
                  <th className="py-3 px-4 text-right">Quantity on hand</th>
                  <th className="py-3 px-4 text-right">Reorder level</th>
                  <th className="py-3 px-4 text-right">Stock status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {data.items.map((item) => {
                  const product = (item.products || {}) as Record<
                    string,
                    unknown
                  >;
                  const onHand = Number(item.quantity_on_hand || 0);
                  const reorder = Number(item.reorder_level || 0);
                  const low = onHand <= reorder;
                  const unit = String(product.unit || "units");

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-subtle/60 transition-colors duration-fast"
                    >
                      <td className="py-3.5 px-4">
                        <Badge variant="neutral" dot={false} mono>
                          {String(product.sku || "MAT")}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-ink">
                        {String(product.name || "Unnamed product")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-ink tabular-nums">
                        {onHand.toLocaleString()}{" "}
                        <span className="font-normal text-xs text-ink-muted">
                          {unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-secondary tabular-nums">
                        {reorder.toLocaleString()} {unit}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge variant={low ? "danger" : "success"}>
                          {low ? "Reorder required" : "In stock"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
    </div>
  );
}

/* ==========================================================================
   PROCUREMENT / SIMPLE REGISTER
   ========================================================================== */

function SimpleRegister({
  title,
  eyebrow,
  description,
  path,
}: {
  title: string;
  eyebrow: string;
  description: string;
  path: string;
}) {
  const data = useItems(path);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <DataState
        data={data}
        emptyTitle={`No ${title.toLowerCase()} records`}
        emptyDescription="Records synchronized from the live operational register will appear here."
      >
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Requested date</th>
                  <th className="py-3 px-4 text-right">Expected delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-subtle/60 transition-colors duration-fast"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-ink">
                      {String(
                        item.po_number ||
                          item.name ||
                          item.title ||
                          item.description ||
                          "Record"
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={item.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink-secondary tabular-nums">
                      {formatDate(item.requested_at || item.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-secondary tabular-nums">
                      {formatDate(item.expected_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>
    </div>
  );
}

/* ==========================================================================
   APPROVALS & DRAWINGS
   ========================================================================== */

function Approvals({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<"wirs" | "drawings">("wirs");
  const data = useItems(`/${tab}?project_id=${projectId}`);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controlled information"
        title="Approvals & drawings"
        description="WIR decisions and current drawing revisions remain traceable across villas."
      />
      <div className="inline-flex rounded-control border border-border bg-surface-subtle p-1">
        <button
          type="button"
          onClick={() => setTab("wirs")}
          className={`rounded-[6px] px-3.5 py-1.5 text-xs font-medium transition-colors duration-fast ${
            tab === "wirs"
              ? "bg-surface text-ink shadow-sm border border-border"
              : "text-ink-secondary hover:text-ink border border-transparent"
          }`}
        >
          WIR approvals
        </button>
        <button
          type="button"
          onClick={() => setTab("drawings")}
          className={`rounded-[6px] px-3.5 py-1.5 text-xs font-medium transition-colors duration-fast ${
            tab === "drawings"
              ? "bg-surface text-ink shadow-sm border border-border"
              : "text-ink-secondary hover:text-ink border border-transparent"
          }`}
        >
          Drawings
        </button>
      </div>
      <DataState
        data={data}
        emptyTitle={`No ${tab === "wirs" ? "WIR approvals" : "drawings"} registered`}
        emptyDescription="Controlled submissions and drawing revisions will be listed here."
      >
        <Card noPadding>
          <div className="divide-y divide-border-subtle">
            {data.items.map((item) => (
              <article
                key={item.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <span className="font-medium text-ink">
                  {String(
                    item.document_type || item.description || "Controlled record"
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Badge status={item.status || item.approval_status} />
                  <span className="font-mono text-xs text-ink-muted">
                    {String(item.revision || item.version || "Current")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </DataState>
    </div>
  );
}

/* ==========================================================================
   INBOX / NOTIFICATIONS
   ========================================================================== */

function Inbox() {
  const data = useItems("/notifications");
  const read = async (id: string) => {
    await api(`/notifications/${id}/read`, { method: "PATCH" });
    await data.load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Alerts & escalations"
        title="Inbox"
        description="Operational notices and inspection sign-offs linked to their source records."
      />

      <DataState
        data={data}
        emptyTitle="Inbox is clear"
        emptyDescription="You have no pending operational notifications or escalations."
      >
        <Card noPadding>
          <div className="divide-y divide-border-subtle">
            {data.items.map((item) => {
              const isUnread = !item.read_at;
              return (
                <article
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 transition-colors duration-fast ${
                    isUnread ? "bg-surface" : "bg-surface-subtle/40"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        isUnread ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-semibold text-ink">
                          {String(item.title || "Notification")}
                        </strong>
                        {Boolean(item.type) && (
                          <Badge status={item.type} dot={false}>
                            {formatLabel(item.type)}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
                        {String(item.body || formatLabel(item.type))}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-5 sm:pl-0">
                    {item.read_at ? (
                      <Badge variant="neutral" dot={false}>
                        Read
                      </Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="check"
                        onClick={() => void read(item.id)}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      </DataState>
    </div>
  );
}

/* ==========================================================================
   SAFETY OBSERVATIONS
   ========================================================================== */

function Safety({ projectId, villas }: { projectId: string; villas: Villa[] }) {
  const data = useItems(`/safety?project_id=${projectId}`);
  const [show, setShow] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    await api("/safety", {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        villa_id: form.get("villa_id") || null,
        observation_type: form.get("observation_type"),
        severity: form.get("severity"),
        description: form.get("description"),
        corrective_action: form.get("corrective_action") || null,
      }),
    });
    setShow(false);
    await data.load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Observe · act · close"
        title="Safety"
        description="Log field safety observations, toolbox talks, permits, and corrective actions."
        action={
          <Button icon="plus" onClick={() => setShow(true)}>
            Log observation
          </Button>
        }
      />

      <DataState
        data={data}
        emptyTitle="No safety observations recorded"
        emptyDescription="Log toolbox talks, near misses, or safety inspections to maintain site compliance."
        addLabel="Log observation"
        onAdd={() => setShow(true)}
      >
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Observation & corrective action</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-subtle/60 transition-colors duration-fast"
                  >
                    <td className="py-3.5 px-4">
                      <Badge status={item.observation_type} dot={false}>
                        {formatLabel(item.observation_type)}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={item.severity}>
                        {formatLabel(item.severity)}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 max-w-lg">
                      <p className="font-medium text-ink">
                        {String(item.description)}
                      </p>
                      {Boolean(item.corrective_action) && (
                        <p className="mt-1 text-xs text-ink-secondary">
                          <span className="font-medium text-ink">Action:</span>{" "}
                          {String(item.corrective_action)}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={item.status || "OPEN"} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-secondary tabular-nums whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>

      {show && (
        <Modal
          eyebrow="HSE compliance"
          title="Log a safety observation"
          onClose={() => setShow(false)}
          onSubmit={save}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Villa" htmlFor="safety-villa">
              <Select id="safety-villa" name="villa_id">
                <option value="">Project-wide</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    Villa {v.villa_number}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Type" htmlFor="safety-type">
              <Select id="safety-type" name="observation_type">
                <option value="OBSERVATION">Observation</option>
                <option value="INCIDENT">Incident</option>
                <option value="NEAR_MISS">Near miss</option>
                <option value="TOOLBOX_TALK">Toolbox talk</option>
                <option value="PERMIT">Permit</option>
              </Select>
            </FormField>
            <FormField label="Severity" htmlFor="safety-severity">
              <Select id="safety-severity" name="severity" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Description" htmlFor="safety-desc" required>
            <Textarea
              id="safety-desc"
              name="description"
              placeholder="Describe the observation, hazard, or briefing topic…"
              required
            />
          </FormField>
          <FormField label="Corrective action" htmlFor="safety-action">
            <Textarea
              id="safety-action"
              name="corrective_action"
              placeholder="Immediate mitigation or follow-up steps taken…"
            />
          </FormField>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   DAILY REPORTS
   ========================================================================== */

function DailyReports({
  projectId,
  villas,
}: {
  projectId: string;
  villas: Villa[];
}) {
  const data = useItems(`/daily-reports?project_id=${projectId}`);
  const [show, setShow] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    await api("/daily-reports", {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        villa_id: form.get("villa_id") || null,
        report_date: form.get("report_date"),
        weather: form.get("weather") || null,
        workforce_count: Number(form.get("workforce_count") || 0),
        summary: form.get("summary"),
        constraints: form.get("constraints") || null,
      }),
    });
    setShow(false);
    await data.load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Site diary"
        title="Daily reports"
        description="Daily site logs, workforce deployment, weather conditions, and constraints."
        action={
          <Button icon="plus" onClick={() => setShow(true)}>
            Submit report
          </Button>
        }
      />

      <DataState
        data={data}
        emptyTitle="No daily reports submitted"
        emptyDescription="Submit the first daily report to record site progress and workforce deployment."
        addLabel="Submit report"
        onAdd={() => setShow(true)}
      >
        <div className="space-y-3">
          {data.items.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <Badge variant="accent" dot={false} mono>
                  {formatDate(item.report_date)}
                </Badge>
                <div className="flex items-center gap-3 font-mono text-xs text-ink-muted">
                  <span>{Number(item.workforce_count || 0)} workers</span>
                  <span>·</span>
                  <span>{String(item.weather || "Weather not recorded")}</span>
                </div>
              </div>
              <p className="text-sm font-medium text-ink leading-relaxed">
                {String(item.summary)}
              </p>
              {Boolean(item.constraints) && (
                <p className="mt-2 text-xs text-warning-text bg-warning-bg border border-warning-border rounded-control px-3 py-2">
                  <strong>Constraint:</strong> {String(item.constraints)}
                </p>
              )}
            </Card>
          ))}
        </div>
      </DataState>

      {show && (
        <Modal
          eyebrow="Site diary"
          title="Submit daily report"
          onClose={() => setShow(false)}
          onSubmit={save}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date" htmlFor="dr-date" required>
              <Input
                id="dr-date"
                name="report_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </FormField>
            <FormField label="Villa" htmlFor="dr-villa">
              <Select id="dr-villa" name="villa_id">
                <option value="">Project-wide</option>
                {villas.map((v) => (
                  <option key={v.id} value={v.id}>
                    Villa {v.villa_number}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Weather" htmlFor="dr-weather">
              <Input id="dr-weather" name="weather" placeholder="e.g. Clear, 28°C" />
            </FormField>
            <FormField label="Workforce count" htmlFor="dr-workforce">
              <Input
                id="dr-workforce"
                name="workforce_count"
                type="number"
                min="0"
                defaultValue="0"
              />
            </FormField>
          </div>
          <FormField label="Progress summary" htmlFor="dr-summary" required>
            <Textarea
              id="dr-summary"
              name="summary"
              placeholder="Summarize key pours, inspections, and trade activities…"
              required
            />
          </FormField>
          <FormField label="Site constraints" htmlFor="dr-constraints">
            <Textarea
              id="dr-constraints"
              name="constraints"
              placeholder="Note any access, material, or transit delays…"
            />
          </FormField>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   OPERATIONAL INTELLIGENCE / REPORTS
   ========================================================================== */

function Reports({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Record<string, unknown>>(`/reports/overview?project_id=${projectId}`)
      .then(setReport)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load report.")
      );
  }, [projectId]);

  const metrics = (report?.metrics || {}) as Record<string, unknown>;
  const exceptions = (report?.exceptions || []) as RecordItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live reporting"
        title="Operational intelligence"
        description="Every metric and exception links directly to live project records."
      />

      {error ? (
        <ErrorBanner message={error} />
      ) : !report ? (
        <TableSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total tasks"
              value={String(metrics.tasks_total ?? 0)}
              hint="Active in schedule register"
              icon="today"
            />
            <MetricCard
              label="Average progress"
              value={`${metrics.average_progress || 0}%`}
              hint="Mean completion across tasks"
              icon="reports"
            />
            <MetricCard
              label="Open snags"
              value={String(metrics.open_snags ?? 0)}
              hint="Awaiting rectification & QA"
              badge={
                Number(metrics.open_snags || 0) > 0 ? (
                  <Badge variant="warning">Active</Badge>
                ) : (
                  <Badge variant="success">Clear</Badge>
                )
              }
            />
            <MetricCard
              label="Low-stock items"
              value={String(metrics.low_stock_items ?? 0)}
              hint="Materials below reorder buffer"
              badge={
                Number(metrics.low_stock_items || 0) > 0 ? (
                  <Badge variant="danger">Reorder</Badge>
                ) : (
                  <Badge variant="success">Optimal</Badge>
                )
              }
            />
          </div>

          <Card noPadding>
            <CardHeader
              title="Exceptions requiring attention"
              subtitle="Automated flags raised by blocked tasks, pending inspections, or stock thresholds."
              badge={
                <Badge variant={exceptions.length ? "danger" : "success"}>
                  {exceptions.length} active
                </Badge>
              }
            />
            {exceptions.length ? (
              <div className="divide-y divide-border-subtle">
                {exceptions.map((item, index) => (
                  <article
                    key={`${item.type}-${index}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-surface-subtle/50"
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        name="alert-triangle"
                        className="h-4 w-4 text-danger-text mt-0.5 shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {String(
                            item.message || item.title || "Review this exception"
                          )}
                        </p>
                        <p className="font-mono text-xs text-ink-muted mt-0.5">
                          Exception code: {String(item.type)}
                        </p>
                      </div>
                    </div>
                    <Badge status={item.type}>
                      {formatLabel(item.type)}
                    </Badge>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-ink-muted">
                No exceptions are currently reported.
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   HANDOVER READINESS
   ========================================================================== */

function Handovers({
  projectId,
  villas,
}: {
  projectId: string;
  villas: Villa[];
}) {
  const data = useItems(`/handovers?project_id=${projectId}`);
  const [show, setShow] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    const form = new FormData(event.currentTarget);
    await api("/handovers", {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        villa_id: form.get("villa_id"),
        target_date: form.get("target_date") || null,
        customer_name: form.get("customer_name") || null,
        notes: form.get("notes") || null,
      }),
    });
    setShow(false);
    await data.load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Closeout"
        title="Handover readiness"
        description="Track client handover packages, pre-snagging readiness scores, and target dates."
        action={
          <Button icon="plus" onClick={() => setShow(true)}>
            Start handover
          </Button>
        }
      />

      <DataState
        data={data}
        emptyTitle="No handover packages started"
        emptyDescription="Initiate a handover package to track closeout checklists and customer readiness."
        addLabel="Start handover"
        onAdd={() => setShow(true)}
      >
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-xs font-medium uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Customer / Package</th>
                  <th className="py-3 px-4">Closeout stage</th>
                  <th className="py-3 px-4 w-56">Readiness score</th>
                  <th className="py-3 px-4 text-right">Target handover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-subtle/60 transition-colors duration-fast"
                  >
                    <td className="py-3.5 px-4 font-medium text-ink">
                      {String(item.customer_name || "Customer pending")}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={item.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <ProgressBar
                        value={Number(item.readiness_score || 0)}
                        variant={
                          Number(item.readiness_score || 0) >= 85
                            ? "success"
                            : "accent"
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-secondary tabular-nums">
                      {formatDate(item.target_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </DataState>

      {show && (
        <Modal
          eyebrow="Closeout package"
          title="Start handover package"
          onClose={() => setShow(false)}
          onSubmit={save}
        >
          <FormField label="Villa" htmlFor="ho-villa" required>
            <Select id="ho-villa" name="villa_id" required>
              <option value="">Select villa</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  Villa {v.villa_number}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Customer name" htmlFor="ho-customer">
              <Input
                id="ho-customer"
                name="customer_name"
                placeholder="e.g. Mr. & Mrs. Tariq Mansoor"
              />
            </FormField>
            <FormField label="Target handover date" htmlFor="ho-date">
              <Input id="ho-date" name="target_date" type="date" />
            </FormField>
          </div>
          <FormField label="Closeout notes" htmlFor="ho-notes">
            <Textarea
              id="ho-notes"
              name="notes"
              placeholder="Document O&M manual status, key handover, or snagging notes…"
            />
          </FormField>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   BUILDLENS AI COPILOT
   ========================================================================== */

function AiBriefing({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("What needs attention today?");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ answer: string; mode: string }>(
        "/ai/briefing",
        {
          method: "POST",
          body: JSON.stringify({ project_id: projectId, question }),
        }
      );
      setAnswer(result.answer);
      setMode(result.mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI briefing failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations copilot"
        title="BuildLens AI"
        description="Grounded in your live project data; no operational change is made without human confirmation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card className="lg:col-span-5">
          <form onSubmit={ask} className="space-y-4">
            <FormField
              label="Operational query"
              htmlFor="ai-question"
              helperText="Ask about project risks, schedule bottlenecks, quality snags, or material stock."
            >
              <Textarea
                id="ai-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
              />
            </FormField>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink-muted block">
                Suggested prompts
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  [
                    "Critical risks",
                    "Summarise today's critical risks and next actions.",
                  ],
                  [
                    "Likely delays",
                    "Which villas or tasks are most likely to slip?",
                  ],
                  [
                    "Morning briefing",
                    "Prepare a concise morning briefing for the site team.",
                  ],
                ].map(([shortLabel, fullPrompt]) => (
                  <button
                    key={shortLabel}
                    type="button"
                    onClick={() => setQuestion(fullPrompt)}
                    className="rounded-control border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary hover:border-border-strong hover:text-ink transition-colors duration-fast focus-ring"
                  >
                    {shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                icon="ai"
                loading={loading}
                className="w-full"
              >
                {loading ? "Analysing project records…" : "Generate briefing"}
              </Button>
            </div>
          </form>

          {error && (
            <div className="mt-4">
              <ErrorBanner message={error} />
            </div>
          )}
        </Card>

        <Card noPadding className="lg:col-span-7 min-h-[260px] flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Icon name="ai" className="h-4 w-4 text-accent-text" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                AI Operational Briefing
              </span>
            </div>
            {answer && (
              <Badge variant="accent" dot>
                {mode === "gemini"
                  ? "Gemini-grounded analysis"
                  : "Deterministic project analysis"}
              </Badge>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col justify-center">
            {answer ? (
              <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                {answer}
              </p>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm font-medium text-ink">
                  Ready to generate project briefing
                </p>
                <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
                  Select a prompt or enter a specific question on the left to
                  synthesize current task, snag, and inventory telemetry.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ==========================================================================
   SHARED FORM FIELDS
   ========================================================================== */

function VillaTaskFields({
  villas,
  tasks,
}: {
  villas: Villa[];
  tasks: Task[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Villa" htmlFor="field-villa" required>
        <Select id="field-villa" name="villa_id" required>
          <option value="">Select villa</option>
          {villas.map((v) => (
            <option key={v.id} value={v.id}>
              Villa {v.villa_number}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Linked task" htmlFor="field-task">
        <Select id="field-task" name="task_id">
          <option value="">No linked task</option>
          {tasks.map((task, index) => (
            <option key={task.id} value={task.id}>
              {task.title || `Task ${index + 1}`}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
