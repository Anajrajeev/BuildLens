-- Append-only villa activity history. Source order is advisory, never a gate.
alter table public.villas add constraint villas_workflow_scope unique (id, project_id, organization_id);
create table public.villa_workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  villa_id uuid not null,
  activity_key text not null check (activity_key ~ '^elle-0(0[1-9]|[1-8][0-9])$'),
  revision integer not null check (revision > 0),
  status text not null check (status in ('NOT_STARTED','IN_PROGRESS','BLOCKED','REWORK_REQUIRED','COMPLETED')),
  progress integer not null check (progress between 0 and 100),
  note text not null default '' check (length(note) <= 2000),
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (villa_id, project_id, organization_id) references public.villas(id, project_id, organization_id),
  unique (villa_id, activity_key, revision),
  check ((status = 'COMPLETED' and progress = 100) or (status = 'NOT_STARTED' and progress = 0) or (status in ('IN_PROGRESS','BLOCKED','REWORK_REQUIRED') and progress < 100))
);
create index villa_workflow_project_idx on public.villa_workflow_events(organization_id, project_id, created_at, id);
alter table public.villa_workflow_events enable row level security;
create policy workflow_read on public.villa_workflow_events for select to authenticated using (public.is_org_member(organization_id));
-- Writes go through the authenticated API, which checks task.write and revision conflicts.
revoke insert, update, delete on public.villa_workflow_events from anon, authenticated;
