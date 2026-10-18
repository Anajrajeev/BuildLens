import { IconName } from "@/components/ui";

export type AppRole = "Director" | "Manager" | "Engineer";

export const ROLE_STORAGE_KEY = "buildlens-active-role";

export type RoleStarterDefinition = {
  id: AppRole;
  title: string;
  code: string;
  badge: string;
  icon: IconName;
  tagline: string;
  description: string;
  capabilities: string[];
  primaryScope: string;
  employeeCode: string;
  email: string;
  fullName: string;
  permissions: string[];
};

export const ROLE_DEFINITIONS: Record<AppRole, RoleStarterDefinition> = {
  Director: {
    id: "Director",
    title: "Director",
    code: "ROLE 01 · EXECUTIVE",
    badge: "Full Access",
    icon: "building",
    tagline: "Can do anything and see anything across the entire platform.",
    description:
      "Unrestricted executive command across every construction module, villa register, schedule, quality gate, and team directory.",
    capabilities: [
      "View and manage every operational module across the workspace",
      "Register new villas, configure finishing phases, and override field states",
      "Approve rework holds and administer personnel, roles, and vendors",
    ],
    primaryScope: "All Modules & Full Authority",
    employeeCode: "DIR-001",
    email: "director@buildlens.io",
    fullName: "Executive Director",
    permissions: [
      "project.read",
      "project.write",
      "villa.read.all",
      "villa.write",
      "villa.state.upload",
      "rework.approve",
      "task.read",
      "task.write",
      "quality.manage",
      "people.manage",
      "vendor.manage",
      "handover.manage",
    ],
  },
  Manager: {
    id: "Manager",
    title: "Manager",
    code: "ROLE 02 · MANAGEMENT",
    badge: "Rework Approval",
    icon: "quality",
    tagline: "Reviews flagged defects and approves rework across villas.",
    description:
      "Supervises construction quality gates and schedule remediation, with authority to inspect and formally approve rework.",
    capabilities: [
      "Inspect villas and work activities flagged as Rework Required",
      "Verify site rectification notes and formally approve rework to clear holds",
      "Monitor project dashboards, villa completion roll-ups, and quality reports",
    ],
    primaryScope: "Rework Approval & Quality Gates",
    employeeCode: "MGR-104",
    email: "manager@buildlens.io",
    fullName: "Project Manager",
    permissions: [
      "project.read",
      "villa.read.all",
      "rework.approve",
      "task.read",
      "quality.manage",
    ],
  },
  Engineer: {
    id: "Engineer",
    title: "Engineer",
    code: "ROLE 03 · FIELD OPS",
    badge: "State Uploads",
    icon: "villas",
    tagline: "Uploads live villa states and progress in the Operations / Villas page.",
    description:
      "Field execution specialist responsible for recording on-site unit progress, uploading villa states, and logging field observations.",
    capabilities: [
      "Upload live villa states (In Progress, Completed, Blocked, Rework Required) in Villas",
      "Record unit completion percentages, active phases, and inspection evidence",
      "Flag defects requiring rework for Manager or Director approval",
    ],
    primaryScope: "Operations / Villas State Uploads",
    employeeCode: "ENG-208",
    email: "engineer@buildlens.io",
    fullName: "Site Engineer",
    permissions: [
      "project.read",
      "villa.read.all",
      "villa.state.upload",
      "task.read",
      "task.write",
    ],
  },
};

export const ROLE_ORDER: AppRole[] = ["Director", "Manager", "Engineer"];

export function isValidRole(value: unknown): value is AppRole {
  return value === "Director" || value === "Manager" || value === "Engineer";
}

export function getStoredRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return isValidRole(raw) ? raw : null;
}

export function setStoredRole(role: AppRole): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
}

export function clearStoredRole(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
}

export function canRoleDoAnything(role: AppRole): boolean {
  return role === "Director";
}

export function canRoleApproveRework(role: AppRole): boolean {
  return role === "Director" || role === "Manager";
}

export function canRoleUploadVillaState(role: AppRole): boolean {
  return role === "Director" || role === "Engineer";
}
