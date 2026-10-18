# BuildLens → FalconBrick parity and AI-lead execution plan

**Prepared:** 29 September 2026  
**Inputs:** the supplied BuildLens requirements, the current repository, and the FalconBrick competitive-intelligence review.  
**Purpose:** determine how much is genuinely built, what FalconBrick parity requires, and how BuildLens can become materially better through reliability, villa-specific depth, and AI.

> “Implemented” in this report means a usable, authorized, tested workflow—not merely a database table or a styled placeholder. FalconBrick capabilities are reconstructed from public sources; they are not the result of access to a private customer tenant.

## Executive conclusion

BuildLens has a promising **data and security skeleton**, but it is still an early product foundation rather than a FalconBrick-level construction operating system.

- The repository contains **57 normalized PostgreSQL tables**, covering nearly every entity named in the supplied requirements.
- The backend exposes only **15 route handlers**, most of them list/create endpoints.
- The frontend has only three application routes: sign-in, one combined workspace, and profile.
- Only projects, villas, people, work sections, vendors, tasks/timers at API level, document listing, and basic counts have any executable product surface.
- No complete field execution loop exists: a field user cannot receive work, work offline, capture evidence, submit progress, raise an inspection, create a snag, rectify it, and obtain approval.
- There is currently no AI implementation.

### Honest maturity estimate

| View | Current maturity | Meaning |
|---|---:|---|
| Supplied architecture/data-model requirement | **55–65%** | Most tables and boundaries exist, but several non-negotiable security, testing, typing, and service-layer requirements are incomplete. |
| FalconBrick feature parity | **12–18%** | The nouns exist in the schema; the operational workflows, mobile/offline behaviour, analytics, and implementation system largely do not. |
| Production readiness | **10–15%** | Builds succeed, but security tests are placeholders, integration coverage is almost absent, migrations are not proven against an environment, and observability/offline/storage/jobs are missing. |
| AI moat | **0–3%** | The schema is AI-friendly, but no model gateway, retrieval, evaluation, inference workflow, or AI user experience exists. |

With a focused team of 8–10 people, a credible field product can be piloted in **12–16 weeks**, FalconBrick functional parity can be approached in **9–12 months**, and a demonstrably better AI-assisted product can be reached in **12–15 months**. A four-person engineering team should plan for roughly **18–24 months** for the same scope.

## 1. Current BuildLens implementation audit

### 1.1 What is genuinely strong

1. **Correct application boundary:** Next.js and FastAPI are separate applications. Privileged secrets remain server-side.
2. **Normalized domain model:** the schema covers organizations, projects, villa hierarchy, work taxonomy, tasks, assignments, time events, progress, delays, vendors, materials, drawings, inspections, snags, notifications, activity events, and audit logs.
3. **Tenant field coverage:** all operational records carry `organization_id`.
4. **Authentication foundation:** FastAPI validates Cloud SQL JWTs using JWKS and derives the user identity rather than accepting it from request bodies.
5. **Configurable permissions exist:** roles, permissions, and role-permission mappings are represented as data.
6. **Append-only concepts exist:** progress, task-time events, activity events, and audit logs are modelled separately from current state.
7. **Baseline engineering health:** the frontend type-check and production build pass; the existing backend test passes; CI runs type-check, build, lint, and tests on pull requests.
8. **Relevant product focus:** villa hierarchy is a credible wedge that is narrower and more defensible than claiming every construction segment immediately.

### 1.2 What is only schema-ready

The following capabilities have tables but no complete API/UI workflow:

- villa levels, rooms, measurements, specifications, and features;
- teams, reporting lines, project/villa assignments, and multi-role employees;
- work categories, subcategories, and task templates;
- task assignments, dependencies, progress updates, and timer lifecycle;
- vendor contacts, projects, villas, work assignments, contracts, commitments, and performance;
- products, stock, suppliers, purchase orders, deliveries, allocations, and usage;
- plan versions and drawing revisions;
- inspections, inspection items, quality issues, and snags;
- delay reasons, events, and attributions;
- notifications, activity events, and audit logs.

