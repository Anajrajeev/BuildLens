-- End-to-end operational workflows beyond the original normalized foundation.
-- RBAC changes are deliberately excluded from this migration.

alter table public.inspections add column if not exists project_id uuid references public.projects(id);
alter table public.inspections add column if not exists template_id uuid;
alter table public.inspections add column if not exists inspection_type text not null default 'GENERAL';
alter table public.inspections add column if not exists created_at timestamptz not null default now();
alter table public.inspections add column if not exists updated_at timestamptz not null default now();
alter table public.attachments add column if not exists file_name text;

alter table public.snags add column if not exists project_id uuid references public.projects(id);
alter table public.snags add column if not exists task_id uuid references public.tasks(id);
alter table public.snags add column if not exists title text;
alter table public.snags add column if not exists severity text not null default 'MEDIUM';
alter table public.snags add column if not exists assigned_employee_id uuid references public.employees(id);
alter table public.snags add column if not exists assigned_vendor_id uuid references public.vendors(id);
alter table public.snags add column if not exists location_label text;
alter table public.snags add column if not exists resolution_notes text;
alter table public.snags add column if not exists created_at timestamptz not null default now();
alter table public.snags add column if not exists updated_at timestamptz not null default now();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
  work_section_id uuid references public.work_sections(id),
  name text not null,
  category text,
  description text,
  version integer not null default 1,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','RETIRED')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,name,version)
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  label text not null,
  answer_type text not null default 'PASS_FAIL_NA',
  required boolean not null default true,
  evidence_required boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  villa_id uuid references public.villas(id),
  report_date date not null,
  weather text,
  workforce_count integer not null default 0 check(workforce_count >= 0),
  summary text not null,
  constraints text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,villa_id,report_date)
);

create table if not exists public.safety_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  villa_id uuid references public.villas(id),
  observation_type text not null default 'OBSERVATION',
  severity text not null default 'MEDIUM',
  status text not null default 'OPEN',
  description text not null,
  corrective_action text,
  due_at timestamptz,
  closed_at timestamptz,
  reported_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  material_id uuid not null references public.materials(id),
  villa_id uuid references public.villas(id),
  task_id uuid references public.tasks(id),
  movement_type text not null check(movement_type in ('RECEIPT','ISSUE','RETURN','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT')),
  quantity numeric(14,2) not null check(quantity > 0),
  reference text,
  notes text,
  recorded_by uuid references auth.users(id),
  occurred_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,2) not null check(quantity > 0),
  unit_price numeric(14,2) not null default 0 check(unit_price >= 0),
  received_quantity numeric(14,2) not null default 0 check(received_quantity >= 0)
);

create table if not exists public.work_inspection_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  villa_id uuid references public.villas(id),
  task_id uuid not null references public.tasks(id),
  vendor_id uuid not null references public.vendors(id),
  description text not null,
  status text not null default 'SUBMITTED',
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drawing_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  drawing_revision_id uuid not null references public.drawing_revisions(id),
  user_id uuid not null references auth.users(id),
  acknowledged_at timestamptz not null default now(),
  notes text,
  unique(drawing_revision_id,user_id)
);

create table if not exists public.handover_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null references public.projects(id),
  villa_id uuid not null references public.villas(id),
  status text not null default 'NOT_READY',
  readiness_score numeric(5,2) not null default 0 check(readiness_score between 0 and 100),
  target_date date,
  customer_name text,
  notes text,
  handed_over_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(villa_id)
);

create table if not exists public.handover_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  handover_id uuid not null references public.handover_packages(id) on delete cascade,
  category text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'PENDING',
  evidence_attachment_id uuid references public.attachments(id),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  notes text
);

create table if not exists public.sync_mutations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_mutation_id text not null,
  user_id uuid not null references auth.users(id),
  device_id text,
  entity_type text not null,
  entity_id uuid,
  operation text not null,
  status text not null default 'ACCEPTED',
  payload_hash text,
  received_at timestamptz not null default now(),
  unique(organization_id,client_mutation_id)
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid references public.projects(id),
  run_type text not null,
  question text,
  answer text not null,
  model text not null,
  citations jsonb not null default '{}'::jsonb,
  accepted boolean,
  feedback text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'task_comments','checklist_templates','checklist_template_items','daily_reports',
    'safety_observations','stock_movements','purchase_order_items','work_inspection_requests',
    'drawing_acknowledgements','handover_packages','handover_items','sync_mutations','ai_runs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',
      t || '_tenant_access', t
    );
  end loop;
end $$;

create index if not exists task_comments_task_idx on public.task_comments(task_id,created_at);
create index if not exists daily_reports_project_date_idx on public.daily_reports(project_id,report_date desc);
create index if not exists snags_project_status_idx on public.snags(project_id,status,created_at desc);
create index if not exists inspections_project_status_idx on public.inspections(project_id,status,scheduled_at);
create index if not exists stock_movements_material_idx on public.stock_movements(material_id,occurred_at desc);
create index if not exists wir_project_status_idx on public.work_inspection_requests(project_id,status,created_at desc);
create index if not exists safety_project_status_idx on public.safety_observations(project_id,status,created_at desc);
create index if not exists handover_project_status_idx on public.handover_packages(project_id,status);
create index if not exists ai_runs_project_created_idx on public.ai_runs(project_id,created_at desc);

create trigger inspections_updated before update on public.inspections for each row execute function public.set_updated_at();
create trigger snags_updated before update on public.snags for each row execute function public.set_updated_at();
create trigger daily_reports_updated before update on public.daily_reports for each row execute function public.set_updated_at();
create trigger safety_observations_updated before update on public.safety_observations for each row execute function public.set_updated_at();
create trigger work_inspection_requests_updated before update on public.work_inspection_requests for each row execute function public.set_updated_at();
create trigger handover_packages_updated before update on public.handover_packages for each row execute function public.set_updated_at();
