# BuildLens

Construction operations workspace for the BuildLens hackathon. BuildLens connects field execution, multi-phase finishing schedules, quality governance, supply chain, and executive leadership into a unified operational loop.

The repository separates the Next.js client, FastAPI business layer, and Firestore-backed data access. No deployment platform is configured in this repository.

**Source repository:** [github.com/Anajrajeev/BuildLens](https://github.com/Anajrajeev/BuildLens)

---

## Architecture & Layout

```
BuildLens/
├── frontend/               # Next.js 15 App Router UI, Tailwind CSS, PWA shell & typed API client
│   ├── app/                # Next.js pages (/workspace, /workspace/profile, landing page, manifest)
│   ├── components/         # Brand logo, workflow board, operational modules, and design system UI
│   ├── lib/                # Typed API client, RBAC role definitions, and offline sync utilities
│   └── public/             # PWA assets, service worker, and brand identity marks
├── backend/                # FastAPI application, domain services, and permissions engine
│   ├── app/api/v1/         # Versioned REST endpoints (auth, operations, people, platform, projects, workflow)
│   ├── app/core/           # RBAC permissions, security dependencies, config, and seed data store
│   ├── app/repositories/   # Repository layer for platform, project, and task persistence
│   ├── app/services/       # Business domain logic (platform aggregation, workflow, AI briefing)
│   └── tests/              # Pytest test suite (health, platform, workflow, and RBAC enforcement)
├── firebase/               # Firestore security rules and historical SQL migration artifacts
└── docs/                   # Architectural reference and system documentation
```

---

## Role-Based Access Control (RBAC)

BuildLens enforces granular, role-based authorization across the stack. The platform defines three distinct operational roles with strict permission boundaries:

| Role | Badge | Key Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **Director** | `Full Access` | **Executive Command**: Full unrestricted access across all 14 modules. Can register new villas, configure phase scheduling windows, manage personnel/roles, override site states, and approve rework holds. |
| **Manager** | `Rework Approval` | **Quality & Governance**: Supervises quality gates and schedule remediation. Reviews flagged defects and unit notes, inspects site evidence, and formally approves rework to clear holds. Cannot upload raw field states. |
| **Engineer** | `State Uploads` | **Field Operations**: On-site execution specialist. Uploads live villa states (`IN_PROGRESS`, `COMPLETED`, `BLOCKED`, `REWORK_REQUIRED`) in the Villas module, logs unit completion metrics, and flags defects. Cannot clear rework holds. |

Authentication supports Firebase Authentication tokens or the development header `X-BuildLens-Role: Director | Manager | Engineer` for role-switching in preview mode.

---

## Operational Modules

The workspace organizes 14 connected operational modules across four functional groups:

### 1. Overview
- **Dashboard**: Real-time project KPIs, progress roll-ups, attention signals (overdue tasks, blocked items, open snags, low inventory), and mutation audit records.
- **Today**: Field agenda, task progression, team assignments, dependencies, and live task timer actions.
- **AI project intelligence**: Morning site briefing, schedule-risk radar, and evidence-grounded project Q&A. Responses cite project records and fall back to deterministic results when Gemini is unavailable.
- **AI drafts**: Daily reports, vendor follow-ups, snag descriptions, and handover notes are drafts only; users review and approve every mutation.

### 2. Execution
- **Villas**: Unit registry, status uploads, defect flagging, and multi-phase finishing schedules.
- **Work Sections**: Villa-level and room-level work breakdown structures, progress history, and task dependencies.
- **People**: Organization directory, employee codes, role assignments, and permission profiles.
- **Documents**: Work Inspection Requests (WIR), architectural and structural drawing revisions, and document registration.
- **Reports**: Daily site logs, weather conditions, manpower counts, and work summaries.

### 3. Supply Chain
- **Materials**: Material catalog, real-time stock levels, low-inventory alerts, and stock movement logs.
- **Procurement**: Purchase orders, itemized line items, delivery status tracking, and supplier matching.
- **Vendors**: Subcontractor and vendor commitments, trade categorizations, and performance scorecards.

### 4. Assurance
- **Quality**: Inspections, reusable checklist templates, snag lists, and formal rework approval gates.
- **Safety**: Safety observations, severity ratings, corrective actions, and site incident logs.
- **Handover**: Unit readiness criteria, testing & commissioning records, and formal handover packages.

---

## Villa Phase Scheduling Engine

BuildLens includes a multi-phase finishing schedule engine for villa delivery:

1. **Services & waterproofing** (Days 1–35)
2. **Interior base & flooring** (Days 10–65)
3. **External works** (Days 20–95)
4. **Finishes & joinery** (Days 45–115)
5. **Fixtures & commissioning** (Days 85–138)
6. **Snagging & handover** (Days 120–150)

Phases support parallel execution or sequential dependencies with automatic day-window reconciliation. When rework is flagged on an active phase, formal Manager or Director approval is required before the unit or phase can transition to completion.

---

## Brand Identity

The BuildLens brand identity features a modern geometric mark uniting:
- **Build**: Upward-reaching architectural towers and structural facets.
- **Lens**: Precision optical inspection aperture representing clarity and site verification.
- **Palette**: Deep Architectural Teal (`#0f766e`, `#14b8a6`, `#0e272b`) designed via Nano Banana.

---

## Local Development

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Git

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -e .[dev]
# Configure backend/.env with DATA_BACKEND=firestore, FIREBASE_PROJECT_ID,
# and GEMINI_KEY. Keep credentials in ignored local files.
node ../scripts/firebase-local-credentials.cjs
python ../scripts/bootstrap-firestore.py
uvicorn app.main:app --reload --port 8101
```

Run backend tests:
```bash
pytest backend/tests
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The UI will be accessible at `http://localhost:3000`.

### 3. Firestore Rules

The browser accesses data only through FastAPI; Firebase Authentication is used for sign-in. For local development, sign in with Firebase CLI before creating the gitignored local credential file:
```bash
firebase login
node scripts/firebase-local-credentials.cjs
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8101` in `frontend/.env.local` before starting the UI.