Schema-ready is valuable, but it is normally only 10–25% of the work for an operational feature. Validation, authorization, transactions, workflow rules, APIs, offline behaviour, UI, audit events, notifications, reporting, and tests remain.

### 1.3 What is usable today

| Capability | Current implementation | Limit |
|---|---|---|
| Sign in | Cloud SQL password login | No password recovery, invitation acceptance, MFA, device/session management, or onboarding. |
| Session context | `/auth/me` returns organization, role, permissions, and employee identity | Multi-organization switching is not implemented in the UI. |
| Projects | List/create backend APIs | No project creation UI, detail screen, editing, archive, portfolio selection, or scoped list enforcement. |
| Villas | List/create and basic cards | Only the first project is loaded; no detail, hierarchy, bulk import, progress, rooms, plans, or assignments. |
| Tasks | List/create/timer-create APIs | No task UI and no status/progress/timer lifecycle endpoints. |
| People | Admin-only list/create | Authorization is hard-coded to one email; creation is not transactional; assignments selected in the UI are not exposed. |
| Work sections | List/create | No categories, subcategories, templates, sequences, or edit/archive. |
| Vendors | List/create | No contacts, contracts, commitments, work allocation, scorecards, or portal. |
| Documents | Attachment metadata list | No upload, download, preview, classification enforcement, signed URLs, versioning, or acknowledgement. |
| Reports | Villa/task counts | Not operational reporting or BI. |

### 1.4 Critical technical gaps

#### Authorization leakage through the trusted backend

The backend uses a privileged Cloud SQL key, which bypasses RLS. Therefore every repository/service query must independently enforce scope. Today:

- project listing returns every project in the organization;
- task listing returns every task in the organization;
- villa listing requires `villa.read.all` rather than supporting assigned scope;
- several routes use direct Cloud SQL REST calls instead of scope-aware repositories.

This means the RLS functions can be correct while the actual API still overexposes records. This is the highest-priority issue.

#### RLS is broad and insufficiently tested

- Only projects, villas, and tasks receive scope-specific policies.
- Most tables use organization-membership `FOR ALL` policies. An authenticated browser user who knows the Cloud SQL endpoint could potentially write directly to those tables, bypassing FastAPI business rules.
- The RLS test file contains two unconditional `ok(true, ...)` assertions. It does not prove tenant isolation or assignment scoping.
- Cross-entity tenant consistency is not guaranteed. A row can potentially carry organization A while referencing a project/vendor/villa from organization B unless composite foreign keys or validation triggers prevent it.

#### The stated architecture is not consistently followed

- People, projects/villas, and operations routes contain persistence and business logic directly in route modules.
- Frontend types are handwritten rather than generated from OpenAPI/database definitions.
- There is no unified transaction/outbox/audit mechanism.
- No background-job system exists for reports, media, notification delivery, sync reconciliation, or AI.

#### Operational foundations are missing

- no service worker, manifest, IndexedDB store, offline queue, or conflict model;
- no object-storage upload/download authorization;
- no idempotency keys for retryable field writes;
- no reliable notifications channel;
- no observability, product analytics, crash reporting, sync telemetry, or SLOs;
- no database migration CI or verified local Cloud SQL configuration;
- only one backend health test and placeholder RLS tests;
- no API integration tests, browser tests, accessibility tests, or offline tests.

### 1.5 Requirement-by-requirement assessment

