-- Horas extraordinarias (registro manual con aprobación).
-- No participa en el saldo ni en el absentismo: es un registro independiente
-- de control de la empresa. Idempotente: puedes ejecutarlo varias veces sin romper nada.

-- ============ Tabla ============
create table if not exists public.overtime (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  company_id uuid not null,
  work_center_id uuid,
  fecha date not null,
  minutos int not null check (minutos > 0 and minutos <= 1440),
  descripcion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'denegada')),
  aprobado_por uuid,
  aprobado_at timestamptz,
  created_at timestamptz not null default now()
);

-- Clave foránea a employees (como absences) para poder anidar
-- employees(profiles(full_name)) en PostgREST y mostrar el nombre.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.overtime'::regclass
      and contype = 'f'
      and conname = 'overtime_employee_id_fkey'
  ) then
    alter table public.overtime
      add constraint overtime_employee_id_fkey
      foreign key (employee_id) references public.employees(id) on delete cascade;
  end if;
end;
$$;

alter table public.overtime enable row level security;

-- ============ RLS (por empresa) ============
drop policy if exists "overtime_select" on public.overtime;
create policy "overtime_select" on public.overtime
  for select using (company_id = public.usuario_company_id());

drop policy if exists "overtime_insert" on public.overtime;
create policy "overtime_insert" on public.overtime
  for insert with check (company_id = public.usuario_company_id());

drop policy if exists "overtime_update" on public.overtime;
create policy "overtime_update" on public.overtime
  for update using (company_id = public.usuario_company_id());

drop policy if exists "overtime_delete" on public.overtime;
create policy "overtime_delete" on public.overtime
  for delete using (company_id = public.usuario_company_id());

-- ============ Real Time: publicación supabase_realtime ============
do $$
begin
  begin
    alter publication supabase_realtime add table public.overtime;
  exception when duplicate_object then null;
  end;
end;
$$;