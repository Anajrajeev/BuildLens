# BuildLens architecture

```text
Next.js UI + Firebase Auth  -- Firebase ID token -->  Cloud Run FastAPI  --> Cloud SQL PostgreSQL / Cloud Storage
                                  |
                             audit + events
```

The client owns presentation, Firebase Authentication, session display and offline-capable request queuing only. Cloud Run verifies Firebase ID tokens independently, resolves organization scope from membership, applies permissions and invokes services/repositories. Cloud SQL is the operational system of record; its tenant boundaries are also enforced in the service layer.

## Security decisions

- Browser configuration contains only Firebase's public web configuration.
- Server-only Cloud Run and Cloud SQL credentials are never exposed to Next.js.
- Every public business table has RLS enabled. The trusted backend may use the server key, but must still enforce role and assignment scope.
- Audit, progress, activity, and timer-event records are append-only histories. Client roles have no audit mutation policy.
- Attachments use server-generated paths and records; the future upload endpoint must validate MIME, size, scope and classification before signing access.

## Release safety

Deploy the frontend with Firebase App Hosting and the API with Cloud Run. Set `CORS_ORIGINS` to known application domains—never `*` in production. Apply Cloud SQL migrations in development, staging, then production; do not auto-run destructive production changes.