| Supplied requirement | Status | Assessment |
|---|---|---|
| Separate frontend/backend | Strong | Correctly separated. |
| Service/repository architecture | Partial | Present for tasks/projects, bypassed elsewhere. |
| Typed frontend/backend API | Weak | Pydantic responses exist, but no generated client or shared contract. |
| Cloud SQL as OLTP truth | Designed | Migrations exist; environment application is not proven in-repo. |
| Multi-tenancy | Partial | Tenant columns and membership exist; scope and relational tenant integrity need hardening. |
| Configurable RBAC | Partial | Data model exists; hard-coded admin email and inconsistent permission vocabulary remain. |
| Scope-based authorization | Weak | Database functions exist for three entities; API reads do not consistently apply them. |
| Role-adaptive UX | Minimal | Only admin/non-admin differences; no worker, foreman, manager, or director experiences. |
| RLS for exposed tables | Present but unproven | Enabled broadly, but many policies are too permissive and tests are placeholders. |
| Data classification | Partial | Enum and selected entity fields exist; enforcement on access/export/storage is absent. |
| Immutable audit trail | Model only | Table exists, but application actions do not write audit records. |
| Mobile-first worker UI | Prototype styling only | No actual worker workflow is routed or connected. |
| PWA/offline queue | Absent | Required for field parity. |
| Production testing | Very weak | Build passes; meaningful domain/security coverage is absent. |

## 2. FalconBrick parity matrix

Scoring: **0 absent · 1 schema/stub · 2 basic CRUD · 3 usable workflow · 4 production-grade · 5 differentiated**.

| Capability | FalconBrick public maturity | BuildLens now | Parity work |
|---|---:|---:|---|
| Project/portfolio hierarchy | 4 | 2 | Project selector; project → phase/block → villa → level → room; bulk import; filters and permissions. |
| Daily field Agenda | 4 | 0 | Role-scoped Today screen, priorities, blockers, due work, route between locations, quick actions. |
| Task planning/execution | 4 | 1 | Full state machine, assignment, quantities, dependencies, evidence, comments, approvals, history. |
| Offline/zero-network operation | 4 | 0 | Local database, cached scope, mutation queue, idempotency, retries, conflict resolution, media sync. |
| Progress/DPR | 4 | 1 | Structured daily progress, quantities, labour, photos, weather, notes, approval, DPR export. |
| Photo evidence/markup | 4 | 0 | Camera capture, timestamp/GPS policy, compression, annotation, resumable upload, evidence lineage. |
| Inspections/checklists | 4 | 1 | Versioned templates, runner, mandatory evidence, signatures, pass/fail/N/A, approval. |
| Snag/de-snag/NCR | 4 | 1 | Capture → assign → rectify → verify → close, SLA, severity, recurrence, root-cause analysis. |
| Safety audits | 3 | 0–1 | Safety observations, toolbox talks, incidents, permits, corrective actions, escalation. |
| Activity sequencing | 4 | 1 | Dependency enforcement, readiness gates, blocked reasons, look-ahead planning. |
| Contractor WIR | 4 | 1 | Dedicated request/inspection/approval/rejection/rework workflow and contractor view. |
| Contractor performance | 4 | 1 | Computed scorecards from timeliness, quality, rework, response time, safety, and commitments. |
| Contractor billing | 3–4 | 0 | BOQ/contract items, measured work, RA bills, certification, retention, variations, payment state. |
| Materials/procurement | 3–4 | 1 | PO line items, receipts, inspections, stock ledger, issues/returns, consumption, variance, alerts. |
| Drawings/document control | 3–4 | 1 | Upload/preview, revisions, transmittals, distribution, acknowledgements, superseded watermark. |
| Alerts/escalations | 4 | 1 | Rules engine, notification preferences, email/push/in-app delivery, escalation and acknowledgement. |
| Management dashboards | 4 | 1 | Portfolio → project → villa drill-down; schedule, quality, material, vendor, and risk views. |
| Predictive analytics | 3 | 0 | Explainable risk models using dependencies, production rates, resource/material signals. |
| Handover | 4 | 0–1 | Readiness rules, punch list, customer inspection, signatures, certificates, asset/document pack. |
| Customer-success configurator | 4 | 1 | Template library, spreadsheet import, workflow builder, rollout validation, training mode. |
| Enterprise integrations | 2–3 | 0 | ERP/accounting, scheduling, Autodesk/ACC, email/webhooks, SSO, export APIs. |
| Mobile reliability transparency | Public weakness | 0 | BuildLens opportunity: visible sync, no-lost-draft guarantee, data/battery budgets, published SLOs. |
| AI operating layer | No strong public evidence | 0 | BuildLens’s intended moat; must be embedded in work, evidence, and decisions. |

