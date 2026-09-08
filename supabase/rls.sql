-- Script de RLS para el proyecto Fichaje (control-asistencia-react)
-- Ejecuta este script en Supabase > SQL Editor.
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.

-- 0) Limpieza: elimina TODAS las políticas de las tablas de la app.
--    Así se eliminan políticas antiguas o duplicadas que podrían provocar
--    recursión infinita.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies', 'profiles', 'employees', 'work_centers',
        'employee_work_centers', 'time_records', 'incidents', 'audit_log'
      )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Funciones auxiliares (security definer = evitan recursión infinita).
-- IMPORTANTE: se eliminan antes de crearlas porque CREATE OR REPLACE no
-- cambia el atributo SECURITY DEFINER de una función ya existente.
drop function if exists public.usuario_company_id() cascade;
drop function if exists public.es_admin_de_empresa(uuid) cascade;

create function public.usuario_company_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
$$;

create function public.es_admin_de_empresa(empresa_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.company_id = empresa_id
  )
$$;

-- Habilita RLS en las tablas (no hace nada si ya está activa)
alter table public.companies               enable row level security;
alter table public.profiles                enable row level security;
alter table public.employees               enable row level security;
alter table public.work_centers            enable row level security;
alter table public.employee_work_centers   enable row level security;
alter table public.time_records            enable row level security;
alter table public.incidents               enable row level security;
alter table public.audit_log               enable row level security;

-- ============ companies ============
drop policy if exists "companies_select" on public.companies;
create policy "companies_select" on public.companies
  for select using (id = public.usuario_company_id());

drop policy if exists "companies_insert" on public.companies;
create policy "companies_insert" on public.companies
  for insert with check (true);

drop policy if exists "companies_update" on public.companies;
create policy "companies_update" on public.companies
  for update using (id = public.usuario_company_id());

drop policy if exists "companies_delete" on public.companies;
create policy "companies_delete" on public.companies
  for delete using (id = public.usuario_company_id());

-- ============ profiles ============
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (company_id = public.usuario_company_id());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- Permite al admin de la empresa dar de alta perfiles de empleados.
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.es_admin_de_empresa(company_id));

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (company_id = public.usuario_company_id());

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete using (company_id = public.usuario_company_id());

-- ============ employees ============
drop policy if exists "employees_select" on public.employees;
create policy "employees_select" on public.employees
  for select using (company_id = public.usuario_company_id());

drop policy if exists "employees_insert" on public.employees;
create policy "employees_insert" on public.employees
  for insert with check (company_id = public.usuario_company_id());

drop policy if exists "employees_update" on public.employees;
create policy "employees_update" on public.employees
  for update using (company_id = public.usuario_company_id());

drop policy if exists "employees_delete" on public.employees;
create policy "employees_delete" on public.employees
  for delete using (company_id = public.usuario_company_id());

-- ============ work_centers ============
drop policy if exists "work_centers_select" on public.work_centers;
create policy "work_centers_select" on public.work_centers
  for select using (company_id = public.usuario_company_id());

drop policy if exists "work_centers_insert" on public.work_centers;
create policy "work_centers_insert" on public.work_centers
  for insert with check (company_id = public.usuario_company_id());

drop policy if exists "work_centers_update" on public.work_centers;
create policy "work_centers_update" on public.work_centers
  for update using (company_id = public.usuario_company_id());

drop policy if exists "work_centers_delete" on public.work_centers;
create policy "work_centers_delete" on public.work_centers
  for delete using (company_id = public.usuario_company_id());

-- ============ employee_work_centers ============
drop policy if exists "ewc_select" on public.employee_work_centers;
create policy "ewc_select" on public.employee_work_centers
  for select using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id
        and e.company_id = public.usuario_company_id()
    )
  );

drop policy if exists "ewc_insert" on public.employee_work_centers;
create policy "ewc_insert" on public.employee_work_centers
  for insert with check (
    exists (
      select 1 from public.employees e
      where e.id = employee_id
        and e.company_id = public.usuario_company_id()
    )
  );

drop policy if exists "ewc_update" on public.employee_work_centers;
create policy "ewc_update" on public.employee_work_centers
  for update using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id
        and e.company_id = public.usuario_company_id()
    )
  );

drop policy if exists "ewc_delete" on public.employee_work_centers;
create policy "ewc_delete" on public.employee_work_centers
  for delete using (
    exists (
      select 1 from public.employees e
      where e.id = employee_id
        and e.company_id = public.usuario_company_id()
    )
  );

-- ============ time_records ============
drop policy if exists "time_records_select" on public.time_records;
create policy "time_records_select" on public.time_records
  for select using (company_id = public.usuario_company_id());

drop policy if exists "time_records_insert" on public.time_records;
create policy "time_records_insert" on public.time_records
  for insert with check (company_id = public.usuario_company_id());

drop policy if exists "time_records_update" on public.time_records;
create policy "time_records_update" on public.time_records
  for update using (company_id = public.usuario_company_id());

drop policy if exists "time_records_delete" on public.time_records;
create policy "time_records_delete" on public.time_records
  for delete using (company_id = public.usuario_company_id());

-- ============ incidents ============
drop policy if exists "incidents_select" on public.incidents;
create policy "incidents_select" on public.incidents
  for select using (company_id = public.usuario_company_id());

drop policy if exists "incidents_insert" on public.incidents;
create policy "incidents_insert" on public.incidents
  for insert with check (company_id = public.usuario_company_id());

drop policy if exists "incidents_update" on public.incidents;
create policy "incidents_update" on public.incidents
  for update using (company_id = public.usuario_company_id());

drop policy if exists "incidents_delete" on public.incidents;
create policy "incidents_delete" on public.incidents
  for delete using (company_id = public.usuario_company_id());

-- ============ audit_log ============
drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log
  for select using (company_id = public.usuario_company_id());
