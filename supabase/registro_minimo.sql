-- Políticas mínimas para desbloquear el registro de admin y usar la app.
-- Ejecuta este fragmento en Supabase > SQL Editor (reemplaza al script rls.sql
-- solo si NO quieres el resto de políticas; si no, ejecuta rls.sql completo).

-- Función auxiliar
create or replace function public.usuario_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
$$;

-- ¿Es el usuario autenticado admin de la empresa indicada?
-- security definer: evita recursión infinita en las políticas de profiles.
create or replace function public.es_admin_de_empresa(empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.company_id = empresa_id
  )
$$;

-- companies
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

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (company_id = public.usuario_company_id());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- Permite al admin dar de alta empleados
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.es_admin_de_empresa(company_id));

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (company_id = public.usuario_company_id());

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles
  for delete using (company_id = public.usuario_company_id());

-- work_centers
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
