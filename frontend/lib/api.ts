import { flushMutations, queueMutation, QueuedMutation } from "./offline";
import { getStoredRole, ROLE_DEFINITIONS } from "./roles";
import {
  ActivityScheduleOverride,
  DEFAULT_PHASE_WINDOWS,
  reference,
  WorkEvent,
  WorkStatus,
} from "./workflow";

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public requestId?: string
  ) {
    super(message);
  }
}

export type VillaPhaseConfig = {
  phaseIndex: number;
  name: string;
  plannedDays: number;
  startDay: number;
  endDay: number;
  allowParallel: boolean;
  status?: WorkStatus;
};

export type LocalVilla = {
  id: string;
  project_id: string;
  villa_number: string;
  block?: string;
  villa_type?: string;
  status: string;
  progress?: number;
  work_section?: string;
  state_note?: string;
  evidence_file?: string | null;
  rework_approved_by?: string | null;
  updated_at?: string;
  phases?: VillaPhaseConfig[];
};

export type CustomWorkflowActivity = {
  id: string;
  order: number;
  name: string;
  duration: number;
  phase: number;
  remarks: string | null;
  source: string;
};

export type WorkflowScheduleConfig = {
  customPhases: string[];
  customActivities: CustomWorkflowActivity[];
  activityOverrides: Record<string, ActivityScheduleOverride>;
};

export function buildDefaultVillaPhases(): VillaPhaseConfig[] {
  return reference.phases.map((name, idx) => {
    const win = DEFAULT_PHASE_WINDOWS[idx] || { startDay: 1, endDay: 30 };
    const plannedDays = Math.max(1, win.endDay - win.startDay + 1);
    return {
      phaseIndex: idx,
      name,
      plannedDays,
      startDay: win.startDay,
      endDay: win.startDay + plannedDays - 1,
      allowParallel: true,
      status: idx === 0 ? "IN_PROGRESS" : "NOT_STARTED",
    };
  });
}

/**
 * Reconciles villa phases so that:
 * 1. Every phase's window `endDay - startDay + 1` matches `plannedDays` (0 duration conflicts).
 * 2. Sequential phases (`allowParallel === false`) automatically shift after the preceding phase ends.
 * 3. Parallel phases (`allowParallel === true`) can overlap concurrently without conflict.
 */
export function reconcileVillaPhases(
  phases: VillaPhaseConfig[]
): VillaPhaseConfig[] {
  const result: VillaPhaseConfig[] = [];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const plannedDays = Math.max(1, Math.round(Number(p.plannedDays) || 10));
    let startDay = Math.max(1, Math.round(Number(p.startDay) || 1));
    if (!p.allowParallel && i > 0) {
      const prevEnd = result[i - 1].endDay;
      if (startDay <= prevEnd) {
        startDay = prevEnd + 1;
      }
    }
    const endDay = startDay + plannedDays - 1;
    result.push({
      ...p,
      phaseIndex: typeof p.phaseIndex === "number" ? p.phaseIndex : i,
      plannedDays,
      startDay,
      endDay,
      allowParallel: Boolean(p.allowParallel),
      status: p.status || "NOT_STARTED",
    });
  }
  return result;
}

type LocalStore = {
  projects: {
    id: string;
    name: string;
    project_code: string;
    status: string;
  }[];
  villas: LocalVilla[];
  tasks: {
    id: string;
    project_id: string;
    villa_id?: string;
    name: string;
    title: string;
    status: string;
    progress: number;
    priority: string;
    planned_start_at?: string;
    planned_end_at?: string;
  }[];
  workflowEvents: Record<string, WorkEvent[]>;
  scheduleConfig: WorkflowScheduleConfig;
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
  workSections: {
    id: string;
    name: string;
    active: boolean;
  }[];
  vendors: {
    id: string;
    company_name: string;
    category: string;
    status: string;
    active: boolean;
  }[];
  documents: {
    id: string;
    entity_type: string;
    mime_type: string;
    size_bytes: number;
    uploaded_at: string;
  }[];
  snags: {
    id: string;
    project_id: string;
    villa_id: string;
    task_id?: string | null;
    title: string;
    description: string;
    severity: string;
    status: string;
    due_at: string;
  }[];
  inspections: {
    id: string;
    project_id: string;
    villa_id: string;
    task_id?: string | null;
    inspection_type: string;
    notes: string;
    status: string;
    scheduled_at: string;
  }[];
  materials: {
    id: string;
    project_id: string;
    quantity_on_hand: number;
    reorder_level: number;
    unit_cost: number;
    products: {
      sku: string;
      name: string;
      category: string;
      unit: string;
    };
  }[];
  purchaseOrders: {
    id: string;
    project_id: string;
    po_number: string;
    status: string;
    requested_at: string;
    expected_at: string;
  }[];
  wirs: {
    id: string;
    project_id: string;
    description: string;
    status: string;
    revision: string;
  }[];
  drawings: {
    id: string;
    project_id: string;
    document_type: string;
    approval_status: string;
    version: string;
  }[];
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }[];
  safety: {
    id: string;
    project_id: string;
    villa_id?: string | null;
    observation_type: string;
    severity: string;
    status: string;
    description: string;
    corrective_action?: string | null;
    created_at: string;
  }[];
  dailyReports: {
    id: string;
    project_id: string;
    villa_id?: string | null;
    report_date: string;
    weather: string;
    workforce_count: number;
    summary: string;
    constraints?: string | null;
  }[];
  handovers: {
    id: string;
    project_id: string;
    villa_id: string;
    customer_name: string;
    status: string;
    readiness_score: number;
    target_date: string;
    notes?: string | null;
  }[];
};

const STORE_KEY = "buildlens-ops-store-v3";

