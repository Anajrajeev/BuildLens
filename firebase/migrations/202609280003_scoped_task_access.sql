-- Scope-sensitive read policies replace the broad tenant policy for operational records.
-- Permissions are configurable data, not role names embedded in policy logic.
create or replace function public.has_org_permission(target_org uuid, required_key text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = target_org and m.user_id = auth.uid() and m.status = 'ACTIVE' and p.key = required_key
  )
$$;
create or replace function public.can_read_project(target_org uuid, target_project uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_permission(target_org, 'project.read.all') or exists (
    select 1 from public.employee_project_assignments epa join public.employees e on e.id = epa.employee_id
    where epa.organization_id = target_org and epa.project_id = target_project and e.user_id = auth.uid()
  )
$$;
create or replace function public.can_read_villa(target_org uuid, target_project uuid, target_villa uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_permission(target_org, 'villa.read.all') or public.can_read_project(target_org, target_project) or exists (
    select 1 from public.employee_villa_assignments eva join public.employees e on e.id = eva.employee_id
    where eva.organization_id = target_org and eva.villa_id = target_villa and e.user_id = auth.uid()
  )
$$;
create or replace function public.can_read_task(target_org uuid, target_project uuid, target_villa uuid, target_task uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_org_permission(target_org, 'task.read.all')
    or public.can_read_villa(target_org, target_project, target_villa)
    or exists (
      select 1 from public.task_assignments ta join public.employees e on e.id = ta.employee_id
      where ta.organization_id = target_org and ta.task_id = target_task and e.user_id = auth.uid()
    )
$$;

drop policy if exists projects_tenant_access on public.projects;
create policy projects_scoped_read on public.projects for select using (public.can_read_project(organization_id,id));
create policy projects_scoped_write on public.projects for all using (public.has_org_permission(organization_id,'project.write')) with check (public.has_org_permission(organization_id,'project.write'));
drop policy if exists villas_tenant_access on public.villas;
create policy villas_scoped_read on public.villas for select using (public.can_read_villa(organization_id,project_id,id));
create policy villas_scoped_write on public.villas for all using (public.has_org_permission(organization_id,'villa.write')) with check (public.has_org_permission(organization_id,'villa.write'));
drop policy if exists tasks_tenant_access on public.tasks;
create policy tasks_scoped_read on public.tasks for select using (public.can_read_task(organization_id,project_id,villa_id,id));
create policy tasks_scoped_write on public.tasks for all using (public.has_org_permission(organization_id,'task.write')) with check (public.has_org_permission(organization_id,'task.write'));

insert into public.permissions(key,description) values
 ('project.read.all','Read every project in an organization'),('project.write','Create and modify projects'),
 ('villa.read.all','Read every villa in an organization'),('villa.write','Create and modify villas'),
 ('task.read.all','Read every task in an organization'),('task.write','Create and modify work items'),('timer.manage','Set, start, pause and complete task timers')
on conflict(key) do nothing;