### Parity is not “build all 57 tables into CRUD screens”

FalconBrick’s practical advantage is a closed operational loop:

```text
Plan → assign → execute → prove → inspect → correct → approve → analyze → hand over
```

BuildLens should measure parity by whether this loop works reliably for a real site team with poor connectivity—not by navigation-item count.

## 3. Product strategy: where BuildLens should be better

### 3.1 Positioning

> **BuildLens is the AI-assisted field-to-control-room operating system for villa and residential construction. It turns plans, site evidence, quality checks, materials, and contractor commitments into the next best action—without losing work when connectivity disappears.**

Do not position it as “FalconBrick plus AI.” The sharper wedge is:

1. deeper villa/low-rise workflows;
2. measurably more reliable field capture;
3. explainable AI that converts operational evidence into actions;
4. modern security, auditability, and data portability;
5. faster implementation through AI-assisted configuration.

### 3.2 The AI moat must be operational, not conversational

A generic chat panel is easy to copy and will not create durable advantage. The moat should be a proprietary, permission-aware **construction operating graph** connecting:

```text
Project / villa / room
↕
Task / dependency / checklist / drawing revision
↕
Person / crew / vendor / material / commitment
↕
Photo / voice note / measurement / inspection / snag
↕
Outcome / delay / rework / cost / handover
```

AI becomes defensible when BuildLens accumulates clean links between planned work, actual evidence, interventions, and outcomes. Every AI answer must cite those records and respect the user’s project/villa/role scope.

### 3.3 AI capability ladder

#### Level 1 — capture assistance

- multilingual voice note → structured progress update;
- voice/photo → snag description, severity suggestion, owner, and due date;
- OCR of delivery challans, checklists, contracts, and drawings;
- automatic photo compression, duplicate detection, and evidence classification;
- extraction of villa specifications, BOQ items, activities, and checklists from uploaded documents.

#### Level 2 — workflow assistance

- generate project-specific task/checklist templates for human approval;
- summarize the field shift for a manager;
- draft DPRs, inspection reports, NCRs, and handover packs from approved records;
- suggest the next task only when dependencies, drawings, material, and inspections are ready;
- retrieve the latest applicable drawing/specification with citations.

#### Level 3 — decision assistance

- predict schedule slip at villa/activity level;
- explain the risk drivers and supporting evidence;
- recommend recovery actions with expected impact;
- detect repeated defects and likely root causes;
- flag improbable progress or duplicate/out-of-sequence evidence;
- forecast material shortages and vendor commitment failure.

#### Level 4 — compounding intelligence

- private company-specific production-rate benchmarks;
- vendor/work-package performance benchmarks;
- project-template optimization based on actual outcomes;
- opt-in, anonymized cross-project benchmarking with strong governance;
- outcome evaluation: did the recommended action improve schedule, quality, or cost?

### 3.4 AI safety and trust requirements

- AI never marks work complete, approves an inspection, certifies a bill, changes a drawing revision, or closes a snag without an authorized human action.
- Every output displays source records, timestamp, model version, and confidence/uncertainty.
- Retrieval is permission filtered before context reaches the model.
- Uploaded documents and external text are treated as untrusted data; prompt-injection defenses are mandatory.
- Sensitive images/documents require classification-aware retention and model-provider controls.
- Store AI proposals separately from accepted operational records.
- Build evaluation sets from real workflows before promoting a model or prompt.
- Track acceptance, correction, false-positive, and business-outcome metrics—not chat volume.

