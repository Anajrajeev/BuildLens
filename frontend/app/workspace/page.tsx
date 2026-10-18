"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import "@/lib/firebase";
import BrandLogo from "@/components/brand-logo";
import WorkflowBoard from "@/components/workflow-board";
import { OperationsModule } from "@/components/operations-modules";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  FormField,
  formatLabel,
  Icon,
  IconName,
  Input,
  MetricCard,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  TableSkeleton,
  ThemeToggle,
} from "@/components/ui";

type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
};

type Villa = {
  id: string;
  villa_number: string;
  block?: string;
  status: string;
  villa_type?: string;
};

type Task = {
  id: string;
  title?: string;
  status?: string;
  progress?: number;
  priority?: string;
  villa_id?: string;
  planned_end_at?: string;
};

type Me = {
  permissions?: string[];
  email: string | null;
  full_name?: string | null;
  employee_code?: string | null;
};

type CatalogItem = {
  id: string;
  name?: string;
  company_name?: string;
  category?: string;
  status?: string;
  active?: boolean;
};

type PersonData = {
  employees: {
    id: string;
    full_name: string;
    employee_code: string;
    status: string;
  }[];
  roles: {
    id: string;
    name: string;
    description?: string;
  }[];
  projects: Project[];
};

const isAdmin = (email?: string | null) =>
  !email || email.toLowerCase() === "anajrajeev@gmail.com";

const navItems = [
  "Dashboard",
  "Today",
  "AI",
  "Villas",
  "Work sections",
  "People",
  "Documents",
  "Reports",
  "Materials",
  "Procurement",
  "Vendors",
  "Quality",
  "Safety",
  "Handover",
] as const;

type NavItem = (typeof navItems)[number];
type ActiveSection = NavItem | "Inbox";

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: ["Dashboard", "Today", "AI"] },
  {
    label: "Execution",
    items: ["Villas", "Work sections", "People", "Documents", "Reports"],
  },
  { label: "Supply Chain", items: ["Materials", "Procurement", "Vendors"] },
  { label: "Assurance", items: ["Quality", "Safety", "Handover"] },
];

const navIconMap: Record<NavItem, IconName> = {
  Dashboard: "dashboard",
  Today: "today",
  AI: "ai",
  Villas: "villas",
  "Work sections": "work-sections",
  People: "people",
  Documents: "documents",
  Reports: "reports",
  Materials: "materials",
  Procurement: "procurement",
  Vendors: "vendors",
  Quality: "quality",
  Safety: "safety",
  Handover: "handover",
};

