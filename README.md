# BuildLens

Secure, multi-tenant construction operations platform. The repository keeps the Next.js client, FastAPI business layer, and Cloud SQL schema deliberately separate.

**Source repository:** [github.com/Anajrajeev/BuildLens](https://github.com/Anajrajeev/BuildLens). The production target is Google Cloud: Firebase Authentication, Cloud Run, Cloud SQL, Cloud Storage, and Gemini.

## Layout

- `frontend/` — Next.js UI and typed API client
- `backend/` — FastAPI API, authorization and domain services
- `firebase/` — Firestore security rules and future data-model artifacts
- `packages/shared/` — generated/shared API artifacts belong here

## Local development

1. Copy `frontend/.env.example` and `backend/.env.example` to local `.env` files, then configure Firebase Authentication and your Google Cloud project.
2. Deploy the Firestore security rules with `firebase deploy --only firestore:rules --project buildlens-20261018`.
3. Run the API: `cd backend; python -m venv .venv; .venv\\Scripts\\pip install -e .[dev]; uvicorn app.main:app --reload --port 8000`.
4. Run the UI: `cd frontend; npm install; npm run dev`.

The browser uses Firebase Authentication only. All operational writes pass through FastAPI on Cloud Run and use Cloud SQL service credentials.

## Operational modules

The workspace now includes the connected field-to-management loop:

- Today agenda, task status, progress history, assignments, dependencies and timer actions
- villa levels/rooms, quality inspections, reusable checklist templates and snag closure
- daily reports, safety observations and corrective actions
- materials, stock movements, suppliers, purchase orders and line items
- vendor commitments and performance scorecards
- WIR, drawing revisions/acknowledgements and document registration
- handover packages and readiness items
- live dashboards, exception reporting, notifications and immutable mutation audit records
- installable PWA shell with a visible offline mutation queue
- source-grounded AI project briefings with a deterministic fallback

Cloud Firestore starts with browser access denied. Enable Firebase Authentication and tenant-scoped rules before adding client data access. Gemini configuration is optional; without it, the briefing endpoint remains available using deterministic project metrics.

RBAC expansion and role-adaptive screens are intentionally deferred; existing authentication and organization scoping remain in place.
