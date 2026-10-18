# Activating BuildLens on Firebase and Google Cloud

The repository includes migrations but does **not** contain credentials and has not applied anything to the remote project. This is intentional: the project URL alone cannot authenticate schema changes or server-side calls.

## Required values

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Create `backend/.env`:

```env
CLOUD_RUN_DATA_API_URL=<internal Cloud Run service URL>
CLOUD_RUN_DATA_API_SECRET_KEY=<Secret Manager value>
DATABASE_URL=<Cloud SQL PostgreSQL connection URL>
FIREBASE_PROJECT_ID=<project-id>
CORS_ORIGINS=http://127.0.0.1:3000
```

Never send service credentials to the browser or commit either local file.

## Apply and validate

1. Create a Firebase project and enable Email/Password authentication.
2. Create the Firestore database in `asia-south1` and deploy `firebase/firestore.rules`.
3. Deploy the API to Cloud Run with a service account and Secret Manager-backed configuration.
4. Create development Firebase users, then add their Firebase UIDs as `organization_members` with a configured role.
4. Assign role permissions, project/villa assignments, and then run the RLS tests.
5. Confirm `GET /api/v1/auth/me`, `/projects`, and `/tasks` using an authenticated bearer token.

Migrations `202609280001` through `202609280004` must be applied in order. Apply them to a staging project before production.