## 4. Target product and architecture

### 4.1 Product surfaces

1. **Field PWA:** workers, supervisors, foremen, site engineers, QA, stores, contractors.
2. **Management web app:** project managers, project heads, directors, commercial and procurement teams.
3. **External contractor portal:** restricted work, WIR, snag rectification, commitments, measurements, and bills.
4. **Configuration studio:** project hierarchy, templates, workflows, roles, imports, and rollout validation.
5. **AI control room:** risk, exceptions, source-grounded questions, daily briefings, and recommended actions.

### 4.2 Platform components to add

- OpenAPI-generated TypeScript client and shared error/pagination conventions;
- domain services and repositories for every module;
- PostgreSQL transaction boundary for multi-record commands;
- outbox/event pattern for audit, notifications, reporting, and AI triggers;
- object-storage service with signed upload/download, classification, scanning, and thumbnails;
- background jobs for media, reports, notification delivery, sync reconciliation, and AI;
- IndexedDB-backed local data store and mutation queue;
- sync API with idempotency key, client mutation ID, version, device time, server time, and conflict response;
- observability: structured logs, traces, error/crash reporting, performance and sync dashboards;
- feature flags and organization/project-level rollout controls;
- AI gateway with provider abstraction, prompt/model registry, retrieval service, evaluation, cost and latency telemetry;
- analytics read models/materialized views rather than expensive dashboard joins against raw OLTP tables.

### 4.3 Schema additions/corrections

#### Security and integrity

- composite tenant foreign keys or validation triggers for every cross-tenant relationship;
- explicit permissions per module/action/scope;
- `row_version`/ETag fields for conflict detection;
- idempotency and client-mutation ledger;
- device/session registry and sync checkpoints;
- separate AI suggestion, citation, feedback, and model-run tables.

#### Workflow completeness

- checklist templates, versions, sections, questions, answer types, and applicability rules;
- inspection approvals/signatures and evidence requirements;
- WIR entity and lifecycle;
- snag assignments, comments, evidence, verification attempts, SLA, and recurrence;
- safety observations, incidents, permits, toolbox talks, and corrective actions;
- comments/mentions/followers and a unified action/exception model;
- drawing transmittals, acknowledgements, distribution, and superseded access rules;
- working calendars, shifts, holidays, crews, skills, and capacity;
- DPR, labour deployment, weather, equipment, and daily constraints;
- PO line items, receipts, stock movements, transfers, returns, adjustments, and valuation ledger;
- BOQ/contract items, measurements, variations, RA bills, certification, retention, and payments;
- handover packages, readiness rules, customer observations, assets/warranties, signatures, and certificates.

## 5. Execution roadmap

The plan assumes two product squads plus shared design, QA, platform, and AI support. Each phase must ship behind feature flags to pilot projects.

### Phase 0 — secure and make the foundation truthful (weeks 1–4)

**Goal:** no feature work rests on unsafe scope or unverified infrastructure.

Deliver:

- replace hard-coded admin email with permissions;
- centralize repositories/services; remove persistence from route handlers;
- enforce scope in all privileged backend reads/writes;
- replace broad direct-client write RLS policies with least privilege;
- add tenant-consistency constraints;
- create real pgTAP tests with two organizations, assigned/unassigned projects, villas, tasks, documents, people, and denied writes;
- add API integration tests for authentication, permissions, scope, pagination, and errors;
- add migration CI using local Cloud SQL/PostgreSQL;
- generate the TypeScript client from OpenAPI;
- implement audit service and request context; log privileged reads and all mutations;
- establish error/crash reporting, structured logs, metrics, and staging;
- define status machines and domain terminology before building UI.

**Exit criteria:** cross-tenant and out-of-scope access tests fail closed; all mutations create an audit event; staging is reproducible from migrations.

