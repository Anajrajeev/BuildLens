from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.core.permissions import ROLE_METADATA

DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_PROJECT_ID = "30000000-0000-0000-0000-000000000001"
SECOND_PROJECT_ID = "30000000-0000-0000-0000-000000000002"

DEFAULT_PHASE_WINDOWS = [
    {"phaseIndex": 0, "name": "Services & waterproofing", "startDay": 1, "endDay": 35, "plannedDays": 35},
    {"phaseIndex": 1, "name": "Interior base & flooring", "startDay": 10, "endDay": 65, "plannedDays": 56},
    {"phaseIndex": 2, "name": "External works", "startDay": 20, "endDay": 95, "plannedDays": 76},
    {"phaseIndex": 3, "name": "Finishes & joinery", "startDay": 45, "endDay": 115, "plannedDays": 71},
    {"phaseIndex": 4, "name": "Fixtures & commissioning", "startDay": 85, "endDay": 138, "plannedDays": 54},
    {"phaseIndex": 5, "name": "Snagging & handover", "startDay": 120, "endDay": 150, "plannedDays": 31},
]


def build_default_villa_phases(active_upto: int = 0, rework_phase: int | None = None, all_done: bool = False) -> list[dict[str, Any]]:
    phases: list[dict[str, Any]] = []
    for idx, win in enumerate(DEFAULT_PHASE_WINDOWS):
        if all_done:
            status = "COMPLETED"
        elif rework_phase is not None and idx == rework_phase:
            status = "REWORK_REQUIRED"
        elif idx < active_upto:
            status = "COMPLETED"
        elif idx == active_upto:
            status = "IN_PROGRESS"
        else:
            status = "NOT_STARTED"
        phases.append(
            {
                "phaseIndex": idx,
                "name": win["name"],
                "plannedDays": win["plannedDays"],
                "startDay": win["startDay"],
                "endDay": win["endDay"],
                "allowParallel": True,
                "status": status,
            }
        )
    return phases