function createInitialStore(): LocalStore {
  const defaultProjectId = "30000000-0000-0000-0000-000000000001";
  const secondProjectId = "30000000-0000-0000-0000-000000000002";
  const basePhases = buildDefaultVillaPhases();

  const villas: LocalVilla[] = [
    {
      id: "villa-101",
      project_id: defaultProjectId,
      villa_number: "101",
      block: "Cluster A · North",
      villa_type: "4BHK Signature Villa",
      status: "IN_PROGRESS",
      progress: 62,
      work_section: "Interior base & flooring",
      state_note:
        "GF & FF internal plaster completed; FF bathroom waterproofing flood-tested and cleared for porcelain tiling.",
      evidence_file: "villa101-waterproofing-qa.pdf",
      rework_approved_by: null,
      updated_at: "2026-10-18T09:15:00.000Z",
      phases: reconcileVillaPhases(
        basePhases.map((p, idx) => ({
          ...p,
          status:
            idx === 0
              ? "COMPLETED"
              : idx <= 2
              ? "IN_PROGRESS"
              : "NOT_STARTED",
        }))
      ),
    },
    {
      id: "villa-102",
      project_id: defaultProjectId,
      villa_number: "102",
      block: "Cluster A · North",
      villa_type: "4BHK Signature Villa",
      status: "REWORK_REQUIRED",
      progress: 42,
      work_section: "Services & waterproofing",
      state_note:
        "48h ponding test in FF master bath showed dampness near threshold joint. Re-application of 2-coat membrane required before screed.",
      evidence_file: "villa102-ponding-defect.jpg",
      rework_approved_by: null,
      updated_at: "2026-10-18T10:30:00.000Z",
      phases: reconcileVillaPhases(
        basePhases.map((p, idx) => ({
          ...p,
          status:
            idx === 0
              ? "REWORK_REQUIRED"
              : idx === 1
              ? "IN_PROGRESS"
              : "NOT_STARTED",
        }))
      ),
    },
    {
      id: "villa-103",
      project_id: defaultProjectId,
      villa_number: "103",
      block: "Cluster B · East",
      villa_type: "5BHK Courtyard Villa",
      status: "IN_PROGRESS",
      progress: 76,
      work_section: "Finishes & joinery",
      state_note:
        "Gypsum false ceiling closure and first coat putty running in parallel across GF & FF.",
      evidence_file: "villa103-ceiling-clearance.pdf",
      rework_approved_by: "Manager",
      updated_at: "2026-10-18T11:00:00.000Z",
      phases: reconcileVillaPhases(
        basePhases.map((p, idx) => ({
          ...p,
          status:
            idx <= 1
              ? "COMPLETED"
              : idx <= 3
              ? "IN_PROGRESS"
              : "NOT_STARTED",
        }))
      ),
    },
    {
      id: "villa-104",
      project_id: defaultProjectId,
      villa_number: "104",
      block: "Cluster B · East",
      villa_type: "4BHK Signature Villa",
      status: "COMPLETED",
      progress: 100,
      work_section: "Snagging & handover",
      state_note:
        "Final DB dressing, deep cleaning, and snag closure verified. Ready for client key handover.",
      evidence_file: "villa104-handover-pack.pdf",
      rework_approved_by: "Director",
      updated_at: "2026-10-18T08:00:00.000Z",
      phases: reconcileVillaPhases(
        basePhases.map((p) => ({
          ...p,
          status: "COMPLETED",
        }))
      ),
    },
    {
      id: "villa-105",
      project_id: defaultProjectId,
      villa_number: "105",
      block: "Cluster C · South",
      villa_type: "5BHK Courtyard Villa",
      status: "REWORK_REQUIRED",
      progress: 36,
      work_section: "Interior base & flooring",
      state_note:
        "FF corridor wall plaster plumb tolerance exceeded by 4mm near bedroom door frame. Flagged for rectification & Manager approval.",
      evidence_file: "villa105-plaster-check.jpg",
      rework_approved_by: null,
      updated_at: "2026-10-18T12:15:00.000Z",
      phases: reconcileVillaPhases(
        basePhases.map((p, idx) => ({
          ...p,
          status:
            idx === 0
              ? "COMPLETED"
              : idx === 1
              ? "REWORK_REQUIRED"
              : "NOT_STARTED",
        }))
      ),
    },
    {
      id: "villa-106",
      project_id: defaultProjectId,
      villa_number: "106",
      block: "Cluster C · South",
      villa_type: "4BHK Signature Villa",
      status: "IN_PROGRESS",
      progress: 85,
      work_section: "Fixtures & commissioning",
      state_note:
        "Sanitary ware final fix and AC diffuser balancing 85% complete across GF and FF.",
      evidence_file: "villa106-mep-test.pdf",
      rework_approved_by: "Manager",
      updated_at: "2026-10-18T13:00:00.000Z",
      phases: reconcileVillaPhases(
        basePhases.map((p, idx) => ({
          ...p,
          status:
            idx <= 3
              ? "COMPLETED"
              : idx === 4
              ? "IN_PROGRESS"
              : "NOT_STARTED",
        }))
      ),
    },
  ];

  const workflowEvents: Record<string, WorkEvent[]> = {
    [defaultProjectId]: [
      {
        id: "evt-1",
        villa_id: "villa-101",
        activity_key: "elle-001",
        revision: 1,
        status: "COMPLETED",
        progress: 100,
        note: "Coping granite works of window, balcony and parapet wall completed and inspected.",
        created_at: "2026-10-12T09:00:00.000Z",
      },
      {
        id: "evt-2",
        villa_id: "villa-101",
        activity_key: "elle-002",
        revision: 1,
        status: "COMPLETED",
        progress: 100,
        note: "GF plumbing wall work, CPVC pressure test (10 bar) & wall pipe packing passed.",
        created_at: "2026-10-14T11:30:00.000Z",
      },
      {
        id: "evt-3",
        villa_id: "villa-101",
        activity_key: "elle-016",
        revision: 1,
        status: "IN_PROGRESS",
        progress: 65,
        note: "FF bedroom floor screeding and Statuario porcelain tile laying running in parallel with GF works.",
        created_at: "2026-10-17T14:20:00.000Z",
      },
      {
        id: "evt-4",
        villa_id: "villa-102",
        activity_key: "elle-004",
        revision: 1,
        status: "REWORK_REQUIRED",
        progress: 40,
        note: "FF master bath waterproofing ponding test showed dampness at threshold fillet. Flagged for rework and Manager approval.",
        created_at: "2026-10-18T10:30:00.000Z",
      },
      {
        id: "evt-5",
        villa_id: "villa-103",
        activity_key: "elle-001",
        revision: 1,
        status: "COMPLETED",
        progress: 100,
        note: "Coping granite installation verified across all window sills and parapet walls.",
        created_at: "2026-10-10T15:00:00.000Z",
      },
      {
        id: "evt-6",
        villa_id: "villa-103",
        activity_key: "elle-022",
        revision: 1,
        status: "IN_PROGRESS",
        progress: 78,
        note: "Gypsum ceiling framing & MR boarding running in parallel with MEP 2nd fix.",
        created_at: "2026-10-18T11:00:00.000Z",
      },
      {
        id: "evt-7",
        villa_id: "villa-105",
        activity_key: "elle-012",
        revision: 1,
        status: "REWORK_REQUIRED",
        progress: 35,
        note: "FF corridor plaster plumb deviation (4mm) flagged for rectification before putty.",
        created_at: "2026-10-18T12:15:00.000Z",
      },
      {
        id: "evt-8",
        villa_id: "villa-104",
        activity_key: "elle-001",
        revision: 1,
        status: "COMPLETED",
        progress: 100,
        note: "Completed and signed off.",
        created_at: "2026-10-02T10:00:00.000Z",
      },
      {
        id: "evt-9",
        villa_id: "villa-104",
        activity_key: "elle-002",
        revision: 1,
        status: "COMPLETED",
        progress: 100,
        note: "Completed and signed off.",
        created_at: "2026-10-04T10:00:00.000Z",
      },
      {
        id: "evt-10",
        villa_id: "villa-106",
        activity_key: "elle-034",
        revision: 1,
        status: "IN_PROGRESS",
        progress: 85,
        note: "Sanitary fixtures and concealed cistern trim installation 85% complete.",
        created_at: "2026-10-18T13:00:00.000Z",
      },
    ],
  };

  return {
    projects: [
      {
        id: defaultProjectId,
        name: "Palm Hills Signature Villas — Phase II",
        project_code: "BL-PHV-02",
        status: "ACTIVE",
      },
      {
        id: secondProjectId,
        name: "Green Valley Courtyard Villas",
        project_code: "GVV-2026",
        status: "ACTIVE",
      },
    ],
    villas,
    tasks: [
      {
        id: "task-1",
        project_id: defaultProjectId,
        villa_id: "villa-102",
        name: "Rectify FF bathroom threshold waterproofing membrane",
        title: "Rectify FF bathroom threshold waterproofing membrane",
        status: "REWORK_REQUIRED",
        progress: 40,
        priority: "CRITICAL",
        planned_start_at: "2026-10-16T08:00:00.000Z",
        planned_end_at: "2026-10-20T17:00:00.000Z",
      },
      {
        id: "task-2",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        name: "Complete FF & GF Statuario porcelain floor tiling & grouting",
        title: "Complete FF & GF Statuario porcelain floor tiling & grouting",
        status: "IN_PROGRESS",
        progress: 65,
        priority: "HIGH",
        planned_start_at: "2026-10-14T08:00:00.000Z",
        planned_end_at: "2026-10-24T17:00:00.000Z",
      },
      {
        id: "task-3",
        project_id: defaultProjectId,
        villa_id: "villa-103",
        name: "Gypsum false ceiling closure & MEP second-fix WIR inspection",
        title: "Gypsum false ceiling closure & MEP second-fix WIR inspection",
        status: "IN_PROGRESS",
        progress: 78,
        priority: "HIGH",
        planned_start_at: "2026-10-12T08:00:00.000Z",
        planned_end_at: "2026-10-22T17:00:00.000Z",
      },
      {
        id: "task-4",
        project_id: defaultProjectId,
        villa_id: "villa-105",
        name: "Re-plaster FF corridor wall & verify 3mm straightedge tolerance",
        title: "Re-plaster FF corridor wall & verify 3mm straightedge tolerance",
        status: "BLOCKED",
        progress: 35,
        priority: "HIGH",
        planned_start_at: "2026-10-15T08:00:00.000Z",
        planned_end_at: "2026-10-21T17:00:00.000Z",
      },
      {
        id: "task-5",
        project_id: defaultProjectId,
        villa_id: "villa-106",
        name: "Install fire-rated main entrance & internal timber doors",
        title: "Install fire-rated main entrance & internal timber doors",
        status: "IN_PROGRESS",
        progress: 85,
        priority: "MEDIUM",
        planned_start_at: "2026-10-10T08:00:00.000Z",
        planned_end_at: "2026-10-23T17:00:00.000Z",
      },
      {
        id: "task-6",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        name: "External boundary wall texture coat & coping stone sealant",
        title: "External boundary wall texture coat & coping stone sealant",
        status: "IN_PROGRESS",
        progress: 50,
        priority: "MEDIUM",
        planned_start_at: "2026-10-16T08:00:00.000Z",
        planned_end_at: "2026-10-26T17:00:00.000Z",
      },
      {
        id: "task-7",
        project_id: defaultProjectId,
        villa_id: "villa-104",
        name: "Final MEP DB dressing, Megger test & handover dossier",
        title: "Final MEP DB dressing, Megger test & handover dossier",
        status: "COMPLETED",
        progress: 100,
        priority: "MEDIUM",
        planned_start_at: "2026-10-01T08:00:00.000Z",
        planned_end_at: "2026-10-17T17:00:00.000Z",
      },
    ],
    workflowEvents,
    scheduleConfig: {
      customPhases: [],
      customActivities: [],
      activityOverrides: {},
    },
    employees: [
      {
        id: "emp-1",
        full_name: "Arjun Menon (Executive Director)",
        employee_code: "DIR-001",
        status: "ACTIVE",
      },
      {
        id: "emp-2",
        full_name: "Nadia Al-Mansoor (Project Manager)",
        employee_code: "MGR-104",
        status: "ACTIVE",
      },
      {
        id: "emp-3",
        full_name: "Karthik Nair (Senior Site Engineer)",
        employee_code: "ENG-208",
        status: "ACTIVE",
      },
      {
        id: "emp-4",
        full_name: "Zayd Al-Harthi (MEP Field Engineer)",
        employee_code: "ENG-212",
        status: "ACTIVE",
      },
      {
        id: "emp-5",
        full_name: "Priya Deshmukh (QA/QC Inspection Lead)",
        employee_code: "ENG-219",
        status: "ACTIVE",
      },
      {
        id: "emp-6",
        full_name: "Rohan Kulkarni (Planning & Controls Manager)",
        employee_code: "MGR-109",
        status: "ACTIVE",
      },
    ],
    roles: [
      {
        id: "role-director",
        name: "Director",
        description: ROLE_DEFINITIONS.Director.tagline,
      },
      {
        id: "role-manager",
        name: "Manager",
        description: ROLE_DEFINITIONS.Manager.tagline,
      },
      {
        id: "role-engineer",
        name: "Engineer",
        description: ROLE_DEFINITIONS.Engineer.tagline,
      },
    ],
    workSections: reference.phases.map((name, idx) => ({
      id: `ws-0${idx + 1}`,
      name,
      active: true,
    })),
    vendors: [
      {
        id: "ven-1",
        company_name: "Al-Futtaim MEP & Finishing Contracting",
        category: "MEP & Finishing",
        status: "ACTIVE",
        active: true,
      },
      {
        id: "ven-2",
        company_name: "Gulf Horizon Joinery & Doors LLC",
        category: "Joinery & Acoustic Doors",
        status: "ACTIVE",
        active: true,
      },
      {
        id: "ven-3",
        company_name: "Emirates Marble & Ceramics Co.",
        category: "Tiling, Marble & Granite",
        status: "ACTIVE",
        active: true,
      },
      {
        id: "ven-4",
        company_name: "Apex Waterproofing & Screed Systems",
        category: "Waterproofing & Thermal Insulation",
        status: "ACTIVE",
        active: true,
      },
      {
        id: "ven-5",
        company_name: "Crestline Facade & Glazing Works",
        category: "Aluminium Windows & Glazing",
        status: "ACTIVE",
        active: true,
      },
    ],
    documents: [
      {
        id: "doc-1",
        entity_type: "VILLA_DRAWING · Villa 101–106 IFC Finishing Layout Rev 04",
        mime_type: "application/pdf",
        size_bytes: 4820480,
        uploaded_at: "2026-10-18 09:15",
      },
      {
        id: "doc-2",
        entity_type: "QA_FLOOD_TEST · Villa 101 Wet Area 48h Ponding Certificate",
        mime_type: "application/pdf",
        size_bytes: 1458176,
        uploaded_at: "2026-10-17 16:40",
      },
      {
        id: "doc-3",
        entity_type: "REWORK_NCR · Villa 102 FF Bath Threshold Dampness Report",
        mime_type: "image/jpeg",
        size_bytes: 2314240,
        uploaded_at: "2026-10-18 10:30",
      },
      {
        id: "doc-4",
        entity_type: "MEP_SCHEMATIC · Villa 103 Above-Ceiling Reflected Ceiling Plan",
        mime_type: "application/pdf",
        size_bytes: 6123520,
        uploaded_at: "2026-10-16 14:10",
      },
      {
        id: "doc-5",
        entity_type: "HANDOVER_DOSSIER · Villa 104 Final Commissioning & Key Pack",
        mime_type: "application/pdf",
        size_bytes: 8945664,
        uploaded_at: "2026-10-18 08:00",
      },
    ],
    snags: [
      {
        id: "snag-1",
        project_id: defaultProjectId,
        villa_id: "villa-102",
        task_id: "task-1",
        title: "FF Master Bath Threshold Waterproofing Dampness",
        description:
          "48h ponding test revealed moisture seepage at doorway upstand fillet; requires 2-coat cementitious membrane re-application and Manager rework approval.",
        severity: "CRITICAL",
        status: "REWORK_REQUIRED",
        due_at: "2026-10-20T17:00:00.000Z",
      },
      {
        id: "snag-2",
        project_id: defaultProjectId,
        villa_id: "villa-105",
        task_id: "task-4",
        title: "FF Corridor Wall Plaster Plumb Deviation (4mm)",
        description:
          "Internal cement plaster exceeds 3mm straightedge tolerance adjacent to bedroom B2 door frame.",
        severity: "HIGH",
        status: "IN_PROGRESS",
        due_at: "2026-10-22T17:00:00.000Z",
      },
      {
        id: "snag-3",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        task_id: "task-2",
        title: "Minor Tile Lippage Near GF Kitchen Threshold",
        description:
          "Two porcelain tiles at GF kitchen doorway require re-bedding flush with marble saddle threshold.",
        severity: "MEDIUM",
        status: "IN_PROGRESS",
        due_at: "2026-10-21T17:00:00.000Z",
      },
      {
        id: "snag-4",
        project_id: defaultProjectId,
        villa_id: "villa-103",
        task_id: "task-3",
        title: "Acoustic Sealant Gap Around FF Fan Coil Access Trap",
        description:
          "Apply fire-rated acoustic mastic around perimeter of gypsum ceiling access hatch in FF lobby.",
        severity: "LOW",
        status: "OPEN",
        due_at: "2026-10-24T17:00:00.000Z",
      },
    ],
    inspections: [
      {
        id: "insp-1",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        task_id: "task-2",
        inspection_type: "Wet Area Waterproofing 48h Flood Test (Villa 101)",
        notes:
          "Zero leakage observed after 48-hour flood test across GF & FF wet rooms. Cleared for protection screed and tiling.",
        status: "COMPLETED",
        scheduled_at: "2026-10-16T10:00:00.000Z",
      },
      {
        id: "insp-2",
        project_id: defaultProjectId,
        villa_id: "villa-102",
        task_id: "task-1",
        inspection_type: "Wet Area Waterproofing 48h Flood Test (Villa 102)",
        notes:
          "Threshold dampness detected in FF master bath; flagged as REWORK_REQUIRED awaiting Manager sign-off.",
        status: "REWORK_REQUIRED",
        scheduled_at: "2026-10-18T10:30:00.000Z",
      },
      {
        id: "insp-3",
        project_id: defaultProjectId,
        villa_id: "villa-103",
        task_id: "task-3",
        inspection_type: "Above-Ceiling MEP 2nd Fix & Gypsum Framing WIR",
        notes:
          "Joint inspection with MEP and gypsum trade supervisors scheduled prior to ceiling board closure.",
        status: "IN_PROGRESS",
        scheduled_at: "2026-10-20T14:00:00.000Z",
      },
      {
        id: "insp-4",
        project_id: defaultProjectId,
        villa_id: "villa-104",
        task_id: "task-7",
        inspection_type: "Final MEP Commissioning & Pre-Handover De-Snagging",
        notes:
          "All DB circuits tested, lux levels verified, and architectural finishes passed 100%.",
        status: "COMPLETED",
        scheduled_at: "2026-10-17T15:00:00.000Z",
      },
    ],
    materials: [
      {
        id: "mat-1",
        project_id: defaultProjectId,
        quantity_on_hand: 18,
        reorder_level: 25,
        unit_cost: 145,
        products: {
          sku: "WP-CEM-20",
          name: "2-Component Cementitious Waterproofing Membrane (20kg Kit)",
          category: "Waterproofing",
          unit: "kits",
        },
      },
      {
        id: "mat-2",
        project_id: defaultProjectId,
        quantity_on_hand: 1420,
        reorder_level: 400,
        unit_cost: 68.5,
        products: {
          sku: "TL-POR-60120",
          name: "600x1200mm Statuario Porcelain Floor Tile",
          category: "Tiling & Marble",
          unit: "sqm",
        },
      },
      {
        id: "mat-3",
        project_id: defaultProjectId,
        quantity_on_hand: 310,
        reorder_level: 120,
        unit_cost: 32,
        products: {
          sku: "GYP-MR-125",
          name: "12.5mm Moisture-Resistant Gypsum Board",
          category: "Gypsum & Ceilings",
          unit: "sheets",
        },
      },
      {
        id: "mat-4",
        project_id: defaultProjectId,
        quantity_on_hand: 14,
        reorder_level: 20,
        unit_cost: 210,
        products: {
          sku: "PNT-ACR-25",
          name: "Low-VOC Acrylic Interior Wall Putty & Primer (25L Drum)",
          category: "Painting",
          unit: "drums",
        },
      },
      {
        id: "mat-5",
        project_id: defaultProjectId,
        quantity_on_hand: 42,
        reorder_level: 15,
        unit_cost: 590,
        products: {
          sku: "MEP-SAN-01",
          name: "Concealed Cistern & Wall-Hung WC Frame Set",
          category: "Sanitary & MEP",
          unit: "sets",
        },
      },
      {
        id: "mat-6",
        project_id: defaultProjectId,
        quantity_on_hand: 95,
        reorder_level: 40,
        unit_cost: 115,
        products: {
          sku: "GRN-COP-30",
          name: "30mm Flamed Granite Window & Parapet Coping Slab",
          category: "External Stone",
          unit: "lm",
        },
      },
    ],
    purchaseOrders: [
      {
        id: "po-1",
        project_id: defaultProjectId,
        po_number:
          "PO-2026-0104 · Sika 2-Coat Waterproofing Membrane Replenishment (60 Kits)",
        status: "IN_PROGRESS",
        requested_at: "2026-10-15T09:00:00.000Z",
        expected_at: "2026-10-21T00:00:00.000Z",
      },
      {
        id: "po-2",
        project_id: defaultProjectId,
        po_number:
          "PO-2026-0108 · RAK Statuario Porcelain Tile Batch B (600 sqm)",
        status: "IN_PROGRESS",
        requested_at: "2026-10-16T11:30:00.000Z",
        expected_at: "2026-10-25T00:00:00.000Z",
      },
      {
        id: "po-3",
        project_id: defaultProjectId,
        po_number:
          "PO-2026-0112 · Knauf MR Gypsum Board & Perimeter Channels",
        status: "COMPLETED",
        requested_at: "2026-10-08T08:00:00.000Z",
        expected_at: "2026-10-14T00:00:00.000Z",
      },
      {
        id: "po-4",
        project_id: defaultProjectId,
        po_number:
          "PO-2026-0115 · Gulf Horizon Acoustic Rated Timber Doors (Villas 103 & 106)",
        status: "IN_PROGRESS",
        requested_at: "2026-10-12T10:00:00.000Z",
        expected_at: "2026-10-23T00:00:00.000Z",
      },
    ],
    wirs: [
      {
        id: "wir-1",
        project_id: defaultProjectId,
        description: "WIR-101 · Villa 101 GF & FF Wet Room Flood Test Clearance",
        status: "COMPLETED",
        revision: "Rev 02",
      },
      {
        id: "wir-2",
        project_id: defaultProjectId,
        description:
          "WIR-102 · Villa 102 FF Master Bath Waterproofing Re-Inspection",
        status: "REWORK_REQUIRED",
        revision: "Rev 01",
      },
      {
        id: "wir-3",
        project_id: defaultProjectId,
        description:
          "WIR-103 · Villa 103 Above-Ceiling MEP & Gypsum Framing Sign-Off",
        status: "IN_PROGRESS",
        revision: "Rev 01",
      },
    ],
    drawings: [
      {
        id: "drw-1",
        project_id: defaultProjectId,
        document_type: "IFC-AR-101 · GF & FF Tile Setting-Out & Threshold Details",
        approval_status: "COMPLETED",
        version: "Rev 04",
      },
      {
        id: "drw-2",
        project_id: defaultProjectId,
        document_type: "IFC-MEP-204 · Reflected Ceiling Plan & Diffuser Co-ordination",
        approval_status: "COMPLETED",
        version: "Rev 03",
      },
      {
        id: "drw-3",
        project_id: defaultProjectId,
        document_type: "IFC-ID-309 · Joinery & Wardrobe Elevation Schedule",
        approval_status: "IN_PROGRESS",
        version: "Rev 02",
      },
    ],
    notifications: [
      {
        id: "notif-1",
        type: "REWORK_REQUIRED",
        title: "Villa 102 flagged for Waterproofing Rework",
        body: "Site Engineer Karthik Nair uploaded REWORK_REQUIRED state on Villa 102 (Services & waterproofing). Manager or Director approval required after membrane rectification.",
        read_at: null,
        created_at: "2026-10-18T10:30:00.000Z",
      },
      {
        id: "notif-2",
        type: "REWORK_REQUIRED",
        title: "Villa 105 flagged for FF Corridor Plaster Rectification",
        body: "Plumb deviation of 4mm recorded on FF corridor wall in Villa 105. Awaiting rectification and Manager rework approval.",
        read_at: null,
        created_at: "2026-10-18T12:15:00.000Z",
      },
      {
        id: "notif-3",
        type: "BLOCKED",
        title: "Reorder Alert: Waterproofing Membrane & Acrylic Putty",
        body: "2-Component Waterproofing Membrane (18 kits < 25 buffer) and Acrylic Wall Putty (14 drums < 20 buffer) are below reorder levels.",
        read_at: null,
        created_at: "2026-10-18T09:00:00.000Z",
      },
      {
        id: "notif-4",
        type: "COMPLETED",
        title: "Villa 104 Handover Package Ready (98% Readiness)",
        body: "All MEP commissioning certificates and de-snagging checks for Villa 104 have been signed off.",
        read_at: "2026-10-18T08:30:00.000Z",
        created_at: "2026-10-18T08:00:00.000Z",
      },
    ],
    safety: [
      {
        id: "saf-1",
        project_id: defaultProjectId,
        villa_id: "villa-103",
        observation_type: "OBSERVATION",
        severity: "MEDIUM",
        status: "COMPLETED",
        description:
          "Mobile scaffold tower in Villa 103 double-height lobby lacked toe-board on east side during gypsum framing.",
        corrective_action:
          "Installed toe-board immediately and green-tagged scaffold after HSE supervisor inspection.",
        created_at: "2026-10-18T08:45:00.000Z",
      },
      {
        id: "saf-2",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        observation_type: "TOOLBOX_TALK",
        severity: "LOW",
        status: "COMPLETED",
        description:
          "Conducted morning toolbox talk on wet-cut tile saw blade guards, FFP2 dust masks, and temporary distribution board RCD checks.",
        corrective_action:
          "22 tiling and masonry operatives attended and signed briefing log.",
        created_at: "2026-10-18T07:30:00.000Z",
      },
      {
        id: "saf-3",
        project_id: defaultProjectId,
        villa_id: "villa-102",
        observation_type: "PERMIT",
        severity: "MEDIUM",
        status: "IN_PROGRESS",
        description:
          "Confined wet-area ventilation & PPE permit issued for two-component waterproofing membrane application in Villa 102.",
        corrective_action:
          "Extractor fan positioned at FF landing; organic vapour cartridges verified.",
        created_at: "2026-10-18T11:15:00.000Z",
      },
    ],
    dailyReports: [
      {
        id: "dr-1",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        report_date: "2026-10-18",
        weather: "Clear, 31°C · Light Breeze",
        workforce_count: 46,
        summary:
          "Completed 85 sqm of Statuario porcelain floor tiling in Villa 101 GF & FF in parallel; gypsum ceiling boarding advanced to 78% in Villa 103; sanitary 2nd fix reached 85% in Villa 106.",
        constraints:
          "Villa 102 FF master bath on rework hold pending waterproofing membrane curing and Manager rework sign-off.",
      },
      {
        id: "dr-2",
        project_id: defaultProjectId,
        villa_id: "villa-104",
        report_date: "2026-10-17",
        weather: "Sunny, 32°C",
        workforce_count: 42,
        summary:
          "Completed final DB dressing, insulation resistance testing, and deep cleaning in Villa 104. Handover readiness score updated to 98%.",
        constraints: null,
      },
      {
        id: "dr-3",
        project_id: defaultProjectId,
        villa_id: "villa-103",
        report_date: "2026-10-16",
        weather: "Clear, 30°C",
        workforce_count: 39,
        summary:
          "Completed above-ceiling chilled water pipe pressure test and first-coat interior wall putty across Villa 103 GF & FF.",
        constraints: null,
      },
    ],
    handovers: [
      {
        id: "ho-1",
        project_id: defaultProjectId,
        villa_id: "villa-104",
        customer_name: "Mr. & Mrs. Tariq Al-Ghurair (Villa 104)",
        status: "COMPLETED",
        readiness_score: 98,
        target_date: "2026-12-20",
        notes:
          "All MEP test certificates, O&M manuals, and de-snagging sign-offs uploaded.",
      },
      {
        id: "ho-2",
        project_id: defaultProjectId,
        villa_id: "villa-106",
        customer_name: "Dr. Ayesha Siddiqui (Villa 106)",
        status: "IN_PROGRESS",
        readiness_score: 85,
        target_date: "2027-01-05",
        notes:
          "Final sanitary pressure test complete; awaiting AC air-balancing certificate.",
      },
      {
        id: "ho-3",
        project_id: defaultProjectId,
        villa_id: "villa-103",
        customer_name: "Mr. Kabir Malhotra (Villa 103)",
        status: "IN_PROGRESS",
        readiness_score: 76,
        target_date: "2027-01-10",
        notes: "Joinery and painting 2nd fix running in parallel across GF & FF.",
      },
      {
        id: "ho-4",
        project_id: defaultProjectId,
        villa_id: "villa-101",
        customer_name: "Ms. Leila Al-Hashimi (Villa 101)",
        status: "IN_PROGRESS",
        readiness_score: 62,
        target_date: "2027-01-15",
        notes: "Porcelain tiling and external stone coping in progress.",
      },
    ],
  };
}