### Phase 1 — the complete field execution loop (weeks 5–12)

**Goal:** one villa project can operate daily work in BuildLens without spreadsheets or WhatsApp for the chosen pilot workflow.

Deliver:

- project selector and full villa hierarchy;
- CSV/XLSX import for villas, levels, rooms, activities, and assignments;
- role-specific Today/Agenda screen;
- task detail and state machine;
- assignment to employee, team, or vendor;
- dependency/readiness checks;
- quantity-based progress;
- timestamped photo evidence and notes;
- comments, mentions, action owners, and history;
- start/pause/resume/complete timer behaviour where useful;
- manager look-ahead and exception inbox;
- first DPR generated from approved operational data.

**Exit criteria:** a supervisor can receive, execute, evidence, and submit work; a manager can verify status and act on blockers; every step is scoped and audited.

### Phase 2 — offline reliability, quality, and snags (weeks 9–18, overlaps Phase 1)

**Goal:** outperform FalconBrick’s most visible weakness.

Deliver:

- installable PWA and cached project scope;
- IndexedDB local records and durable mutation queue;
- visible `Saved on device`, `Queued`, `Syncing`, `Synced`, and `Needs attention` states;
- idempotent sync and resumable/compressed media;
- conflict resolution and recovery screen;
- versioned checklist builder and inspection runner;
- snag/NCR capture, assignment, rectification, verification, and closure;
- photo markup, voice capture, optional GPS, and drawing-revision linkage;
- quality analytics and recurrence views;
- reliability telemetry.

**Exit criteria:** no user-entered field data is lost during crash/network interruption tests; the full inspection-to-closure loop works offline; sync success and data usage are measurable.

### Phase 3 — vendors, WIR, documents, and materials (weeks 17–28)

**Goal:** close the multi-party execution loop.

Deliver:

- restricted contractor portal;
- WIR submission/inspection/approval/rework;
- vendor commitments and computed scorecards;
- contract and document register;
- drawing upload, revision, transmittal, acknowledgement, and superseded-state UX;
- product catalogue, PO line items, delivery receipt/inspection, stock ledger, issues/returns, villa/task consumption, and variance;
- material-delay alerts;
- notification rules and in-app/email/push delivery;
- exportable operational reports.

**Exit criteria:** one contractor and one stores workflow run end-to-end with evidence and audit; latest drawings are unambiguous; stock reconciles from ledger movements.

### Phase 4 — planning, commercial, portfolio BI, and handover (weeks 25–38)

**Goal:** reach broad FalconBrick business parity.

Deliver:

- working calendars, production rates, baselines, look-ahead plans, and schedule variance;
- portfolio → project → villa → room/activity drill-down;
- contractor measurements, BOQ, variations, RA bills, certification, retention, and payment tracking;
- safety workflows;
- handover readiness engine, punch list, customer inspection, signatures, certificates, warranties, and document pack;
- management dashboards for schedule, quality, safety, materials, commercial, vendors, and handover;
- Excel/PDF exports and scheduled reports;
- configuration studio and reusable villa/project templates.

**Exit criteria:** a leadership user can explain why a project is at risk and drill to evidence; a villa can move through a controlled readiness and handover process.

### Phase 5 — AI moat v1 (weeks 13–40, introduced incrementally)

AI work starts after event/evidence quality exists, but capture-assistance experiments can begin earlier.

Deliver in this order:

1. permission-aware document and operational search with citations;
2. multilingual voice-to-progress and voice-to-snag draft;
3. AI-generated DPR/shift summary from approved records;
4. document/specification → draft task and checklist extraction;
5. risk briefing with deterministic schedule rules first, ML later;
6. repeated-defect/root-cause clustering;
7. material shortage and vendor commitment risk;
8. photo-assisted progress/defect suggestions with human verification;
9. recommendation feedback and outcome measurement;
10. organization-specific benchmark models once enough clean data exists.