export default function Workspace() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [villas, setVillas] = useState<Villa[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [active, setActive] = useState<ActiveSection>("Dashboard");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [addingVilla, setAddingVilla] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [profile, projectResponse, taskResponse] = await Promise.all([
        api<Me>("/auth/me"),
        api<{ items: Project[] }>("/projects"),
        api<{ items: Task[] }>("/tasks"),
      ]);
      setMe(profile);
      setProjects(projectResponse.items);
      setTasks(taskResponse.items);
      setVillas(
        projectResponse.items[0]
          ? (
              await api<{ items: Villa[] }>(
                `/projects/${projectResponse.items[0].id}/villas`
              )
            ).items
          : []
      );
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load live operations data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [profileOpen]);

  if (loading) return <WorkspaceLoader />;

  if (loadError) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <Card className="max-w-md w-full space-y-4">
          <div className="flex items-center gap-2.5 text-danger-text">
            <Icon name="alert-circle" className="h-5 w-5" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">
              Workspace unavailable
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            We could not retrieve live data.
          </h1>
          <p className="text-sm text-ink-secondary">{loadError}</p>
          <div className="pt-2">
            <Button icon="refresh" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  const project = projects[0];
  const canAdd = isAdmin(me?.email);
  const profileName = me?.full_name || me?.email || "Account";
  const initials = profileName
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const selectSection = (section: ActiveSection) => {
    setActive(section);
    setMobileMenuOpen(false);
    setProfileOpen(false);
  };

  const renderNavButton = (item: NavItem) => {
    const isSelected = active === item;
    return (
      <button
        key={item}
        type="button"
        aria-current={isSelected ? "page" : undefined}
        onClick={() => selectSection(item)}
        className={`w-full flex items-center justify-between gap-2.5 h-8 px-2.5 rounded-control text-xs font-medium transition-colors duration-fast ease-out focus-ring ${
          isSelected
            ? "bg-[#16423e] text-white font-semibold border border-[#286660] shadow-xs"
            : "text-teal-100/75 hover:bg-[#133330] hover:text-white border border-transparent"
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          <Icon
            name={navIconMap[item]}
            className={`h-4 w-4 ${
              isSelected ? "text-teal-300" : "text-teal-300/60"
            }`}
          />
          <span className="truncate">{item}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col lg:flex-row">
      {/* Desktop Sidebar — Grounded Deep Architectural Teal-Slate */}
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#183835] lg:bg-[#0c2422] lg:text-teal-50 lg:sticky lg:top-0 lg:h-screen">
        <div className="h-14 px-4 border-b border-[#183835] flex items-center justify-between">
          <BrandLogo priority inverted />
        </div>

        <div className="p-3 border-b border-[#183835]">
          <div className="rounded-control border border-[#214a46] bg-[#12312e] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-teal-200/70">
                Current project
              </span>
              {project?.status && (
                <Badge status={project.status} className="text-[10px] px-1.5 py-0" />
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-white truncate">
              {project?.name || "No project"}
            </p>
            <p className="font-mono text-[11px] text-teal-300/85 truncate">
              {project?.project_code || "Create a project"}
            </p>
          </div>
        </div>

        <nav
          aria-label="Workspace navigation"
          className="flex-1 overflow-y-auto px-3 py-3 space-y-5"
        >
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-teal-300/55">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => renderNavButton(item))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[#183835] bg-[#091c1a]">
          <div className="flex items-center justify-between text-xs text-teal-200/75 px-1">
            <span className="truncate font-medium">
              {me?.employee_code || "Workspace"}
            </span>
            <span className="font-mono text-[11px] text-teal-300">
              {villas.length} villas · {tasks.length} tasks
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-zinc-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[85vw] bg-[#0c2422] text-teal-50 border-r border-[#183835] flex flex-col h-full shadow-modal">
            <div className="h-14 px-4 border-b border-[#183835] flex items-center justify-between">
              <BrandLogo inverted />
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-control text-teal-200/80 hover:bg-[#133330] hover:text-white focus-ring"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 border-b border-[#183835]">
              <div className="rounded-control border border-[#214a46] bg-[#12312e] p-2.5">
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-teal-200/70">
                  Current project
                </span>
                <p className="mt-0.5 text-xs font-semibold text-white truncate">
                  {project?.name || "No project"}
                </p>
                <p className="font-mono text-[11px] text-teal-300/85">
                  {project?.project_code || "Create a project"}
                </p>
              </div>
            </div>
            <nav
              aria-label="Mobile workspace navigation"
              className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
            >
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-teal-300/55">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => renderNavButton(item))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-surface/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-ink-secondary hover:bg-surface-muted hover:text-ink focus-ring"
            >
              <Icon name="menu" className="h-4 w-4" />
            </button>

            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs sm:text-sm min-w-0"
            >
              <span className="font-mono text-xs text-ink-muted hidden sm:inline truncate">
                {project?.project_code || "Operations"}
              </span>
              <span
                className="text-ink-muted hidden sm:inline"
                aria-hidden="true"
              >
                /
              </span>
              <span className="font-semibold text-ink truncate">{active}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            <button
              type="button"
              aria-label="Open inbox"
              onClick={() => selectSection("Inbox")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-xs font-medium transition-colors duration-fast ease-out focus-ring ${
                active === "Inbox"
                  ? "border-accent-border bg-accent-subtle text-accent-text"
                  : "border-border bg-surface text-ink-secondary hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <Icon name="inbox" className="h-4 w-4" />
              <span className="hidden sm:inline">Inbox</span>
            </button>

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                onClick={() => setProfileOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-surface pl-1.5 pr-2.5 text-left transition-colors duration-fast ease-out hover:bg-surface-muted focus-ring"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] bg-accent text-white font-mono text-xs font-semibold">
                  {initials}
                </span>
                <span className="hidden md:flex flex-col leading-none">
                  <span className="text-xs font-medium text-ink max-w-[120px] truncate">
                    {profileName}
                  </span>
                </span>
                <Icon
                  name="chevron-down"
                  className={`h-3.5 w-3.5 text-ink-muted transition-transform duration-fast ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-60 rounded-card border border-border bg-surface p-1.5 shadow-overlay z-30"
                >
                  <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-border-subtle mb-1">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent-subtle text-accent-text font-mono text-xs font-semibold border border-accent-border">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">
                        {profileName}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {me?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => router.push("/workspace/profile")}
                    className="w-full flex items-center justify-between rounded-control px-2.5 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-muted hover:text-ink transition-colors duration-fast focus-ring"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="user" className="h-3.5 w-3.5 text-ink-muted" />
                      <span>View profile</span>
                    </span>
                    <Icon name="arrow-right" className="h-3.5 w-3.5 text-ink-muted" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 w-full px-4 py-6 sm:px-6 lg:px-8 pb-20 lg:pb-10">
          {active === "Dashboard" ? (
            <Dashboard
              project={project}
              villas={villas}
              tasks={tasks}
              onVillas={() => selectSection("Villas")}
              onWorkSections={() => selectSection("Work sections")}
              onAdd={() => setAddingVilla(true)}
              canAdd={canAdd}
            />
          ) : active === "Villas" ? (
            <Villas
              villas={villas}
              tasks={tasks}
              projectCode={project?.project_code}
              onAdd={() => setAddingVilla(true)}
              canAdd={canAdd}
            />
          ) : active === "Work sections" ? (
            <div className="space-y-8">
              <WorkflowBoard
                projects={projects}
                canEdit={
                  me?.permissions?.length
                    ? Boolean(me.permissions.includes("task.write"))
                    : true
                }
              />
              <Card noPadding>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-ink hover:bg-surface-subtle transition-colors duration-fast">
                    <div className="flex items-center gap-2.5">
                      <Icon
                        name="work-sections"
                        className="h-4 w-4 text-ink-muted"
                      />
                      <span>Organisation work-section catalog</span>
                    </div>
                    <Icon
                      name="chevron-down"
                      className="h-4 w-4 text-ink-muted transition-transform duration-fast group-open:rotate-180"
                    />
                  </summary>
                  <div className="border-t border-border p-5">
                    <CatalogPanel
                      kind="work-section"
                      canAdd={canAdd}
                      embedded
                    />
                  </div>
                </details>
              </Card>
            </div>
          ) : active === "Vendors" ? (
            <CatalogPanel kind="vendor" canAdd={canAdd} />
          ) : active === "People" ? (
            <PeoplePanel canManage={canAdd} />
          ) : active === "Documents" ? (
            <DocumentsPanel />
          ) : (
            <OperationsModule
              active={
                active as
                  | "Today"
                  | "Quality"
                  | "Materials"
                  | "Procurement"
                  | "Safety"
                  | "Reports"
                  | "Handover"
                  | "Inbox"
                  | "AI"
              }
              projectId={project?.id}
              villas={villas}
              tasks={tasks}
            />
          )}
        </main>

        {/* Mobile Bottom Quick Bar */}
        <nav
          aria-label="Quick mobile navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-20 h-14 border-t border-border bg-surface/95 backdrop-blur-sm px-2 flex items-center justify-around"
        >
          {(
            ["Dashboard", "Today", "Villas", "Work sections", "Quality"] as NavItem[]
          ).map((item) => {
            const isSelected = active === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => selectSection(item)}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-control text-[11px] font-medium transition-colors duration-fast focus-ring ${
                  isSelected
                    ? "text-accent-text font-semibold"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon name={navIconMap[item]} className="h-4 w-4" />
                <span>{item === "Work sections" ? "Work" : item}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-control text-[11px] font-medium text-ink-muted hover:text-ink focus-ring"
          >
            <Icon name="menu" className="h-4 w-4" />
            <span>More</span>
          </button>
        </nav>
      </div>

      {addingVilla && project && (
        <AddVilla
          project={project}
          close={() => setAddingVilla(false)}
          done={async () => {
            setAddingVilla(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   WORKSPACE LOADER (Calm Skeleton State)
   ========================================================================== */

function WorkspaceLoader() {
  return (
    <main
      className="min-h-screen bg-canvas flex flex-col lg:flex-row"
      aria-live="polite"
      aria-busy="true"
    >
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-surface p-4 space-y-6">
        <BrandLogo />
        <Skeleton className="h-16 w-full rounded-control" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-full rounded-control" />
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <div className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-control" />
            <Skeleton className="h-8 w-28 rounded-control" />
          </div>
        </div>
        <div className="p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-accent-text">
              Secure workspace
            </p>
            <h1 className="text-xl font-semibold text-ink">
              Connecting your operations…
            </h1>
            <p className="text-sm text-ink-muted">
              Verifying access and synchronising live project records.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-24 w-full rounded-card" />
            ))}
          </div>
          <Card noPadding>
            <TableSkeleton rows={5} cols={4} />
          </Card>
        </div>
      </div>
    </main>
  );
}

/* ==========================================================================
   DASHBOARD VIEW
   ========================================================================== */

function Dashboard({
  project,
  villas,
  tasks,
  onVillas,
  onWorkSections,
  onAdd,
  canAdd,
}: {
  project?: Project;
  villas: Villa[];
  tasks: Task[];
  onVillas: () => void;
  onWorkSections: () => void;
  onAdd: () => void;
  canAdd: boolean;
}) {
  const firstVilla = villas[0];
  const guidance = !project
    ? {
        title: "Create your first project",
        detail:
          "Projects organise every villa, team, and work record in BuildLens.",
      }
    : !firstVilla
    ? {
        title: "Map the first villa",
        detail:
          "Start the operational record by adding the first villa for this project.",
      }
    : tasks.length === 0
    ? {
        title: "Set up the first work item",
        detail: `Villa ${firstVilla.villa_number} is mapped. Add work sections and tasks when the site team is ready.`,
      }
    : {
        title: "Keep work moving",
        detail: `${tasks.length} live work ${
          tasks.length === 1 ? "item is" : "items are"
        } available for this workspace.`,
      };

  const completedTasks = tasks.filter(
    (t) => String(t.status).toUpperCase() === "COMPLETED"
  ).length;
  const avgProgress = tasks.length
    ? Math.round(
        tasks.reduce((acc, item) => acc + (Number(item.progress) || 0), 0) /
          tasks.length
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Construction control room"
        title={project?.name || "Start your first project"}
        description="Track every villa, work package, responsibility, and exception from one operational record."
        secondaryAction={
          <Button
            variant="secondary"
            icon="work-sections"
            onClick={onWorkSections}
          >
            Work sections
          </Button>
        }
        action={
          canAdd ? (
            <Button icon="plus" onClick={onAdd}>
              Add a villa
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Mapped villas"
          value={villas.length}
          subvalue="Units in register"
          icon="villas"
        />
        <MetricCard
          label="Live tasks"
          value={tasks.length}
          subvalue={`${completedTasks} completed`}
          icon="check-circle"
        />
        <MetricCard
          label="Average progress"
          value={`${avgProgress}%`}
          subvalue="Across active tasks"
          icon="reports"
        />
        <MetricCard
          label="Project status"
          value={formatLabel(project?.status || "Not configured")}
          badge={<Badge status={project?.status || "PLANNING"} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card noPadding className="lg:col-span-2">
          <CardHeader
            eyebrow="Unit register"
            title="Villa progress"
            subtitle="Active residential units and associated field work packages"
            action={
              <Button
                variant="ghost"
                size="sm"
                trailingIcon="arrow-right"
                onClick={onVillas}
              >
                View villas
              </Button>
            }
          />
          {villas.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="villas"
                title="No villas are mapped yet"
                description="Add the first residential unit to start tracking work packages, inspections, and handover readiness."
                actionLabel={canAdd ? "Add a villa" : undefined}
                onAction={canAdd ? onAdd : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    <th className="py-2.5 px-4">Unit</th>
                    <th className="py-2.5 px-4">Block</th>
                    <th className="py-2.5 px-4">Typology</th>
                    <th className="py-2.5 px-4">Tasks</th>
                    <th className="py-2.5 px-4 w-40">Progress</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-sm">
                  {villas.map((villa) => {
                    const villaTasks = tasks.filter(
                      (t) => t.villa_id === villa.id
                    );
                    const villaProgress = villaTasks.length
                      ? Math.round(
                          villaTasks.reduce(
                            (sum, t) => sum + (Number(t.progress) || 0),
                            0
                          ) / villaTasks.length
                        )
                      : 0;
                    return (
                      <tr
                        key={villa.id}
                        onClick={onVillas}
                        className="cursor-pointer transition-colors duration-fast hover:bg-surface-subtle"
                      >
                        <td className="py-3 px-4 font-medium text-ink">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] border border-accent-border bg-accent-subtle font-mono text-[11px] font-semibold text-accent-text">
                              {villa.villa_number.replace(/\D+/g, "").slice(-2) || "V"}
                            </span>
                            <span>Villa {villa.villa_number}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-secondary">
                          {villa.block || "No block"}
                        </td>
                        <td className="py-3 px-4 text-xs text-ink-secondary">
                          {villa.villa_type || "Type pending"}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-ink-secondary tabular-nums">
                          {villaTasks.length}
                        </td>
                        <td className="py-3 px-4">
                          <ProgressBar value={villaProgress} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge status={villa.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 border-accent-border bg-accent-subtle">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                Next operational step
              </span>
              <h3 className="mt-2 text-base font-semibold text-ink">
                {guidance.title}
              </h3>
              <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
                {guidance.detail}
              </p>
            </div>

            <div className="rounded-control border border-accent-border bg-surface p-3">
              <p className="font-mono text-[11px] font-semibold text-accent-text uppercase tracking-wider mb-2">
                Execution hierarchy
              </p>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink">
                <span>Project</span>
                <span className="text-ink-muted">→</span>
                <span>Villa</span>
                <span className="text-ink-muted">→</span>
                <span>Work</span>
                <span className="text-ink-muted">→</span>
                <span>Task</span>
                <span className="text-ink-muted">→</span>
                <span className="text-accent-text font-semibold">Progress</span>
              </div>
            </div>
          </Card>

          <Card noPadding>
            <CardHeader
              eyebrow="Active queue"
              title="Live field tasks"
              subtitle="Current work items across mapped units"
            />
            {tasks.length === 0 ? (
              <div className="p-4 text-xs text-ink-muted">
                No tasks recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {tasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink truncate">
                        {task.title || "Untitled task"}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                        {task.planned_end_at
                          ? `Due ${task.planned_end_at}`
                          : "Schedule active"}
                      </p>
                    </div>
                    <Badge status={task.status || "IN_PROGRESS"} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   VILLAS VIEW
   ========================================================================== */

function Villas({
  villas,
  tasks,
  projectCode,
  onAdd,
  canAdd,
}: {
  villas: Villa[];
  tasks: Task[];
  projectCode?: string;
  onAdd: () => void;
  canAdd: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredVillas = useMemo(() => {
    return villas.filter((v) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        String(v.status).toUpperCase() === statusFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        v.villa_number.toLowerCase().includes(q) ||
        (v.block || "").toLowerCase().includes(q) ||
        (v.villa_type || "").toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [villas, query, statusFilter]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(villas.map((v) => String(v.status).toUpperCase()).filter(Boolean))
      ),
    [villas]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={projectCode || "Unit register"}
        title="All villas"
        description="Inspect unit typologies, block assignments, and live work package execution status."
        action={
          canAdd ? (
            <Button icon="plus" onClick={onAdd}>
              Add villa
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon
            name="search"
            className="h-4 w-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Filter by villa number, block, or type…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search villas"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          >
            <option value="ALL">All statuses ({villas.length})</option>
            {statuses.map((st) => (
              <option key={st} value={st}>
                {formatLabel(st)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filteredVillas.length === 0 ? (
        <EmptyState
          icon="villas"
          title="No villas match this view"
          description={
            villas.length === 0
              ? "No villas are mapped to this project yet."
              : "Adjust your search or status filter to see mapped units."
          }
          actionLabel={villas.length === 0 && canAdd ? "Add villa" : undefined}
          onAction={villas.length === 0 && canAdd ? onAdd : undefined}
        />
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Villa Number</th>
                  <th className="py-3 px-4">Block</th>
                  <th className="py-3 px-4">Villa Type</th>
                  <th className="py-3 px-4">Assigned Tasks</th>
                  <th className="py-3 px-4 w-48">Completion</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {filteredVillas.map((villa) => {
                  const unitTasks = tasks.filter(
                    (t) => t.villa_id === villa.id
                  );
                  const progress = unitTasks.length
                    ? Math.round(
                        unitTasks.reduce(
                          (acc, item) => acc + (Number(item.progress) || 0),
                          0
                        ) / unitTasks.length
                      )
                    : 0;
                  return (
                    <tr
                      key={villa.id}
                      className="transition-colors duration-fast hover:bg-surface-subtle"
                    >
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        Villa {villa.villa_number}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-ink-secondary">
                        {villa.block || "Block pending"}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-ink-secondary">
                        {villa.villa_type || "Type pending"}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-ink-secondary tabular-nums">
                        {unitTasks.length} {unitTasks.length === 1 ? "task" : "tasks"}
                      </td>
                      <td className="py-3.5 px-4">
                        <ProgressBar value={progress} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge status={villa.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ==========================================================================
   CATALOG PANEL (Work Sections & Vendors)
   ========================================================================== */

function CatalogPanel({
  kind,
  canAdd,
  embedded = false,
}: {
  kind: "work-section" | "vendor";
  canAdd: boolean;
  embedded?: boolean;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const title = kind === "work-section" ? "Work sections" : "Vendors";

  const load = async () => {
    try {
      setItems(
        (
          await api<{ items: CatalogItem[] }>(
            `/operations/${
              kind === "work-section" ? "work-sections" : "vendors"
            }`
          )
        ).items
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [kind]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(
        `/operations/${kind === "work-section" ? "work-sections" : "vendors"}`,
        {
          method: "POST",
          body: JSON.stringify(
            kind === "work-section"
              ? { name: form.get("name") }
              : {
                  company_name: form.get("company_name"),
                  category: form.get("category") || null,
                }
          ),
        }
      );
      setShowForm(false);
      setNotice("");
      setLoading(true);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save the record."
      );
    }
  };

  const addButton = canAdd ? (
    <Button
      size={embedded ? "sm" : "md"}
      icon="plus"
      onClick={() => setShowForm(true)}
    >
      Add {kind === "work-section" ? "section" : "vendor"}
    </Button>
  ) : undefined;

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          eyebrow="Live register"
          title={title}
          description={
            kind === "vendor"
              ? "Approved trade contractors, specialist suppliers, and active site partners."
              : "Standardised construction work sections across the organisation."
          }
          action={addButton}
        />
      )}

      {embedded && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              Live register
            </p>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
          </div>
          {addButton}
        </div>
      )}

      {notice && <ErrorBanner message={notice} onRetry={() => void load()} />}

      {loading ? (
        <Card noPadding>
          <TableSkeleton rows={4} cols={3} />
        </Card>
      ) : items.length > 0 ? (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">
                    {kind === "vendor" ? "Company Name" : "Work Section"}
                  </th>
                  <th className="py-3 px-4">
                    {kind === "vendor" ? "Trade Category" : "Record ID"}
                  </th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors duration-fast hover:bg-surface-subtle"
                  >
                    <td className="py-3 px-4 font-medium text-ink">
                      {item.name || item.company_name}
                    </td>
                    <td className="py-3 px-4 text-xs text-ink-secondary">
                      {kind === "vendor" ? (
                        item.category || "Category not set"
                      ) : (
                        <span className="font-mono">{item.id}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Badge
                        status={
                          item.status || (item.active ? "ACTIVE" : "INACTIVE")
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={kind === "vendor" ? "vendors" : "work-sections"}
          title={`No ${title.toLowerCase()} exist yet`}
          description={`Register your first ${
            kind === "work-section" ? "work section" : "vendor"
          } to link field activities and procurement records.`}
          actionLabel={
            canAdd
              ? `Add ${kind === "work-section" ? "section" : "vendor"}`
              : undefined
          }
          onAction={canAdd ? () => setShowForm(true) : undefined}
        />
      )}

      {showForm && (
        <Modal
          onClose={() => setShowForm(false)}
          onSubmit={save}
          eyebrow={title}
          title={`Add ${
            kind === "work-section" ? "a work section" : "a vendor"
          }`}
          submitLabel="Save record"
        >
          {kind === "work-section" ? (
            <FormField label="Section name" required>
              <Input name="name" placeholder="e.g. Flooring" required />
            </FormField>
          ) : (
            <>
              <FormField label="Company name" required>
                <Input
                  name="company_name"
                  placeholder="e.g. Gulf Horizon MEP LLC"
                  required
                />
              </FormField>
              <FormField
                label="Work category"
                helperText="Primary trade discipline or material specialty"
              >
                <Input
                  name="category"
                  placeholder="e.g. Flooring contractor"
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
   PEOPLE PANEL
   ========================================================================== */

function PeoplePanel({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<PersonData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    if (!canManage) return;
    try {
      setData(await api<PersonData>("/people"));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load people."
      );
    }
  };

  useEffect(() => {
    void load();
  }, [canManage]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/people", {
      method: "POST",
      body: JSON.stringify({
        full_name: form.get("full_name"),
        email: form.get("email"),
        temporary_password: form.get("temporary_password"),
        role_id: form.get("role_id"),
        project_ids: [],
      }),
    });
    setShowForm(false);
    setNotice("");
    await load();
  };

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Restricted module"
          title="People"
          description="Organisation directory and role-based access administration."
        />
        <EmptyState
          icon="lock"
          title="Restricted access"
          description="Your role does not include people administration permissions."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation access"
        title="People"
        description="Manage site engineers, QA inspectors, project managers, and role permissions."
        action={
          <Button icon="plus" onClick={() => setShowForm(true)}>
            Add person
          </Button>
        }
      />

      {notice && <ErrorBanner message={notice} onRetry={() => void load()} />}

      {!data ? (
        <Card noPadding>
          <TableSkeleton rows={4} cols={3} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Registered personnel"
              value={data.employees.length}
              subvalue="Active directory"
              icon="people"
            />
            <MetricCard
              label="Defined roles"
              value={data.roles.length}
              subvalue="Permission templates"
              icon="lock"
            />
            <MetricCard
              label="Assigned projects"
              value={data.projects.length}
              subvalue="Active workspaces"
              icon="building"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <Card noPadding className="lg:col-span-2">
              <CardHeader
                eyebrow="Personnel directory"
                title="Team members"
                subtitle="Authenticated employees and assigned employee codes"
              />
              {data.employees.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon="people"
                    title="No people are registered yet"
                    description="Create the first employee account to assign site responsibilities."
                    actionLabel="Add person"
                    onAction={() => setShowForm(true)}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Employee ID</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-sm">
                      {data.employees.map((person) => (
                        <tr
                          key={person.id}
                          className="transition-colors duration-fast hover:bg-surface-subtle"
                        >
                          <td className="py-3 px-4 font-medium text-ink">
                            {person.full_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-ink-secondary">
                            {person.employee_code}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge status={person.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card noPadding>
              <CardHeader
                eyebrow="Access control"
                title="Configured roles"
                subtitle="Standard role definitions"
              />
              <div className="divide-y divide-border-subtle">
                {data.roles.map((role) => (
                  <div key={role.id} className="px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-ink">
                      {role.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {role.description || "Role-scoped operational access"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {showForm && (
        <Modal
          onClose={() => setShowForm(false)}
          onSubmit={save}
          eyebrow="Organisation access"
          title="Add a person"
          description="Provision a role-scoped account for a site team member."
          submitLabel="Create account"
        >
          <FormField label="Full name" required>
            <Input
              name="full_name"
              placeholder="e.g. Tariq Al-Mansoor"
              required
            />
          </FormField>
          <FormField label="Work email" required>
            <Input
              name="email"
              type="email"
              placeholder="name@company.com"
              required
            />
          </FormField>
          <FormField
            label="Temporary password"
            required
            helperText="Minimum 12 characters required"
          >
            <Input
              name="temporary_password"
              type="password"
              minLength={12}
              required
            />
          </FormField>
          <FormField label="Role" required>
            <Select name="role_id" required defaultValue="">
              <option value="" disabled>
                Select a role
              </option>
              {data?.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormField>
        </Modal>
      )}
    </div>
  );
}

/* ==========================================================================
   DOCUMENTS PANEL
   ========================================================================== */

function DocumentsPanel() {
  const [items, setItems] = useState<
    {
      id: string;
      entity_type: string;
      mime_type: string;
      size_bytes: number;
      uploaded_at: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await api<{ items: typeof items }>(
        "/operations/documents"
      );
      setItems(response.items);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load documents."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Live document register"
        title="Documents"
        description="Drawings, submittals, inspection sign-offs, and compliance records linked to operational entities."
      />

      {notice && <ErrorBanner message={notice} onRetry={() => void load()} />}

      {loading ? (
        <Card noPadding>
          <TableSkeleton rows={4} cols={4} />
        </Card>
      ) : items.length > 0 ? (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4 text-right">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors duration-fast hover:bg-surface-subtle"
                  >
                    <td className="py-3 px-4 font-medium text-ink">
                      {formatLabel(item.entity_type)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-ink-secondary">
                      {item.mime_type}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-ink-secondary tabular-nums">
                      {Math.ceil(item.size_bytes / 1024)} KB
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-ink-muted text-right">
                      {item.uploaded_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon="documents"
          title="No documents are registered yet"
          description="Documents are attached to their villa, task, or vendor record to preserve their audit trail."
        />
      )}
    </div>
  );
}

/* ==========================================================================
   ADD VILLA MODAL
   ========================================================================== */

function AddVilla({
  project,
  close,
  done,
}: {
  project: Project;
  close: () => void;
  done: () => Promise<void>;
}) {
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/projects/${project.id}/villas`, {
      method: "POST",
      body: JSON.stringify({
        villa_number: form.get("villa_number"),
        block: form.get("block") || null,
        villa_type: form.get("villa_type") || null,
      }),
    });
    await done();
  };

  return (
    <Modal
      onClose={close}
      onSubmit={save}
      eyebrow={project.name}
      title="Add a villa"
      description="Register a new residential unit in the project operational schedule."
      submitLabel="Save villa"
    >
      <FormField label="Villa number" required>
        <Input name="villa_number" placeholder="e.g. V-106" required />
      </FormField>
      <FormField label="Block" helperText="Sector or cluster identifier">
        <Input name="block" placeholder="e.g. North Wing" />
      </FormField>
      <FormField label="Villa type" helperText="Architectural typology">
        <Input name="villa_type" placeholder="e.g. 5BR Signature" />
      </FormField>
    </Modal>
  );
}