def reconcile_villa_phases(phases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for i, p in enumerate(phases):
        planned_days = max(1, int(p.get("plannedDays") or 10))
        start_day = max(1, int(p.get("startDay") or 1))
        allow_parallel = bool(p.get("allowParallel", True))
        if not allow_parallel and i > 0:
            prev_end = int(result[i - 1]["endDay"])
            if start_day <= prev_end:
                start_day = prev_end + 1
        end_day = start_day + planned_days - 1
        result.append(
            {
                **p,
                "phaseIndex": int(p.get("phaseIndex", i)),
                "plannedDays": planned_days,
                "startDay": start_day,
                "endDay": end_day,
                "allowParallel": allow_parallel,
                "status": p.get("status") or "NOT_STARTED",
            }
        )
    return result


def _initial_tables() -> dict[str, list[dict[str, Any]]]:
    v101 = "40000000-0000-0000-0000-000000000101"
    v102 = "40000000-0000-0000-0000-000000000102"
    v103 = "40000000-0000-0000-0000-000000000103"
    v104 = "40000000-0000-0000-0000-000000000104"
    v105 = "40000000-0000-0000-0000-000000000105"
    v106 = "40000000-0000-0000-0000-000000000106"

    t1 = "80000000-0000-0000-0000-000000000001"
    t2 = "80000000-0000-0000-0000-000000000002"
    t3 = "80000000-0000-0000-0000-000000000003"
    t4 = "80000000-0000-0000-0000-000000000004"
    t5 = "80000000-0000-0000-0000-000000000005"
    t6 = "80000000-0000-0000-0000-000000000006"

    return {
        "projects": [
            {
                "id": DEFAULT_PROJECT_ID,
                "organization_id": DEFAULT_ORG_ID,
                "name": "Palm Hills Signature Villas — Phase II",
                "project_code": "BL-PHV-02",
                "location": "Dubai Hills South",
                "status": "ACTIVE",
                "target_completion_date": "2027-03-31",
                "created_at": "2026-06-01T08:00:00Z",
                "updated_at": "2026-10-18T08:00:00Z",
            },
            {
                "id": SECOND_PROJECT_ID,
                "organization_id": DEFAULT_ORG_ID,
                "name": "Green Valley Courtyard Villas",
                "project_code": "GVV-2026",
                "location": "Bengaluru North",
                "status": "ACTIVE",
                "target_completion_date": "2027-06-30",
                "created_at": "2026-07-15T08:00:00Z",
                "updated_at": "2026-10-18T08:00:00Z",
            },
        ],
        "villas": [
            {
                "id": v101,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_number": "101",
                "block": "Cluster A · North",
                "villa_type": "4BHK Signature Villa",
                "status": "IN_PROGRESS",
                "progress": 62,
                "work_section": "Interior base & flooring",
                "state_note": "GF & FF internal plaster completed; FF bathroom waterproofing flood-tested and cleared for porcelain tiling.",
                "evidence_file": "villa101-waterproofing-qa.pdf",
                "rework_approved_by": None,
                "target_handover_date": "2027-01-15",
                "updated_at": "2026-10-18T09:15:00Z",
                "phases": build_default_villa_phases(active_upto=1),
            },
            {
                "id": v102,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_number": "102",
                "block": "Cluster A · North",
                "villa_type": "4BHK Signature Villa",
                "status": "REWORK_REQUIRED",
                "progress": 42,
                "work_section": "Services & waterproofing",
                "state_note": "48h ponding test in FF master bath showed dampness near threshold joint. Re-application of 2-coat membrane required before screed.",
                "evidence_file": "villa102-ponding-defect.jpg",
                "rework_approved_by": None,
                "target_handover_date": "2027-01-25",
                "updated_at": "2026-10-18T10:30:00Z",
                "phases": build_default_villa_phases(active_upto=1, rework_phase=0),
            },
            {
                "id": v103,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_number": "103",
                "block": "Cluster B · East",
                "villa_type": "5BHK Courtyard Villa",
                "status": "IN_PROGRESS",
                "progress": 76,
                "work_section": "Finishes & joinery",
                "state_note": "Gypsum false ceiling closure and first coat putty running in parallel across GF & FF.",
                "evidence_file": "villa103-ceiling-clearance.pdf",
                "rework_approved_by": "Manager",
                "target_handover_date": "2027-01-10",
                "updated_at": "2026-10-18T11:00:00Z",
                "phases": build_default_villa_phases(active_upto=3),
            },
            {
                "id": v104,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_number": "104",
                "block": "Cluster B · East",
                "villa_type": "4BHK Signature Villa",
                "status": "COMPLETED",
                "progress": 100,
                "work_section": "Snagging & handover",
                "state_note": "Final DB dressing, deep cleaning, and snag closure verified. Ready for client key handover.",
                "evidence_file": "villa104-handover-pack.pdf",
                "rework_approved_by": "Director",
                "target_handover_date": "2026-12-20",
                "updated_at": "2026-10-18T08:00:00Z",
                "phases": build_default_villa_phases(all_done=True),
            },
            {
                "id": v105,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_number": "105",
                "block": "Cluster C · South",
                "villa_type": "5BHK Courtyard Villa",
                "status": "REWORK_REQUIRED",
                "progress": 36,
                "work_section": "Interior base & flooring",
                "state_note": "FF corridor wall plaster plumb tolerance exceeded by 4mm near bedroom door frame. Flagged for rectification & Manager approval.",
                "evidence_file": "villa105-plaster-check.jpg",
                "rework_approved_by": None,
                "target_handover_date": "2027-02-10",
                "updated_at": "2026-10-18T12:15:00Z",
                "phases": build_default_villa_phases(active_upto=1, rework_phase=1),
            },
            {
                "id": v106,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_number": "106",
                "block": "Cluster C · South",
                "villa_type": "4BHK Signature Villa",
                "status": "IN_PROGRESS",
                "progress": 85,
                "work_section": "Fixtures & commissioning",
                "state_note": "Sanitary ware final fix and AC diffuser balancing 85% complete across GF and FF.",
                "evidence_file": "villa106-mep-test.pdf",
                "rework_approved_by": "Manager",
                "target_handover_date": "2027-01-05",
                "updated_at": "2026-10-18T13:00:00Z",
                "phases": build_default_villa_phases(active_upto=4),
            },
        ],
        "tasks": [
            {
                "id": t1,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v102,
                "name": "Rectify FF bathroom threshold waterproofing membrane",
                "title": "Rectify FF bathroom threshold waterproofing membrane",
                "status": "REWORK_REQUIRED",
                "progress": 40,
                "priority": "CRITICAL",
                "planned_start_at": "2026-10-16T08:00:00Z",
                "planned_end_at": "2026-10-20T17:00:00Z",
            },
            {
                "id": t2,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "name": "Complete FF & GF Statuario porcelain floor tiling & grouting",
                "title": "Complete FF & GF Statuario porcelain floor tiling & grouting",
                "status": "IN_PROGRESS",
                "progress": 65,
                "priority": "HIGH",
                "planned_start_at": "2026-10-14T08:00:00Z",
                "planned_end_at": "2026-10-24T17:00:00Z",
            },
            {
                "id": t3,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v103,
                "name": "Gypsum false ceiling closure & MEP second-fix WIR inspection",
                "title": "Gypsum false ceiling closure & MEP second-fix WIR inspection",
                "status": "IN_PROGRESS",
                "progress": 78,
                "priority": "HIGH",
                "planned_start_at": "2026-10-12T08:00:00Z",
                "planned_end_at": "2026-10-22T17:00:00Z",
            },
            {
                "id": t4,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v105,
                "name": "Re-plaster FF corridor wall & verify 3mm straightedge tolerance",
                "title": "Re-plaster FF corridor wall & verify 3mm straightedge tolerance",
                "status": "BLOCKED",
                "progress": 35,
                "priority": "HIGH",
                "planned_start_at": "2026-10-15T08:00:00Z",
                "planned_end_at": "2026-10-21T17:00:00Z",
            },
            {
                "id": t5,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v106,
                "name": "Install fire-rated main entrance & internal timber doors",
                "title": "Install fire-rated main entrance & internal timber doors",
                "status": "IN_PROGRESS",
                "progress": 85,
                "priority": "MEDIUM",
                "planned_start_at": "2026-10-10T08:00:00Z",
                "planned_end_at": "2026-10-23T17:00:00Z",
            },
            {
                "id": t6,
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v104,
                "name": "Final MEP DB dressing, Megger test & handover dossier",
                "title": "Final MEP DB dressing, Megger test & handover dossier",
                "status": "COMPLETED",
                "progress": 100,
                "priority": "MEDIUM",
                "planned_start_at": "2026-10-01T08:00:00Z",
                "planned_end_at": "2026-10-17T17:00:00Z",
            },
        ],
        "villa_workflow_events": [
            {
                "id": "e0000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "activity_key": "elle-001",
                "revision": 1,
                "status": "COMPLETED",
                "progress": 100,
                "note": "Coping granite works of window, balcony and parapet wall completed and inspected.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-12T09:00:00Z",
            },
            {
                "id": "e0000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "activity_key": "elle-002",
                "revision": 1,
                "status": "COMPLETED",
                "progress": 100,
                "note": "GF plumbing wall work, CPVC pressure test (10 bar) & wall pipe packing passed.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-14T11:30:00Z",
            },
            {
                "id": "e0000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "activity_key": "elle-016",
                "revision": 1,
                "status": "IN_PROGRESS",
                "progress": 65,
                "note": "FF bedroom floor screeding and Statuario porcelain tile laying running in parallel with GF works.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-17T14:20:00Z",
            },
            {
                "id": "e0000000-0000-0000-0000-000000000004",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v102,
                "activity_key": "elle-004",
                "revision": 1,
                "status": "REWORK_REQUIRED",
                "progress": 40,
                "note": "FF master bath waterproofing ponding test showed dampness at threshold fillet. Flagged for rework and Manager approval.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-18T10:30:00Z",
            },
            {
                "id": "e0000000-0000-0000-0000-000000000005",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v103,
                "activity_key": "elle-022",
                "revision": 1,
                "status": "IN_PROGRESS",
                "progress": 78,
                "note": "Gypsum ceiling framing & MR boarding running in parallel with MEP 2nd fix.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-18T11:00:00Z",
            },
            {
                "id": "e0000000-0000-0000-0000-000000000006",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v105,
                "activity_key": "elle-012",
                "revision": 1,
                "status": "REWORK_REQUIRED",
                "progress": 35,
                "note": "FF corridor plaster plumb deviation (4mm) flagged for rectification before putty.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-18T12:15:00Z",
            },
            {
                "id": "e0000000-0000-0000-0000-000000000007",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v106,
                "activity_key": "elle-034",
                "revision": 1,
                "status": "IN_PROGRESS",
                "progress": 85,
                "note": "Sanitary fixtures and concealed cistern trim installation 85% complete.",
                "actor_id": ROLE_METADATA["Engineer"]["user_id"],
                "created_at": "2026-10-18T13:00:00Z",
            },
        ],
        "work_sections": [
            {"id": f"50000000-0000-0000-0000-00000000000{idx + 1}", "organization_id": DEFAULT_ORG_ID, "name": win["name"], "active": True}
            for idx, win in enumerate(DEFAULT_PHASE_WINDOWS)
        ],
        "vendors": [
            {
                "id": "70000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "company_name": "Al-Futtaim MEP & Finishing Contracting",
                "category": "MEP & Finishing",
                "status": "ACTIVE",
                "active": True,
            },
            {
                "id": "70000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "company_name": "Gulf Horizon Joinery & Doors LLC",
                "category": "Joinery & Acoustic Doors",
                "status": "ACTIVE",
                "active": True,
            },
            {
                "id": "70000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "company_name": "Emirates Marble & Ceramics Co.",
                "category": "Tiling, Marble & Granite",
                "status": "ACTIVE",
                "active": True,
            },
            {
                "id": "70000000-0000-0000-0000-000000000004",
                "organization_id": DEFAULT_ORG_ID,
                "company_name": "Apex Waterproofing & Screed Systems",
                "category": "Waterproofing & Thermal Insulation",
                "status": "ACTIVE",
                "active": True,
            },
            {
                "id": "70000000-0000-0000-0000-000000000005",
                "organization_id": DEFAULT_ORG_ID,
                "company_name": "Crestline Facade & Glazing Works",
                "category": "Aluminium Windows & Glazing",
                "status": "ACTIVE",
                "active": True,
            },
        ],
        "employees": [
            {
                "id": "60000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "full_name": "Arjun Menon (Executive Director)",
                "employee_code": "DIR-001",
                "status": "ACTIVE",
                "role_id": ROLE_METADATA["Director"]["role_id"],
            },
            {
                "id": "60000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "full_name": "Nadia Al-Mansoor (Project Manager)",
                "employee_code": "MGR-104",
                "status": "ACTIVE",
                "role_id": ROLE_METADATA["Manager"]["role_id"],
            },
            {
                "id": "60000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "full_name": "Karthik Nair (Senior Site Engineer)",
                "employee_code": "ENG-208",
                "status": "ACTIVE",
                "role_id": ROLE_METADATA["Engineer"]["role_id"],
            },
            {
                "id": "60000000-0000-0000-0000-000000000004",
                "organization_id": DEFAULT_ORG_ID,
                "full_name": "Zayd Al-Harthi (MEP Field Engineer)",
                "employee_code": "ENG-212",
                "status": "ACTIVE",
                "role_id": ROLE_METADATA["Engineer"]["role_id"],
            },
            {
                "id": "60000000-0000-0000-0000-000000000005",
                "organization_id": DEFAULT_ORG_ID,
                "full_name": "Priya Deshmukh (QA/QC Inspection Lead)",
                "employee_code": "ENG-219",
                "status": "ACTIVE",
                "role_id": ROLE_METADATA["Engineer"]["role_id"],
            },
            {
                "id": "60000000-0000-0000-0000-000000000006",
                "organization_id": DEFAULT_ORG_ID,
                "full_name": "Rohan Kulkarni (Planning & Controls Manager)",
                "employee_code": "MGR-109",
                "status": "ACTIVE",
                "role_id": ROLE_METADATA["Manager"]["role_id"],
            },
        ],
        "roles": [
            {
                "id": meta["role_id"],
                "organization_id": DEFAULT_ORG_ID,
                "name": role_name,
                "description": meta["description"],
            }
            for role_name, meta in ROLE_METADATA.items()
        ],
        "attachments": [
            {
                "id": "a0000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "entity_type": "VILLA_DRAWING · Villa 101–106 IFC Finishing Layout Rev 04",
                "mime_type": "application/pdf",
                "size_bytes": 4820480,
                "uploaded_at": "2026-10-18 09:15",
            },
            {
                "id": "a0000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "entity_type": "QA_FLOOD_TEST · Villa 101 Wet Area 48h Ponding Certificate",
                "mime_type": "application/pdf",
                "size_bytes": 1458176,
                "uploaded_at": "2026-10-17 16:40",
            },
            {
                "id": "a0000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "entity_type": "REWORK_NCR · Villa 102 FF Bath Threshold Dampness Report",
                "mime_type": "image/jpeg",
                "size_bytes": 2314240,
                "uploaded_at": "2026-10-18 10:30",
            },
            {
                "id": "a0000000-0000-0000-0000-000000000004",
                "organization_id": DEFAULT_ORG_ID,
                "entity_type": "MEP_SCHEMATIC · Villa 103 Above-Ceiling Reflected Ceiling Plan",
                "mime_type": "application/pdf",
                "size_bytes": 6123520,
                "uploaded_at": "2026-10-16 14:10",
            },
            {
                "id": "a0000000-0000-0000-0000-000000000005",
                "organization_id": DEFAULT_ORG_ID,
                "entity_type": "HANDOVER_DOSSIER · Villa 104 Final Commissioning & Key Pack",
                "mime_type": "application/pdf",
                "size_bytes": 8945664,
                "uploaded_at": "2026-10-18 08:00",
            },
        ],
        "snags": [
            {
                "id": "94000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v102,
                "task_id": t1,
                "title": "FF Master Bath Threshold Waterproofing Dampness",
                "description": "48h ponding test revealed moisture seepage at doorway upstand fillet; requires 2-coat cementitious membrane re-application and Manager rework approval.",
                "severity": "CRITICAL",
                "status": "REWORK_REQUIRED",
                "due_at": "2026-10-20T17:00:00Z",
                "created_at": "2026-10-18T10:30:00Z",
            },
            {
                "id": "94000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v105,
                "task_id": t4,
                "title": "FF Corridor Wall Plaster Plumb Deviation (4mm)",
                "description": "Internal cement plaster exceeds 3mm straightedge tolerance adjacent to bedroom B2 door frame.",
                "severity": "HIGH",
                "status": "IN_PROGRESS",
                "due_at": "2026-10-22T17:00:00Z",
                "created_at": "2026-10-18T12:15:00Z",
            },
            {
                "id": "94000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "task_id": t2,
                "title": "Minor Tile Lippage Near GF Kitchen Threshold",
                "description": "Two porcelain tiles at GF kitchen doorway require re-bedding flush with marble saddle threshold.",
                "severity": "MEDIUM",
                "status": "IN_PROGRESS",
                "due_at": "2026-10-21T17:00:00Z",
                "created_at": "2026-10-17T14:00:00Z",
            },
        ],
        "inspections": [
            {
                "id": "95000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "task_id": t2,
                "inspection_type": "Wet Area Waterproofing 48h Flood Test (Villa 101)",
                "notes": "Zero leakage observed after 48-hour flood test across GF & FF wet rooms. Cleared for protection screed and tiling.",
                "status": "PASSED",
                "scheduled_at": "2026-10-16T10:00:00Z",
            },
            {
                "id": "95000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v102,
                "task_id": t1,
                "inspection_type": "Wet Area Waterproofing 48h Flood Test (Villa 102)",
                "notes": "Threshold dampness detected in FF master bath; flagged as REWORK_REQUIRED awaiting Manager sign-off.",
                "status": "REWORK_REQUIRED",
                "scheduled_at": "2026-10-18T10:30:00Z",
            },
            {
                "id": "95000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v103,
                "task_id": t3,
                "inspection_type": "Above-Ceiling MEP 2nd Fix & Gypsum Framing WIR",
                "notes": "Joint inspection with MEP and gypsum trade supervisors scheduled prior to ceiling board closure.",
                "status": "PENDING",
                "scheduled_at": "2026-10-20T14:00:00Z",
            },
        ],
        "materials": [
            {
                "id": "91000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "quantity_on_hand": 18,
                "reorder_level": 25,
                "unit_cost": 145.0,
                "updated_at": "2026-10-18T09:00:00Z",
                "products": {
                    "sku": "WP-CEM-20",
                    "name": "2-Component Cementitious Waterproofing Membrane (20kg Kit)",
                    "category": "Waterproofing",
                    "unit": "kits",
                },
            },
            {
                "id": "91000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "quantity_on_hand": 1420,
                "reorder_level": 400,
                "unit_cost": 68.5,
                "updated_at": "2026-10-18T09:00:00Z",
                "products": {
                    "sku": "TL-POR-60120",
                    "name": "600x1200mm Statuario Porcelain Floor Tile",
                    "category": "Tiling & Marble",
                    "unit": "sqm",
                },
            },
            {
                "id": "91000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "quantity_on_hand": 310,
                "reorder_level": 120,
                "unit_cost": 32.0,
                "updated_at": "2026-10-18T09:00:00Z",
                "products": {
                    "sku": "GYP-MR-125",
                    "name": "12.5mm Moisture-Resistant Gypsum Board",
                    "category": "Gypsum & Ceilings",
                    "unit": "sheets",
                },
            },
            {
                "id": "91000000-0000-0000-0000-000000000004",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "quantity_on_hand": 14,
                "reorder_level": 20,
                "unit_cost": 210.0,
                "updated_at": "2026-10-18T09:00:00Z",
                "products": {
                    "sku": "PNT-ACR-25",
                    "name": "Low-VOC Acrylic Interior Wall Putty & Primer (25L Drum)",
                    "category": "Painting",
                    "unit": "drums",
                },
            },
            {
                "id": "91000000-0000-0000-0000-000000000005",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "quantity_on_hand": 42,
                "reorder_level": 15,
                "unit_cost": 590.0,
                "updated_at": "2026-10-18T09:00:00Z",
                "products": {
                    "sku": "MEP-SAN-01",
                    "name": "Concealed Cistern & Wall-Hung WC Frame Set",
                    "category": "Sanitary & MEP",
                    "unit": "sets",
                },
            },
        ],
        "purchase_orders": [
            {
                "id": "93000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "po_number": "PO-2026-0104 · Sika 2-Coat Waterproofing Membrane Replenishment (60 Kits)",
                "status": "APPROVED",
                "ordered_at": "2026-10-15T09:00:00Z",
                "requested_at": "2026-10-15T09:00:00Z",
                "expected_at": "2026-10-21",
            },
            {
                "id": "93000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "po_number": "PO-2026-0108 · RAK Statuario Porcelain Tile Batch B (600 sqm)",
                "status": "IN_PROGRESS",
                "ordered_at": "2026-10-16T11:30:00Z",
                "requested_at": "2026-10-16T11:30:00Z",
                "expected_at": "2026-10-25",
            },
            {
                "id": "93000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "po_number": "PO-2026-0112 · Knauf MR Gypsum Board & Framing Channels",
                "status": "COMPLETED",
                "ordered_at": "2026-10-08T08:00:00Z",
                "requested_at": "2026-10-08T08:00:00Z",
                "expected_at": "2026-10-14",
            },
        ],
        "work_inspection_requests": [
            {
                "id": "94100000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "description": "WIR-101 · Villa 101 GF & FF Wet Room Flood Test Clearance",
                "status": "APPROVED",
                "revision": "Rev 02",
                "created_at": "2026-10-16T10:00:00Z",
            },
            {
                "id": "94100000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "description": "WIR-102 · Villa 102 FF Master Bath Waterproofing Re-Inspection",
                "status": "REWORK_REQUIRED",
                "revision": "Rev 01",
                "created_at": "2026-10-18T10:30:00Z",
            },
        ],
        "villa_documents": [
            {
                "id": "94200000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "document_type": "IFC-AR-101 · GF & FF Tile Setting-Out & Threshold Details",
                "approval_status": "APPROVED",
                "version": "Rev 04",
                "uploaded_at": "2026-10-18T09:00:00Z",
            },
            {
                "id": "94200000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "document_type": "IFC-MEP-204 · Reflected Ceiling Plan & Diffuser Co-ordination",
                "approval_status": "APPROVED",
                "version": "Rev 03",
                "uploaded_at": "2026-10-17T09:00:00Z",
            },
        ],
        "notifications": [
            {
                "id": "94300000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "user_id": ROLE_METADATA["Director"]["user_id"],
                "type": "REWORK_REQUIRED",
                "title": "Villa 102 flagged for Waterproofing Rework",
                "body": "Site Engineer Karthik Nair uploaded REWORK_REQUIRED state on Villa 102 (Services & waterproofing). Manager or Director approval required.",
                "read_at": None,
                "created_at": "2026-10-18T10:30:00Z",
            },
            {
                "id": "94300000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "user_id": ROLE_METADATA["Manager"]["user_id"],
                "type": "REWORK_REQUIRED",
                "title": "Villa 105 flagged for FF Corridor Plaster Rectification",
                "body": "Plumb deviation of 4mm recorded on FF corridor wall in Villa 105. Awaiting rectification and Manager rework approval.",
                "read_at": None,
                "created_at": "2026-10-18T12:15:00Z",
            },
            {
                "id": "94300000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "user_id": ROLE_METADATA["Engineer"]["user_id"],
                "type": "BLOCKED",
                "title": "Reorder Alert: Waterproofing Membrane & Acrylic Putty",
                "body": "2-Component Waterproofing Membrane (18 kits < 25 buffer) and Acrylic Wall Putty (14 drums < 20 buffer) are below reorder levels.",
                "read_at": None,
                "created_at": "2026-10-18T09:00:00Z",
            },
        ],
        "safety_observations": [
            {
                "id": "97000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v103,
                "observation_type": "OBSERVATION",
                "severity": "MEDIUM",
                "status": "ACTIONED",
                "description": "Mobile scaffold tower in Villa 103 double-height lobby lacked toe-board on east side during gypsum framing.",
                "corrective_action": "Installed toe-board immediately and green-tagged scaffold after HSE supervisor inspection.",
                "created_at": "2026-10-18T08:45:00Z",
            },
            {
                "id": "97000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "observation_type": "TOOLBOX_TALK",
                "severity": "LOW",
                "status": "CLOSED",
                "description": "Conducted morning toolbox talk on wet-cut tile saw blade guards, FFP2 dust masks, and temporary distribution board RCD checks.",
                "corrective_action": "22 tiling and masonry operatives attended and signed briefing log.",
                "created_at": "2026-10-18T07:30:00Z",
            },
        ],
        "daily_reports": [
            {
                "id": "96000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v101,
                "report_date": "2026-10-18",
                "weather": "Clear, 31°C · Light Breeze",
                "workforce_count": 46,
                "summary": "Completed 85 sqm of Statuario porcelain floor tiling in Villa 101 GF & FF in parallel; gypsum ceiling boarding advanced to 78% in Villa 103.",
                "constraints": "Villa 102 FF master bath on rework hold pending waterproofing membrane curing and Manager rework sign-off.",
                "created_at": "2026-10-18T17:00:00Z",
            },
            {
                "id": "96000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v104,
                "report_date": "2026-10-17",
                "weather": "Sunny, 32°C",
                "workforce_count": 42,
                "summary": "Completed final DB dressing, insulation resistance testing, and deep cleaning in Villa 104. Handover readiness score updated to 98%.",
                "constraints": None,
                "created_at": "2026-10-17T17:00:00Z",
            },
        ],
        "handover_packages": [
            {
                "id": "98000000-0000-0000-0000-000000000001",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v104,
                "customer_name": "Mr. & Mrs. Tariq Al-Ghurair (Villa 104)",
                "status": "READY",
                "readiness_score": 98,
                "target_date": "2026-12-20",
                "notes": "All MEP test certificates, O&M manuals, and de-snagging sign-offs uploaded.",
            },
            {
                "id": "98000000-0000-0000-0000-000000000002",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v106,
                "customer_name": "Dr. Ayesha Siddiqui (Villa 106)",
                "status": "IN_REVIEW",
                "readiness_score": 85,
                "target_date": "2027-01-05",
                "notes": "Final sanitary pressure test complete; awaiting AC air-balancing certificate.",
            },
            {
                "id": "98000000-0000-0000-0000-000000000003",
                "organization_id": DEFAULT_ORG_ID,
                "project_id": DEFAULT_PROJECT_ID,
                "villa_id": v103,
                "customer_name": "Mr. Kabir Malhotra (Villa 103)",
                "status": "IN_REVIEW",
                "readiness_score": 76,
                "target_date": "2027-01-10",
                "notes": "Joinery and painting 2nd fix running in parallel across GF & FF.",
            },
        ],
        "audit_logs": [],
        "ai_runs": [],
    }


TABLES: dict[str, list[dict[str, Any]]] = _initial_tables()

SCHEDULE_CONFIG: dict[str, Any] = {
    "customPhases": [],
    "customActivities": [],
    "activityOverrides": {},
}


def _match_filter(row: dict[str, Any], key: str, expr: str) -> bool:
    if key in {"offset", "limit", "select", "order"}:
        return True
    val = row.get(key)
    if expr.startswith("eq."):
        target = expr[3:]
        return str(val) == target
    if expr == "is.null":
        return val is None
    if expr.startswith("not.in.(") and expr.endswith(")"):
        excluded = {item.strip() for item in expr[8:-1].split(",")}
        return str(val) not in excluded
    return True


def list_rows(
    table: str,
    organization_id: str | None = None,
    filters: dict[str, str] | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    rows = list(TABLES.get(table, []))
    if organization_id and table != "notifications":
        rows = [r for r in rows if str(r.get("organization_id", organization_id)) == str(organization_id)]
    if filters:
        for k, v in filters.items():
            if table == "notifications" and k == "user_id":
                # Show all organization notifications in local demo regardless of role switch
                continue
            rows = [r for r in rows if _match_filter(r, k, v)]
    offset = int(filters.get("offset", "0")) if filters and "offset" in filters else 0
    return rows[offset : offset + limit]


def get_row(table: str, record_id: str) -> dict[str, Any] | None:
    for r in TABLES.get(table, []):
        if str(r.get("id")) == str(record_id):
            return r
    return None


def create_row(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    rows = TABLES.setdefault(table, [])
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(payload.get("id") or uuid4()),
        "created_at": payload.get("created_at") or now,
        "updated_at": now,
        **payload,
    }
    if table == "tasks" and "title" not in record and "name" in record:
        record["title"] = record["name"]
    rows.insert(0, record)
    return record


def update_row(table: str, record_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    row = get_row(table, record_id)
    if not row:
        return None
    row.update(payload)
    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    return row