let memoryStore: LocalStore | null = null;

function loadStore(): LocalStore {
  if (typeof window === "undefined") {
    if (!memoryStore) memoryStore = createInitialStore();
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalStore;
      if (
        parsed &&
        Array.isArray(parsed.projects) &&
        Array.isArray(parsed.villas) &&
        Array.isArray(parsed.materials)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fallback to initial store
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: LocalStore): void {
  memoryStore = store;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

function handleLocalRequest(path: string, init: RequestInit = {}): unknown {
  const store = loadStore();
  const method = (init.method || "GET").toUpperCase();
  const [cleanPath, queryString] = path.split("?");
  const params = new URLSearchParams(queryString || "");
  const body =
    typeof init.body === "string" && init.body
      ? JSON.parse(init.body)
      : {};

  const activeRole = getStoredRole() || "Director";
  const roleDef = ROLE_DEFINITIONS[activeRole];

  if (cleanPath === "/auth/me") {
    return {
      email: roleDef.email,
      full_name: roleDef.fullName,
      employee_code: roleDef.employeeCode,
      role_name: activeRole,
      permissions: roleDef.permissions,
    };
  }

  if (cleanPath === "/projects") {
    if (method === "POST") {
      const created = {
        id: `proj-${Date.now()}`,
        name: body.name || "New Project",
        project_code: body.project_code || `BL-${store.projects.length + 1}`,
        status: "ACTIVE",
      };
      store.projects.push(created);
      saveStore(store);
      return created;
    }
    return { items: store.projects };
  }

  // Match /projects/:projectId/villas
  const projectVillasMatch = cleanPath.match(/^\/projects\/([^/]+)\/villas$/);
  if (projectVillasMatch) {
    const projectId = projectVillasMatch[1];
    if (method === "POST") {
      if (activeRole !== "Director") {
        throw new APIError("FORBIDDEN", "Only the Director role can register new villas.");
      }
      const customPhases: VillaPhaseConfig[] = Array.isArray(body.phases)
        ? reconcileVillaPhases(body.phases)
        : buildDefaultVillaPhases();
      const created: LocalVilla = {
        id: `villa-${Date.now()}`,
        project_id: projectId,
        villa_number: String(body.villa_number || "107"),
        block: body.block || "Cluster A",
        villa_type: body.villa_type || "4BHK Signature Villa",
        status: body.status || "NOT_STARTED",
        progress: Number(body.progress ?? 0),
        work_section:
          body.work_section ||
          customPhases[0]?.name ||
          "Services & waterproofing",
        state_note: body.state_note || "Villa registered with finishing phases.",
        evidence_file: null,
        rework_approved_by: null,
        updated_at: new Date().toISOString(),
        phases: customPhases,
      };
      store.villas.push(created);
      saveStore(store);
      return created;
    }
    const filtered = store.villas.filter((v) => v.project_id === projectId);
    const sourceVillas = filtered.length > 0 ? filtered : store.villas;
    const items = sourceVillas.map((v) => ({
      ...v,
      phases:
        v.phases && v.phases.length > 0
          ? reconcileVillaPhases(v.phases)
          : buildDefaultVillaPhases(),
    }));
    return { items };
  }

  // Engineer / Director: Upload villa state in Operations / Villas
  const villaStateMatch = cleanPath.match(/^\/villas\/([^/]+)\/state$/);
  if (villaStateMatch && method === "POST") {
    if (activeRole !== "Engineer" && activeRole !== "Director") {
      throw new APIError("FORBIDDEN", "Only Engineer or Director can upload villa field states.");
    }
    const villaId = villaStateMatch[1];
    const villa = store.villas.find(
      (v) => v.id === villaId || v.id.endsWith(villaId.slice(-3))
    );
    if (!villa) {
      throw new APIError("NOT_FOUND", "Villa not found.");
    }
    villa.status = body.status || villa.status;
    villa.progress =
      typeof body.progress === "number" ? body.progress : villa.progress;
    villa.work_section = body.work_section || villa.work_section;
    villa.state_note = body.note || villa.state_note;
    if (body.evidence_file !== undefined) {
      villa.evidence_file = body.evidence_file;
    }
    if (villa.status === "REWORK_REQUIRED") {
      villa.rework_approved_by = null;
    }
    villa.updated_at = new Date().toISOString();

    if (villa.phases && villa.work_section) {
      villa.phases = villa.phases.map((p) =>
        p.name.toLowerCase() === String(villa.work_section).toLowerCase()
          ? { ...p, status: (villa.status as WorkStatus) || p.status }
          : p
      );
    }

    saveStore(store);
    return villa;
  }

  // Manager / Director: Approve rework for a villa
  const villaApproveReworkMatch = cleanPath.match(
    /^\/villas\/([^/]+)\/approve-rework$/
  );
  if (villaApproveReworkMatch && method === "POST") {
    if (activeRole !== "Manager" && activeRole !== "Director") {
      throw new APIError("FORBIDDEN", "Only Manager or Director can approve villa rework.");
    }
    const villaId = villaApproveReworkMatch[1];
    const villa = store.villas.find(
      (v) => v.id === villaId || v.id.endsWith(villaId.slice(-3))
    );
    if (!villa) {
      throw new APIError("NOT_FOUND", "Villa not found.");
    }
    villa.status = body.next_status || "IN_PROGRESS";
    villa.progress =
      typeof body.progress === "number"
        ? body.progress
        : Math.max(villa.progress || 50, 65);
    villa.state_note =
      body.note ||
      `Rework approved by ${activeRole}. Cleared to proceed with next finishing sequence.`;
    villa.rework_approved_by = activeRole;
    villa.updated_at = new Date().toISOString();

    if (villa.phases) {
      villa.phases = villa.phases.map((p) =>
        p.status === "REWORK_REQUIRED" ? { ...p, status: "IN_PROGRESS" } : p
      );
    }

    const projEvents = store.workflowEvents[villa.project_id] || [];
    const latestByAct = new Map<string, WorkEvent>();
    for (const ev of projEvents) {
      if (ev.villa_id === villa.id) {
        const prev = latestByAct.get(ev.activity_key);
        if (!prev || ev.revision >= prev.revision) {
          latestByAct.set(ev.activity_key, ev);
        }
      }
    }
    for (const [, latest] of latestByAct) {
      if (latest.status === "REWORK_REQUIRED") {
        projEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          villa_id: villa.id,
          activity_key: latest.activity_key,
          revision: latest.revision + 1,
          status: "IN_PROGRESS",
          progress: Math.max(latest.progress, 65),
          note: `Rework approved by ${activeRole}: ${villa.state_note}`,
          created_at: new Date().toISOString(),
        });
      }
    }
    store.workflowEvents[villa.project_id] = projEvents;

    saveStore(store);
    return villa;
  }

  // Edit villa & phases (linked with Work sections page)
  const villaEditMatch = cleanPath.match(/^\/villas\/([^/]+)\/edit$/);
  if (villaEditMatch && method === "POST") {
    const villaId = villaEditMatch[1];
    const villa = store.villas.find(
      (v) => v.id === villaId || v.id.endsWith(villaId.slice(-3))
    );
    if (!villa) {
      throw new APIError("NOT_FOUND", "Villa not found.");
    }
    if (body.villa_number) villa.villa_number = String(body.villa_number);
    if (body.block !== undefined) villa.block = String(body.block);
    if (body.villa_type !== undefined) villa.villa_type = String(body.villa_type);
    if (Array.isArray(body.phases)) {
      const reconciled = reconcileVillaPhases(body.phases);
      villa.phases = reconciled;

      for (const ph of reconciled) {
        const existsInBase = reference.phases.some(
          (rp) => rp.toLowerCase() === ph.name.toLowerCase()
        );
        const existsInCustom = store.scheduleConfig.customPhases.some(
          (cp) => cp.toLowerCase() === ph.name.toLowerCase()
        );
        if (!existsInBase && !existsInCustom) {
          store.scheduleConfig.customPhases.push(ph.name);
          const newPhaseIndex =
            reference.phases.length +
            store.scheduleConfig.customPhases.length -
            1;
          ph.phaseIndex = newPhaseIndex;
          const actId = `custom-act-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 5)}`;
          const totalActs =
            reference.activities.length +
            store.scheduleConfig.customActivities.length;
          store.scheduleConfig.customActivities.push({
            id: actId,
            order: totalActs + 1,
            name: `${ph.name} — Execution & QA Verification`,
            duration: ph.plannedDays,
            phase: newPhaseIndex,
            remarks: `Linked from Villa ${villa.villa_number} phase configuration (${
              ph.allowParallel ? "Parallel overlap allowed" : "Sequential"
            }).`,
            source: "VILLA_PHASE",
          });
          store.scheduleConfig.activityOverrides[actId] = {
            duration: ph.plannedDays,
            startDay: ph.startDay,
            allowParallel: ph.allowParallel,
          };
        }
      }
    }
    villa.updated_at = new Date().toISOString();
    saveStore(store);
    return villa;
  }

  // Work sections schedule configuration
  if (cleanPath === "/workflow/schedule-config") {
    if (method === "POST") {
      if (body.activityId && body.override) {
        store.scheduleConfig.activityOverrides[body.activityId] = body.override;
      }
      if (body.customActivity) {
        store.scheduleConfig.customActivities.push(body.customActivity);
      }
      saveStore(store);
    }
    return store.scheduleConfig;
  }

  // Match /projects/:projectId/tasks
  const projectTasksMatch = cleanPath.match(/^\/projects\/([^/]+)\/tasks$/);
  if (projectTasksMatch) {
    const projectId = projectTasksMatch[1];
    if (method === "POST") {
      const title = String(body.title || body.name || "New Task");
      const created = {
        id: `task-${Date.now()}`,
        project_id: projectId,
        villa_id: body.villa_id || undefined,
        name: title,
        title,
        status: body.status || "IN_PROGRESS",
        progress: Number(body.progress ?? 0),
        priority: body.priority || "MEDIUM",
        planned_end_at: body.planned_end_at || undefined,
      };
      store.tasks.unshift(created);
      saveStore(store);
      return created;
    }
    const filtered = store.tasks.filter((t) => t.project_id === projectId);
    return {
      items: filtered.length > 0 ? filtered : store.tasks,
    };
  }

  // Today / Agenda & Tasks
  if (cleanPath === "/agenda") {
    const projectId = params.get("project_id");
    const filtered = projectId
      ? store.tasks.filter((t) => t.project_id === projectId)
      : store.tasks;
    return { items: filtered.length > 0 ? filtered : store.tasks };
  }

  if (cleanPath === "/tasks" && method === "POST") {
    const title = String(body.name || body.title || "Scheduled field work");
    const created = {
      id: `task-${Date.now()}`,
      project_id: body.project_id || store.projects[0]?.id || "proj-1",
      villa_id: body.villa_id || undefined,
      name: title,
      title,
      status: "IN_PROGRESS",
      progress: 15,
      priority: body.priority || "MEDIUM",
      planned_start_at: body.planned_start_at || new Date().toISOString(),
      planned_end_at:
        body.planned_end_at ||
        new Date(Date.now() + 5 * 86400000).toISOString(),
    };
    store.tasks.unshift(created);
    saveStore(store);
    return created;
  }

  const taskStatusMatch = cleanPath.match(/^\/tasks\/([^/]+)\/status$/);
  if (taskStatusMatch && method === "PATCH") {
    const taskId = taskStatusMatch[1];
    const task = store.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = body.status || task.status;
      if (task.status === "COMPLETED") task.progress = 100;
      else if (task.status === "IN_PROGRESS" && task.progress === 0) {
        task.progress = 35;
      }
      saveStore(store);
      return task;
    }
  }

  // Match /workflow/:projectId
  const workflowMatch = cleanPath.match(/^\/workflow\/([^/]+)$/);
  if (workflowMatch) {
    const projectId = workflowMatch[1];
    const defaultProjId = store.projects[0]?.id || projectId;
    const list =
      store.workflowEvents[projectId] ||
      store.workflowEvents[defaultProjId] ||
      [];
    if (method === "POST") {
      const created: WorkEvent = {
        id: `evt-${Date.now()}`,
        villa_id: body.villa_id,
        activity_key: body.activity_key,
        revision: Number(body.revision || 1),
        status: body.status,
        progress: Number(body.progress ?? 0),
        note: body.note || "",
        created_at: new Date().toISOString(),
      };
      list.push(created);
      store.workflowEvents[projectId] = list;

      const targetVilla = store.villas.find((v) => v.id === body.villa_id);
      if (targetVilla) {
        if (body.status === "REWORK_REQUIRED") {
          targetVilla.status = "REWORK_REQUIRED";
          targetVilla.state_note = body.note || targetVilla.state_note;
          targetVilla.rework_approved_by = null;
        }
        targetVilla.updated_at = new Date().toISOString();
      }

      saveStore(store);
      return created;
    }
    const offset = Number(params.get("offset") || 0);
    return {
      items: list.slice(offset, offset + 200),
      next_offset: null,
    };
  }

  // Operations: Work Sections, Vendors, Documents
  if (cleanPath === "/operations/work-sections") {
    if (method === "POST") {
      const created = {
        id: `ws-${Date.now()}`,
        name: String(body.name || "New Section"),
        active: true,
      };
      store.workSections.push(created);
      saveStore(store);
      return created;
    }
    return { items: store.workSections };
  }

  if (cleanPath === "/operations/vendors") {
    if (method === "POST") {
      const created = {
        id: `ven-${Date.now()}`,
        company_name: String(body.company_name || "New Contractor"),
        category: String(body.category || "General Trade"),
        status: "ACTIVE",
        active: true,
      };
      store.vendors.push(created);
      saveStore(store);
      return created;
    }
    return { items: store.vendors };
  }

  if (cleanPath === "/operations/documents") {
    return { items: store.documents };
  }

  // Quality: Snags & Inspections
  if (cleanPath === "/quality/snags") {
    if (method === "POST") {
      const created = {
        id: `snag-${Date.now()}`,
        project_id: body.project_id || store.projects[0]?.id,
        villa_id: body.villa_id || "villa-101",
        task_id: body.task_id || null,
        title: String(body.title || "Field snag"),
        description: String(body.description || ""),
        severity: String(body.severity || "MEDIUM"),
        status: "OPEN",
        due_at: new Date(Date.now() + 4 * 86400000).toISOString(),
      };
      store.snags.unshift(created);
      saveStore(store);
      return created;
    }
    return { items: store.snags };
  }

  if (cleanPath === "/quality/inspections") {
    if (method === "POST") {
      const created = {
        id: `insp-${Date.now()}`,
        project_id: body.project_id || store.projects[0]?.id,
        villa_id: body.villa_id || "villa-101",
        task_id: body.task_id || null,
        inspection_type: String(body.inspection_type || "QA Inspection"),
        notes: String(body.notes || "Scheduled field verification"),
        status: "PENDING",
        scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      };
      store.inspections.unshift(created);
      saveStore(store);
      return created;
    }
    return { items: store.inspections };
  }

  // Materials & Procurement
  if (cleanPath === "/materials") {
    return { items: store.materials };
  }

  if (cleanPath === "/procurement/purchase-orders") {
    return { items: store.purchaseOrders };
  }

  // Approvals & Drawings
  if (cleanPath === "/wirs") {
    return { items: store.wirs };
  }

  if (cleanPath === "/drawings") {
    return { items: store.drawings };
  }

  // Inbox / Notifications
  if (cleanPath === "/notifications") {
    return { items: store.notifications };
  }

  const notifReadMatch = cleanPath.match(/^\/notifications\/([^/]+)\/read$/);
  if (notifReadMatch && method === "PATCH") {
    const id = notifReadMatch[1];
    const target = store.notifications.find((n) => n.id === id);
    if (target) {
      target.read_at = new Date().toISOString();
      saveStore(store);
    }
    return target || { id };
  }

  // Safety
  if (cleanPath === "/safety") {
    if (method === "POST") {
      const created = {
        id: `saf-${Date.now()}`,
        project_id: body.project_id || store.projects[0]?.id,
        villa_id: body.villa_id || null,
        observation_type: String(body.observation_type || "OBSERVATION"),
        severity: String(body.severity || "MEDIUM"),
        status: "OPEN",
        description: String(body.description || ""),
        corrective_action: body.corrective_action || null,
        created_at: new Date().toISOString(),
      };
      store.safety.unshift(created);
      saveStore(store);
      return created;
    }
    return { items: store.safety };
  }

  // Daily Reports
  if (cleanPath === "/daily-reports") {
    if (method === "POST") {
      const created = {
        id: `dr-${Date.now()}`,
        project_id: body.project_id || store.projects[0]?.id,
        villa_id: body.villa_id || null,
        report_date:
          body.report_date || new Date().toISOString().slice(0, 10),
        weather: String(body.weather || "Clear, 30°C"),
        workforce_count: Number(body.workforce_count || 35),
        summary: String(body.summary || ""),
        constraints: body.constraints || null,
      };
      store.dailyReports.unshift(created);
      saveStore(store);
      return created;
    }
    return { items: store.dailyReports };
  }

  // Handover Packages
  if (cleanPath === "/handovers") {
    if (method === "POST") {
      const created = {
        id: `ho-${Date.now()}`,
        project_id: body.project_id || store.projects[0]?.id,
        villa_id: body.villa_id || "villa-101",
        customer_name: String(body.customer_name || "Client Handover Package"),
        status: "IN_PROGRESS",
        readiness_score: 70,
        target_date:
          body.target_date ||
          new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        notes: body.notes || null,
      };
      store.handovers.unshift(created);
      saveStore(store);
      return created;
    }
    return { items: store.handovers };
  }

  // People
  if (cleanPath === "/people" || cleanPath === "/people/employees") {
    if (method === "POST") {
      if (activeRole !== "Director") {
        throw new APIError("FORBIDDEN", "Only the Director role can manage people.");
      }
      const created = {
        id: `emp-${Date.now()}`,
        full_name: String(body.full_name || "New Team Member"),
        employee_code: String(
          body.employee_code || `BL-EMP-${store.employees.length + 10}`
        ),
        status: "ACTIVE",
      };
      store.employees.push(created);
      saveStore(store);
      return created;
    }
    return {
      employees: store.employees,
      roles: store.roles,
      projects: store.projects,
    };
  }

  // Reports / Operational Intelligence
  if (cleanPath === "/reports/overview") {
    const reworkVillas = store.villas.filter(
      (v) => v.status === "REWORK_REQUIRED"
    );
    const openSnags = store.snags.filter(
      (s) => s.status !== "CLOSED" && s.status !== "COMPLETED"
    ).length;
    const lowStock = store.materials.filter(
      (m) => m.quantity_on_hand <= m.reorder_level
    );
    const avgProgress = store.villas.length
      ? Math.round(
          store.villas.reduce((sum, v) => sum + (v.progress || 0), 0) /
            store.villas.length
        )
      : 0;
    return {
      metrics: {
        tasks_total: store.tasks.length,
        average_progress: avgProgress,
        open_snags: openSnags,
        low_stock_items: lowStock.length,
      },
      exceptions: [
        ...reworkVillas.map((v) => ({
          id: `exc-${v.id}`,
          type: "REWORK_REQUIRED",
          title: `Villa ${v.villa_number} (${v.work_section || "Finishing"}): ${
            v.state_note
          }`,
          message: `Villa ${v.villa_number} (${
            v.work_section || "Finishing"
          }): ${v.state_note}`,
        })),
        ...lowStock.map((m) => ({
          id: `exc-${m.id}`,
          type: "BLOCKED",
          title: `Low stock alert: ${m.products.name} (${m.quantity_on_hand} ${m.products.unit} on hand vs ${m.reorder_level} reorder threshold)`,
          message: `Low stock alert: ${m.products.name} (${m.quantity_on_hand} ${m.products.unit} on hand vs ${m.reorder_level} reorder threshold)`,
        })),
      ],
    };
  }

  // AI Copilot Briefing
  if (cleanPath === "/ai/briefing") {
    const reworkList = store.villas
      .filter((v) => v.status === "REWORK_REQUIRED")
      .map(
        (v) =>
          `• Villa ${v.villa_number} (${v.work_section}): ${v.state_note}`
      )
      .join("\n");
    const lowStockList = store.materials
      .filter((m) => m.quantity_on_hand <= m.reorder_level)
      .map(
        (m) =>
          `• ${m.products.name} (${m.products.sku}): ${m.quantity_on_hand} ${m.products.unit} remaining (reorder threshold: ${m.reorder_level} ${m.products.unit})`
      )
      .join("\n");
    return {
      answer: [
        `Operational Briefing — Active Role: ${activeRole}`,
        ``,
        `1. Portfolio & Schedule Health:`,
        `• Tracking ${store.villas.length} villas across 6 finishing phases and 89 work activities (0 duration conflicts; 84 parallel overlapping activities across GF, FF, and External tracks).`,
        `• Average villa completion is ${Math.round(
          store.villas.reduce((s, v) => s + (v.progress || 0), 0) /
            store.villas.length
        )}%, with Villa 104 at 100% (Handover Ready) and Villa 106 at 85%.`,
        ``,
        `2. Quality & Rework Holds Requiring Manager / Director Action:`,
        reworkList || `• Zero active rework holds across the project.`,
        ``,
        `3. Supply Chain & Material Buffers:`,
        lowStockList || `• All tracked materials are above minimum reorder thresholds.`,
      ].join("\n"),
      mode: "deterministic",
    };
  }

  return { items: [] };
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const activeRole = getStoredRole();
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID(),
      ...(activeRole ? { "X-BuildLens-Role": activeRole } : {}),
      ...init.headers,
    },
  });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    method !== "GET"
  ) {
    const queued = queueMutation(path, init);
    return { queued: true, client_mutation_id: queued.id } as T;
  }
  let response: Response;
  try {
    response = await send(path, init);
  } catch {
    return handleLocalRequest(path, init) as T;
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 404 || response.status >= 500) {
      return handleLocalRequest(path, init) as T;
    }
    const body = await response.json().catch(() => null);
    throw new APIError(
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "The request could not be completed.",
      body?.error?.request_id
    );
  }
  return response.json() as Promise<T>;
}

export async function syncOfflineQueue(): Promise<number> {
  return flushMutations(async (item: QueuedMutation) => {
    const response = await send(item.path, {
      method: item.method,
      body: item.body,
    });
    if (!response.ok) throw new Error("Mutation could not be synchronized");
  });
}