**Exit criteria:** every AI output is scoped, cited, evaluated, reversible, and demonstrably saves time or improves an operational KPI.

### Phase 6 — enterprise hardening and scale (weeks 35–52)

- SSO/SAML where required;
- Autodesk Construction Cloud and selected ERP/accounting/scheduling integrations;
- webhooks and public integration APIs;
- disaster recovery, backup restoration drills, retention/export/deletion controls;
- penetration testing and security review;
- accessibility and low-end-device certification;
- customer rollout toolkit, training, support console, and implementation analytics;
- SLA/SLO reporting and capacity tests;
- optional native wrapper only if background camera/upload/push constraints justify it.

## 6. Release plan and commercial checkpoints

| Release | Time | Pilot promise | Commercial proof |
|---|---:|---|---|
| R0 Foundation | 4 weeks | Secure staging and real tenant tests | Enterprise security story is credible. |
| R1 Field Alpha | 12 weeks | Today → task → evidence → manager review | Replace one daily spreadsheet/WhatsApp workflow. |
| R2 Quality Beta | 18 weeks | Offline inspection and snag closure | Prove zero lost drafts and faster closure. |
| R3 Multi-party Beta | 28 weeks | Contractor WIR, drawings, materials | Prove contractor accountability and stock traceability. |
| R4 Parity Release | 38–44 weeks | Planning through handover | Compete for broader FalconBrick-style deployments. |
| R5 AI Lead | 44–60 weeks | Cited risk/actions and AI-assisted capture | Quantified time saving, earlier risk detection, less rework. |

Do not wait for full parity to sell. Start with a controlled villa-project pilot at R1/R2 and measure baseline versus BuildLens outcomes.

## 7. Team and effort

### Recommended team

- 1 product/domain lead with construction operations ownership;
- 1 product designer/researcher focused on field ergonomics;
- 2 frontend/PWA engineers;
- 3 backend/data engineers;
- 1 AI/ML engineer from Phase 1 onward;
- 1 QA automation/reliability engineer;
- 0.5–1 platform/DevOps/security engineer;
- named site champions from project management, QA, stores, and contractors.

### Effort band

- secure foundation and first operational loop: **70–100 person-weeks**;
- offline + quality: **70–100 person-weeks**;
- vendors/materials/documents: **80–120 person-weeks**;
- planning/commercial/handover/BI: **100–150 person-weeks**;
- AI v1 plus evaluation/governance: **60–100 person-weeks**;
- enterprise hardening/integrations: **50–90 person-weeks**.

Total planning band: approximately **430–660 person-weeks**, depending on depth, integrations, native-mobile requirements, and reuse of third-party infrastructure. The calendar estimates assume parallel execution, not one engineer working sequentially.

## 8. Prioritized backlog

### P0 — must happen before broad feature development

1. Close backend scope leaks.
2. Replace placeholder RLS tests.
3. Remove hard-coded administrator identity.
4. Apply/validate migrations in reproducible local and staging environments.
5. Add tenant-integrity constraints.
6. Add audit writes and transaction boundaries.
7. Generate the API client and normalize permissions/statuses.

### P1 — pilot-critical

1. Project/villa hierarchy and import.
2. Role-specific Today screen.
3. Task execution, assignment, dependency, progress, and evidence.
4. Offline drafts, queue, sync, and recovery.
5. Inspection/checklist and snag lifecycle.
6. Manager exception inbox and DPR.

### P2 — parity-critical

1. WIR and contractor portal.
2. Drawings/version control.
3. Vendor commitments/performance.
4. Materials and stock ledger.
5. Alerts/escalations.
6. Portfolio analytics.
7. Handover.
8. Contractor measurement/billing.

### P3 — advantage

