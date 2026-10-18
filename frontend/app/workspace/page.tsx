"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  buildDefaultVillaPhases,
  LocalVilla,
  reconcileVillaPhases,
  VillaPhaseConfig,
} from "@/lib/api";
import {
  AppRole,
  canRoleApproveRework,
  canRoleDoAnything,
  canRoleUploadVillaState,
  getStoredRole,
} from "@/lib/roles";
import BrandLogo from "@/components/brand-logo";
import WorkflowBoard from "@/components/workflow-board";
import { IntelligencePanel } from "@/components/project-intelligence";
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
  Textarea,
  ThemeToggle,
} from "@/components/ui";

type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
};

type Villa = LocalVilla;

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
  role_name?: string | null;
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
  const [role, setRole] = useState<AppRole | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [villas, setVillas] = useState<Villa[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [active, setActive] = useState<ActiveSection>("Dashboard");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [addingVilla, setAddingVilla] = useState(false);
  const [uploadingStateVilla, setUploadingStateVilla] = useState<Villa | null>(
    null
  );
  const [approvingReworkVilla, setApprovingReworkVilla] =
    useState<Villa | null>(null);
  const [editingPhasesVilla, setEditingPhasesVilla] = useState<Villa | null>(
    null
  );
  const [linkedWorkSectionFilter, setLinkedWorkSectionFilter] = useState<{
    villaId: string;
    phaseIndex: number | null;
  }>({ villaId: "", phaseIndex: null });
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
    const storedRole = getStoredRole();
    if (!storedRole) {
      router.replace("/");
      return;
    }
    setRole(storedRole);
    if (storedRole === "Engineer") {
      setActive("Villas");
    }
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (requestedSection && navItems.includes(requestedSection as NavItem)) {
      setActive(requestedSection as NavItem);
    }
    void load();
  }, [router]);

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
      return () =>
        document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [profileOpen]);

  if (!role || loading) return <WorkspaceLoader />;

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
  const backendPermissions = me?.permissions || [];
  const isDirector =
    backendPermissions.length > 0
      ? backendPermissions.includes("people.manage") &&
        backendPermissions.includes("project.write")
      : canRoleDoAnything(role);
  const canApproveRework =
    backendPermissions.length > 0
      ? backendPermissions.includes("rework.approve")
      : canRoleApproveRework(role);
  const canUploadState =
    backendPermissions.length > 0
      ? backendPermissions.includes("villa.state.upload")
      : canRoleUploadVillaState(role);
  const canAdd = isDirector;
  const profileName = me?.full_name || role;
  const initials = role.slice(0, 2).toUpperCase();

  const selectSection = (section: ActiveSection) => {
    setActive(section);
    setMobileMenuOpen(false);
    setProfileOpen(false);
  };

  const openVillaPhaseInWorkSections = (
    villaId: string,
    phaseIndex: number | null = null
  ) => {
    setLinkedWorkSectionFilter({ villaId, phaseIndex });
    selectSection("Work sections");
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
      {/* Desktop Sidebar */}
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
                <Badge
                  status={project.status}
                  className="text-[10px] px-1.5 py-0"
                />
              )}
            </div>
            <p className="mt-1 text-xs font-semibold text-white truncate">
              {project?.name || "No project"}
            </p>
            <p className="font-mono text-[11px] text-teal-300/85 truncate">
              {project?.project_code || "Operations"}
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
            <span className="truncate font-medium">{role}</span>
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
                  {project?.project_code || "Operations"}
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
                Operations
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
            <Badge variant="accent" dot mono>
              {role}
            </Badge>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/")}
            >
              Switch role
            </Button>

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
                    {role}
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
                        Role: {role}
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
                    <Icon
                      name="arrow-right"
                      className="h-3.5 w-3.5 text-ink-muted"
                    />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => router.push("/")}
                    className="w-full flex items-center justify-between rounded-control px-2.5 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-muted hover:text-ink transition-colors duration-fast focus-ring"
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        name="log-out"
                        className="h-3.5 w-3.5 text-ink-muted"
                      />
                      <span>Change role (Starter page)</span>
                    </span>
                    <Icon
                      name="arrow-right"
                      className="h-3.5 w-3.5 text-ink-muted"
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 w-full px-4 py-6 sm:px-6 lg:px-8 pb-20 lg:pb-10">
          {active === "Dashboard" ? (
            <div className="space-y-6">
              {project && <IntelligencePanel surface="dashboard" projectId={project.id} projectName={project.name} villas={villas} />}
              <Dashboard
                project={project}
                villas={villas}
                tasks={tasks}
                onVillas={() => selectSection("Villas")}
                onWorkSections={() => selectSection("Work sections")}
                onAdd={() => setAddingVilla(true)}
                canAdd={canAdd}
                canApproveRework={canApproveRework}
                onApproveRework={(villa) => setApprovingReworkVilla(villa)}
              />
            </div>
          ) : active === "Villas" ? (
            <Villas
              villas={villas}
              tasks={tasks}
              onAdd={() => setAddingVilla(true)}
              canAdd={canAdd}
              canUploadState={canUploadState}
              canApproveRework={canApproveRework}
              onUploadState={(villa) =>
                setUploadingStateVilla(villa || villas[0] || null)
              }
              onApproveRework={(villa) => setApprovingReworkVilla(villa)}
              onEditPhases={(villa) => setEditingPhasesVilla(villa)}
              onOpenWorkSection={openVillaPhaseInWorkSections}
            />
          ) : active === "Work sections" ? (
            <div className="space-y-8">
              <WorkflowBoard
                projects={projects}
                canEdit={canUploadState}
                canApproveRework={canApproveRework}
                initialVillaId={linkedWorkSectionFilter.villaId}
                initialPhaseFilter={linkedWorkSectionFilter.phaseIndex}
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
              projectName={project?.name}
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
            [
              "Dashboard",
              "Today",
              "Villas",
              "Work sections",
              "Quality",
            ] as NavItem[]
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

      {/* Add Villa Modal (Director) */}
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

      {/* Upload Villa State Modal (Engineer & Director in Operations / Villas) */}
      {uploadingStateVilla && (
        <UploadVillaStateModal
          villas={villas}
          initialVilla={uploadingStateVilla}
          close={() => setUploadingStateVilla(null)}
          done={async () => {
            setUploadingStateVilla(null);
            await load();
          }}
        />
      )}

      {/* Approve Rework Modal (Manager & Director) */}
      {approvingReworkVilla && (
        <ApproveReworkModal
          villa={approvingReworkVilla}
          close={() => setApprovingReworkVilla(null)}
          done={async () => {
            setApprovingReworkVilla(null);
            await load();
          }}
        />
      )}

      {/* Edit Villa & Phases Modal (Linked to Work Sections Page) */}
      {editingPhasesVilla && (
        <EditVillaPhasesModal
          villa={editingPhasesVilla}
          close={() => setEditingPhasesVilla(null)}
          done={async (openInWorkSections) => {
            const targetVillaId = editingPhasesVilla.id;
            setEditingPhasesVilla(null);
            await load();
            if (openInWorkSections) {
              openVillaPhaseInWorkSections(targetVillaId, null);
            }
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
  canApproveRework,
  onApproveRework,
}: {
  project?: Project;
  villas: Villa[];
  tasks: Task[];
  onVillas: () => void;
  onWorkSections: () => void;
  onAdd: () => void;
  canAdd: boolean;
  canApproveRework: boolean;
  onApproveRework: (villa: Villa) => void;
}) {
  const reworkVillas = villas.filter((v) => v.status === "REWORK_REQUIRED");
  const completedTasks = tasks.filter(
    (t) => String(t.status).toUpperCase() === "COMPLETED"
  ).length;
  const avgProgress = villas.length
    ? Math.round(
        villas.reduce((acc, item) => acc + (Number(item.progress) || 0), 0) /
          villas.length
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Construction control room"
        title={project?.name || "Start your first project"}
        description="Track every villa, work package, responsibility, and rework approval from one operational record."
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
          subvalue="Across mapped villas"
          icon="reports"
        />
        <MetricCard
          label="Rework required"
          value={reworkVillas.length}
          subvalue={
            reworkVillas.length
              ? "Awaiting rework approval"
              : "All units clear"
          }
          badge={
            <Badge variant={reworkVillas.length ? "danger" : "success"}>
              {reworkVillas.length ? "Action needed" : "Clear"}
            </Badge>
          }
        />
      </div>

      {/* Rework Queue Card on Dashboard when rework items exist */}
      {reworkVillas.length > 0 && (
        <Card className="border-danger-border bg-danger-bg/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon
                name="alert-triangle"
                className="h-4 w-4 text-danger-text"
              />
              <h2 className="text-sm font-semibold text-ink">
                Villas awaiting rework approval ({reworkVillas.length})
              </h2>
            </div>
            <Button variant="secondary" size="sm" onClick={onVillas}>
              Open Operations / Villas
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reworkVillas.map((rv) => (
              <div
                key={rv.id}
                className="rounded-control border border-border bg-surface p-3.5 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink">
                      Villa {rv.villa_number}
                    </span>
                    <Badge status="REWORK_REQUIRED" />
                  </div>
                  <p className="font-mono text-xs text-accent-text">
                    {rv.work_section}
                  </p>
                  <p className="text-xs text-ink-secondary line-clamp-2">
                    {rv.state_note}
                  </p>
                </div>
                {canApproveRework && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    onClick={() => onApproveRework(rv)}
                  >
                    Approve rework
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

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
                    <th className="py-2.5 px-4">Active Phase / Section</th>
                    <th className="py-2.5 px-4 w-40">Progress</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-sm">
                  {villas.map((villa) => (
                    <tr
                      key={villa.id}
                      onClick={onVillas}
                      className="cursor-pointer transition-colors duration-fast hover:bg-surface-subtle"
                    >
                      <td className="py-3 px-4 font-medium text-ink">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] border border-accent-border bg-accent-subtle font-mono text-[11px] font-semibold text-accent-text">
                            {villa.villa_number
                              .replace(/\D+/g, "")
                              .slice(-2) || "V"}
                          </span>
                          <span>Villa {villa.villa_number}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-ink-secondary">
                        {villa.block || "No block"}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-secondary">
                        {villa.work_section || villa.villa_type || "Active"}
                      </td>
                      <td className="py-3 px-4">
                        <ProgressBar value={villa.progress || 0} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge status={villa.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
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
   OPERATIONS / VILLAS VIEW
   ========================================================================== */

function Villas({
  villas,
  tasks,
  onAdd,
  canAdd,
  canUploadState,
  canApproveRework,
  onUploadState,
  onApproveRework,
  onEditPhases,
  onOpenWorkSection,
}: {
  villas: Villa[];
  tasks: Task[];
  onAdd: () => void;
  canAdd: boolean;
  canUploadState: boolean;
  canApproveRework: boolean;
  onUploadState: (villa?: Villa) => void;
  onApproveRework: (villa: Villa) => void;
  onEditPhases: (villa: Villa) => void;
  onOpenWorkSection: (villaId: string, phaseIndex: number | null) => void;
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
        (v.villa_type || "").toLowerCase().includes(q) ||
        (v.work_section || "").toLowerCase().includes(q) ||
        (v.state_note || "").toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [villas, query, statusFilter]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          villas.map((v) => String(v.status).toUpperCase()).filter(Boolean)
        )
      ),
    [villas]
  );

  const reworkVillas = useMemo(
    () => villas.filter((v) => v.status === "REWORK_REQUIRED"),
    [villas]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations / Villas"
        title="All villas"
        description="Upload live villa states, edit villa phases linked to Work sections, and approve rework."
        secondaryAction={
          canUploadState && villas.length > 0 ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => onUploadState(villas[0])}
            >
              Upload villa state
            </Button>
          ) : undefined
        }
        action={
          canAdd ? (
            <Button variant="secondary" icon="plus" onClick={onAdd}>
              Add villa
            </Button>
          ) : undefined
        }
      />

      {/* Pending Rework Approval Banner for Manager & Director */}
      {reworkVillas.length > 0 && (
        <Card className="border-danger-border bg-danger-bg/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon
                name="alert-triangle"
                className="h-4 w-4 text-danger-text"
              />
              <span className="text-sm font-semibold text-ink">
                Rework approval queue ({reworkVillas.length}{" "}
                {reworkVillas.length === 1 ? "villa" : "villas"})
              </span>
            </div>
            <Badge variant="danger">
              {canApproveRework
                ? "Ready for your rework approval"
                : "Awaiting Manager / Director approval"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reworkVillas.map((rv) => (
              <div
                key={rv.id}
                className="rounded-control border border-border bg-surface p-3.5 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink">
                      Villa {rv.villa_number}
                    </span>
                    <span className="font-mono text-xs text-accent-text">
                      · {rv.work_section}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {rv.state_note}
                  </p>
                </div>
                {canApproveRework && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    onClick={() => onApproveRework(rv)}
                  >
                    Approve rework
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon
            name="search"
            className="h-4 w-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Filter by villa number, block, phase, or note…"
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
            className="w-48"
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
                  <th className="py-3 px-4 whitespace-nowrap">Villa & Block</th>
                  <th className="py-3 px-4">Linked Phases</th>
                  <th className="py-3 px-4">Latest State & Field Note</th>
                  <th className="py-3 px-4 w-36">Completion</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-sm">
                {filteredVillas.map((villa) => {
                  const unitTasks = tasks.filter(
                    (t) => t.villa_id === villa.id
                  );
                  const progress =
                    villa.progress !== undefined
                      ? villa.progress
                      : unitTasks.length
                      ? Math.round(
                          unitTasks.reduce(
                            (acc, item) => acc + (Number(item.progress) || 0),
                            0
                          ) / unitTasks.length
                        )
                      : 0;
                  const villaPhases =
                    villa.phases && villa.phases.length > 0
                      ? villa.phases
                      : buildDefaultVillaPhases();
                  const visiblePhases = villaPhases.slice(0, 3);
                  const hiddenCount = Math.max(
                    0,
                    villaPhases.length - visiblePhases.length
                  );

                  return (
                    <tr
                      key={villa.id}
                      className="transition-colors duration-fast hover:bg-surface-subtle/60 align-middle"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-ink">
                          Villa {villa.villa_number}
                        </div>
                        <div className="font-mono text-xs text-ink-secondary mt-0.5">
                          {villa.block || "Block A"}
                        </div>
                        <div className="text-xs text-ink-muted">
                          {villa.villa_type || "Standard Villa"}
                        </div>
                      </td>

                      {/* Linked Phases column */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {visiblePhases.map((ph, idx) => (
                            <button
                              key={`${ph.name}-${idx}`}
                              type="button"
                              title={`Open "${ph.name}" in Work sections (${ph.plannedDays}d, Days ${ph.startDay}–${ph.endDay}, ${
                                ph.allowParallel ? "Parallel" : "Sequential"
                              })`}
                              onClick={() =>
                                onOpenWorkSection(villa.id, ph.phaseIndex)
                              }
                              className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-mono text-ink-secondary hover:border-accent-border hover:bg-accent-subtle hover:text-accent-text transition-colors"
                            >
                              <span className="font-semibold text-ink">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span className="truncate max-w-[115px]">
                                {ph.name}
                              </span>
                              <span className="text-[10px] text-ink-muted">
                                {ph.plannedDays}d
                              </span>
                            </button>
                          ))}
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() => onEditPhases(villa)}
                              className="inline-flex items-center rounded-[6px] border border-accent-border bg-accent-subtle px-2 py-0.5 text-[11px] font-mono font-medium text-accent-text hover:opacity-90 transition-opacity"
                            >
                              +{hiddenCount} more
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEditPhases(villa)}
                            className="font-mono text-[11px] font-medium text-accent-text hover:underline"
                          >
                            Edit phases ({villaPhases.length})
                          </button>
                          <span className="text-ink-muted">·</span>
                          <button
                            type="button"
                            onClick={() => onOpenWorkSection(villa.id, null)}
                            className="font-mono text-[11px] text-ink-secondary hover:text-ink hover:underline"
                          >
                            Work sections →
                          </button>
                        </div>
                      </td>

                      {/* Latest Uploaded State & Field Note */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-mono text-xs font-semibold text-accent-text truncate">
                          {villa.work_section || "Services & waterproofing"}
                        </div>
                        <p className="text-xs text-ink-secondary mt-0.5 line-clamp-2 leading-relaxed">
                          {villa.state_note || "No field state uploaded yet."}
                        </p>
                        {(villa.evidence_file || villa.rework_approved_by) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-ink-muted">
                            {villa.evidence_file && (
                              <span className="rounded bg-surface-subtle border border-border px-1.5 py-0.5 text-ink-secondary">
                                {villa.evidence_file}
                              </span>
                            )}
                            {villa.rework_approved_by && (
                              <span className="rounded bg-success-bg border border-success-border px-1.5 py-0.5 text-success-text">
                                Approved by {villa.rework_approved_by}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <ProgressBar value={progress} />
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge status={villa.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="sliders"
                            onClick={() => onEditPhases(villa)}
                          >
                            Phases
                          </Button>

                          {canUploadState && (
                            <Button
                              variant="primary"
                              size="sm"
                              icon="plus"
                              onClick={() => onUploadState(villa)}
                            >
                              Upload state
                            </Button>
                          )}

                          {canApproveRework &&
                            villa.status === "REWORK_REQUIRED" && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon="check"
                                onClick={() => onApproveRework(villa)}
                              >
                                Approve rework
                              </Button>
                            )}
                        </div>
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
   UPLOAD VILLA STATE MODAL (Engineer & Director in Operations / Villas)
   ========================================================================== */

function UploadVillaStateModal({
  villas,
  initialVilla,
  close,
  done,
}: {
  villas: Villa[];
  initialVilla: Villa;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [selectedVillaId, setSelectedVillaId] = useState(initialVilla.id);
  const currentVilla =
    villas.find((v) => v.id === selectedVillaId) || initialVilla;
  const availablePhases =
    currentVilla.phases && currentVilla.phases.length > 0
      ? currentVilla.phases
      : buildDefaultVillaPhases();

  const [status, setStatus] = useState(currentVilla.status || "IN_PROGRESS");
  const [progress, setProgress] = useState(currentVilla.progress ?? 50);
  const [workSection, setWorkSection] = useState(
    currentVilla.work_section || availablePhases[0]?.name || "Services & waterproofing"
  );
  const [note, setNote] = useState("");
  const [evidenceFile, setEvidenceFile] = useState("");
  const [saving, setSaving] = useState(false);

  const handleVillaChange = (id: string) => {
    setSelectedVillaId(id);
    const found = villas.find((v) => v.id === id);
    if (found) {
      setStatus(found.status || "IN_PROGRESS");
      setProgress(found.progress ?? 50);
      setWorkSection(
        found.work_section ||
          found.phases?.[0]?.name ||
          "Services & waterproofing"
      );
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api(`/villas/${selectedVillaId}/state`, {
        method: "POST",
        body: JSON.stringify({
          status,
          progress:
            status === "COMPLETED"
              ? 100
              : status === "NOT_STARTED"
              ? 0
              : progress,
          work_section: workSection,
          note,
          evidence_file: evidenceFile || null,
        }),
      });
      await done();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={close}
      onSubmit={save}
      eyebrow="Operations / Villas · Field State Upload"
      title={`Upload state for Villa ${currentVilla.villa_number}`}
      description="Record the current operational state, completion percentage, active phase, and site inspection notes."
      submitLabel={saving ? "Uploading state…" : "Upload villa state"}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Villa" htmlFor="upload-villa-select" required>
          <Select
            id="upload-villa-select"
            value={selectedVillaId}
            onChange={(e) => handleVillaChange(e.target.value)}
          >
            {villas.map((v) => (
              <option key={v.id} value={v.id}>
                Villa {v.villa_number} ({v.block})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Linked Phase / Work Section"
          htmlFor="upload-phase-select"
          required
        >
          <Select
            id="upload-phase-select"
            value={workSection}
            onChange={(e) => setWorkSection(e.target.value)}
          >
            {availablePhases.map((p, idx) => (
              <option key={`${p.name}-${idx}`} value={p.name}>
                {String(idx + 1).padStart(2, "0")} · {p.name} ({p.plannedDays}d)
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Operational state"
          htmlFor="upload-status-select"
          required
        >
          <Select
            id="upload-status-select"
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              if (next === "COMPLETED") setProgress(100);
              else if (next === "NOT_STARTED") setProgress(0);
            }}
          >
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="REWORK_REQUIRED">
              Rework required (Flags Manager approval)
            </option>
            <option value="NOT_STARTED">Not started</option>
          </Select>
        </FormField>

        <FormField
          label="Completion (%)"
          htmlFor="upload-progress-input"
          required
        >
          <Input
            id="upload-progress-input"
            type="number"
            min={0}
            max={status === "COMPLETED" ? 100 : 99}
            value={
              status === "COMPLETED"
                ? 100
                : status === "NOT_STARTED"
                ? 0
                : progress
            }
            disabled={status === "COMPLETED" || status === "NOT_STARTED"}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="font-mono"
            required
          />
        </FormField>
      </div>

      <FormField
        label={
          status === "REWORK_REQUIRED"
            ? "Rework defect & rectification note"
            : "Site state note"
        }
        htmlFor="upload-state-note"
        required
      >
        <Textarea
          id="upload-state-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe current field progress, quality inspection observations, or reason for rework…"
          required
        />
      </FormField>

      <FormField
        label="Attach field evidence / state document (optional)"
        htmlFor="upload-evidence-file"
        helperText="Attach a site photo, QA checklist, or test report."
      >
        <Input
          id="upload-evidence-file"
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setEvidenceFile(file ? file.name : "");
          }}
        />
      </FormField>
    </Modal>
  );
}

/* ==========================================================================
   APPROVE REWORK MODAL (Manager & Director)
   ========================================================================== */

function ApproveReworkModal({
  villa,
  close,
  done,
}: {
  villa: Villa;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [nextStatus, setNextStatus] = useState<"IN_PROGRESS" | "COMPLETED">(
    "IN_PROGRESS"
  );
  const [progress, setProgress] = useState(Math.max(villa.progress || 50, 70));
  const [note, setNote] = useState(
    "Rectification verified on site. Rework approved and quality hold cleared."
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api(`/villas/${villa.id}/approve-rework`, {
      method: "POST",
      body: JSON.stringify({
        next_status: nextStatus,
        progress: nextStatus === "COMPLETED" ? 100 : progress,
        note,
      }),
    });
    await done();
  };

  return (
    <Modal
      onClose={close}
      onSubmit={save}
      eyebrow="Quality Gate · Rework Approval"
      title={`Approve rework for Villa ${villa.villa_number}`}
      description="Verify the field team's rectification and clear the rework hold."
      submitLabel="Approve rework"
    >
      <div className="rounded-control border border-danger-border bg-danger-bg p-3.5 space-y-1 text-xs">
        <div className="font-mono font-semibold text-danger-text uppercase tracking-wider">
          Reported Rework ({villa.work_section})
        </div>
        <p className="text-ink-secondary leading-relaxed">{villa.state_note}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Post-approval villa status"
          htmlFor="rework-next-status"
          required
        >
          <Select
            id="rework-next-status"
            value={nextStatus}
            onChange={(e) => {
              const val = e.target.value as "IN_PROGRESS" | "COMPLETED";
              setNextStatus(val);
              if (val === "COMPLETED") setProgress(100);
            }}
          >
            <option value="IN_PROGRESS">
              In progress (Cleared to continue)
            </option>
            <option value="COMPLETED">Completed (100% verified)</option>
          </Select>
        </FormField>

        <FormField
          label="Updated completion (%)"
          htmlFor="rework-progress"
          required
        >
          <Input
            id="rework-progress"
            type="number"
            min={1}
            max={100}
            value={nextStatus === "COMPLETED" ? 100 : progress}
            disabled={nextStatus === "COMPLETED"}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="font-mono"
            required
          />
        </FormField>
      </div>

      <FormField
        label="Manager approval sign-off note"
        htmlFor="rework-approval-note"
        required
      >
        <Textarea
          id="rework-approval-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
        />
      </FormField>
    </Modal>
  );
}

/* ==========================================================================
   EDIT VILLA & PHASES MODAL (Linked to Work Sections Page)
   ========================================================================== */

function EditVillaPhasesModal({
  villa,
  close,
  done,
}: {
  villa: Villa;
  close: () => void;
  done: (openInWorkSections: boolean) => Promise<void>;
}) {
  const [villaNumber, setVillaNumber] = useState(villa.villa_number);
  const [block, setBlock] = useState(villa.block || "");
  const [villaType, setVillaType] = useState(villa.villa_type || "");
  const [phases, setPhases] = useState<VillaPhaseConfig[]>(() =>
    reconcileVillaPhases(
      villa.phases && villa.phases.length > 0
        ? villa.phases
        : buildDefaultVillaPhases()
    )
  );
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseDays, setNewPhaseDays] = useState(14);
  const [newPhaseStart, setNewPhaseStart] = useState(60);
  const [newPhaseParallel, setNewPhaseParallel] = useState(true);
  const [openAfterSave, setOpenAfterSave] = useState(false);

  const updatePhaseField = (
    idx: number,
    patch: Partial<VillaPhaseConfig>
  ) => {
    setPhases((prev) => {
      const updated = prev.map((item, i) =>
        i === idx ? { ...item, ...patch } : item
      );
      return reconcileVillaPhases(updated);
    });
  };

  const removePhase = (idx: number) => {
    if (phases.length <= 1) return;
    setPhases((prev) =>
      reconcileVillaPhases(prev.filter((_, i) => i !== idx))
    );
  };

  const handleAddPhase = () => {
    const trimmed = newPhaseName.trim();
    if (!trimmed) return;
    const nextIdx = phases.length;
    const added: VillaPhaseConfig = {
      phaseIndex: nextIdx,
      name: trimmed,
      plannedDays: Math.max(1, Number(newPhaseDays) || 10),
      startDay: Math.max(1, Number(newPhaseStart) || 1),
      endDay:
        Math.max(1, Number(newPhaseStart) || 1) +
        Math.max(1, Number(newPhaseDays) || 10) -
        1,
      allowParallel: newPhaseParallel,
      status: "NOT_STARTED",
    };
    setPhases((prev) => reconcileVillaPhases([...prev, added]));
    setNewPhaseName("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const finalPhases = newPhaseName.trim()
      ? reconcileVillaPhases([
          ...phases,
          {
            phaseIndex: phases.length,
            name: newPhaseName.trim(),
            plannedDays: Math.max(1, Number(newPhaseDays) || 10),
            startDay: Math.max(1, Number(newPhaseStart) || 1),
            endDay:
              Math.max(1, Number(newPhaseStart) || 1) +
              Math.max(1, Number(newPhaseDays) || 10) -
              1,
            allowParallel: newPhaseParallel,
            status: "NOT_STARTED",
          },
        ])
      : phases;

    await api(`/villas/${villa.id}/edit`, {
      method: "POST",
      body: JSON.stringify({
        villa_number: villaNumber,
        block,
        villa_type: villaType,
        phases: finalPhases,
      }),
    });
    await done(openAfterSave);
  };

  return (
    <Modal
      onClose={close}
      onSubmit={save}
      eyebrow={`Villa ${villa.villa_number} · Linked to Work Sections`}
      title="Edit villa & finishing phases"
      description="Configure phases for this villa. Parallel phases can overlap concurrently; sequential phases auto-shift so there are never any day conflicts."
      submitLabel={
        openAfterSave
          ? "Save & open Work sections"
          : "Save villa & phases"
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Villa number" required>
          <Input
            value={villaNumber}
            onChange={(e) => setVillaNumber(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Block">
          <Input value={block} onChange={(e) => setBlock(e.target.value)} />
        </FormField>
        <FormField label="Villa type">
          <Input
            value={villaType}
            onChange={(e) => setVillaType(e.target.value)}
          />
        </FormField>
      </div>

      {/* Configured Phases Table */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink">
            Assigned Villa Phases ({phases.length} · 0 duration conflicts)
          </span>
          <Badge variant="success" dot={false} mono>
            End Day = Start + Days - 1
          </Badge>
        </div>

        <div className="max-h-60 overflow-y-auto rounded-control border border-border divide-y divide-border-subtle bg-surface-subtle/50">
          {phases.map((ph, idx) => (
            <div
              key={`${ph.name}-${idx}`}
              className="p-3 flex flex-col gap-2 text-xs bg-surface"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold text-accent-text">
                    #{String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="font-semibold text-ink truncate">
                    {ph.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-ink-secondary bg-surface-subtle border border-border px-1.5 py-0.5 rounded">
                    Day {ph.startDay}–{ph.endDay} ({ph.plannedDays}d)
                  </span>
                  {phases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhase(idx)}
                      className="text-ink-muted hover:text-danger-text"
                      title="Remove phase"
                    >
                      <Icon name="x" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <div>
                  <label className="block text-[10px] font-mono text-ink-muted mb-0.5">
                    Start Day
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={150}
                    value={ph.startDay}
                    onChange={(e) =>
                      updatePhaseField(idx, {
                        startDay: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-ink-muted mb-0.5">
                    Duration (Days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={ph.plannedDays}
                    onChange={(e) =>
                      updatePhaseField(idx, {
                        plannedDays: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-ink-muted mb-0.5">
                    Overlap Mode
                  </label>
                  <Select
                    value={ph.allowParallel ? "PARALLEL" : "SEQUENTIAL"}
                    onChange={(e) =>
                      updatePhaseField(idx, {
                        allowParallel: e.target.value === "PARALLEL",
                      })
                    }
                    className="h-7 text-xs"
                  >
                    <option value="PARALLEL">Parallel allowed</option>
                    <option value="SEQUENTIAL">Sequential (no overlap)</option>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Phase Linked to Work Sections */}
      <div className="rounded-control border border-accent-border bg-accent-subtle/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-text">
            Add a phase (Syncs to Work sections page)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <Input
              placeholder="New phase name (e.g. Smart Home & Automation)"
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={1}
              max={90}
              value={newPhaseDays}
              onChange={(e) => setNewPhaseDays(Number(e.target.value) || 7)}
              title="Planned duration in days"
              placeholder="Days"
              className="font-mono"
            />
            <Input
              type="number"
              min={1}
              max={150}
              value={newPhaseStart}
              onChange={(e) => setNewPhaseStart(Number(e.target.value) || 1)}
              title="Start day"
              placeholder="Start"
              className="font-mono"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={newPhaseParallel}
              onChange={(e) => setNewPhaseParallel(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-accent"
            />
            <span>Can overlap & run in parallel with other phases</span>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={handleAddPhase}
          >
            Add phase to list
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={openAfterSave}
          onChange={(e) => setOpenAfterSave(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border text-accent"
        />
        <span>
          Open this villa in the <strong>Work sections</strong> page after
          saving
        </span>
      </label>
    </Modal>
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
          description="Only the Director role includes people administration permissions."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation access"
        title="People"
        description="Manage site engineers, project managers, directors, and role permissions."
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
   ADD VILLA MODAL (Director)
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
        <Input name="villa_number" placeholder="e.g. V-107" required />
      </FormField>
      <FormField label="Block" helperText="Sector or cluster identifier">
        <Input name="block" placeholder="e.g. Block B · South" />
      </FormField>
      <FormField label="Villa type" helperText="Architectural typology">
        <Input name="villa_type" placeholder="e.g. Type B · 5BR Signature" />
      </FormField>
    </Modal>
  );
}