1. Voice-first field capture.
2. Document-to-workflow generation.
3. Explainable risk engine.
4. Repeated-defect and root-cause intelligence.
5. Material/vendor prediction.
6. AI implementation/configuration assistant.
7. Published reliability and implementation benchmarks.

## 9. Metrics that define “better than FalconBrick”

### Reliability

- crash-free field sessions ≥ 99.8%;
- acknowledged field mutations successfully synchronized ≥ 99.95%;
- lost acknowledged drafts = 0;
- median local field interaction < 100 ms and p95 < 250 ms;
- measured data consumption per typical field shift;
- sync recovery success after 24 hours offline.

### Adoption

- daily/weekly active field-user ratio;
- median actions to complete a progress update or snag;
- percentage of assigned work updated without manager chasing;
- time to onboard a new field user;
- pilot deployment time from project data to first live update.

### Operational outcomes

- schedule variance detected earlier;
- inspection and snag closure time;
- repeat-defect rate;
- rework cost/quantity;
- vendor commitment adherence;
- material variance and stockout frequency;
- handover readiness and punch-list burn-down.

### AI value

- time saved per DPR/inspection/snag;
- structured-capture correction rate;
- risk precision/recall and average lead time;
- recommendation acceptance and measured outcome;
- percentage of answers with valid citations;
- hallucination/unsupported-claim rate;
- AI cost per active project and per successful workflow.

## 10. Decisions to make now

1. Confirm the first pilot project and three high-frequency workflows.
2. Decide whether the field product remains a PWA or requires native capabilities after an offline/camera/upload spike.
3. Choose the first contractor/material workflow rather than attempting every commercial feature.
4. Define source-of-truth integrations: scheduling, ERP/accounting, and document platform.
5. Approve the security repair sprint before feature expansion.
6. Assign a construction-domain owner for status definitions, approval rules, checklists, and handover readiness.
7. Choose two AI use cases with measurable ROI—recommended: voice-to-progress and manager daily risk briefing.

## 11. Source and evidence index

### BuildLens

- Supplied requirements: `Pasted text.txt`
- [`README.md`](../../README.md)
- [`docs/architecture.md`](../architecture.md)
- [`cloud_run_data_api/migrations`](../../cloud_run_data_api/migrations/)
- [`cloud_run_data_api/tests/rls_tenant_isolation.sql`](../../cloud_run_data_api/tests/rls_tenant_isolation.sql)
- [`backend/app`](../../backend/app/)
- [`frontend/app/workspace/page.tsx`](../../frontend/app/workspace/page.tsx)
- [`frontend/package.json`](../../frontend/package.json)
- [FalconBrick competitive intelligence](./falconbrick-competitive-intelligence.md)

### FalconBrick public product sources

- [FalconBrick product](https://www.falconbrick.com/construction-project-management/)
- [Solutions by segment](https://www.falconbrick.com/construction-management-solutions/)
- [Product impact](https://www.falconbrick.com/product-impact/)
- [FAQ and commercial model](https://www.falconbrick.com/faq/)
- [Google Play: Handoff v2.1](https://play.google.com/store/apps/details?id=com.falconbrick.handoff_v2)
- [Adani Realty quality-management rollout](https://www.linkedin.com/posts/omkar-bendre-33aab25_motivation-leadership-quality-activity-7443289903108567040-QG22)

## Bottom line

BuildLens is not yet close to FalconBrick at the product-workflow level, but it is not starting from zero. The domain schema is unusually broad for an early implementation and can support a strong product if it is hardened rather than continually expanded.

The winning sequence is:

```text
Security truth
→ complete field loop
→ offline reliability
→ quality and contractor accountability
→ materials, commercial and handover
→ AI capture and decisions
→ compounding operational intelligence
```

FalconBrick’s decade of references and implementation knowledge cannot be copied quickly. BuildLens can, however, build a better product wedge: **villa-specific depth, zero-lost-work reliability, and AI that turns verified site evidence into timely, explainable action.**
