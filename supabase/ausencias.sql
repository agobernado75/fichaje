-- Avisos de ausencia (Médico/Otros) para el kiosko.
-- No interviene en las secuencias de fichaje (time_records se queda intacto).
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.

-- ============ Tabla ============
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  company_id uuid not null,
  motivo text not null check (motivo in ('medico', 'otros')),
  recorded_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Clave foránea a employees (imprescindible para que PostgREST pueda anidar
-- employees(profiles(full_name)) y así mostrar el nombre en el panel).
-- Idempotente: no falla si el constraint ya existe.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.absences'::regclass
      and contype = 'f'
      and conname = 'absences_employee_id_fkey'
  ) then
    alter table public.absences
      add constraint absences_employee_id_fkey
      foreign key (employee_id) references public.employees(id) on delete cascade;
  end if;
end;
$$;

alter table public.absences enable row level security;

-- ============ RLS (por empresa) ============
drop policy if exists "absences_select" on public.absences;
create policy "absences_select" on public.absences
  for select using (company_id = public.usuario_company_id());

drop policy if exists "absences_insert" on public.absences;
create policy "absences_insert" on public.absences
  for insert with check (company_id = public.usuario_company_id());

drop policy if exists "absences_update" on public.absences;
create policy "absences_update" on public.absences
  for update using (company_id = public.usuario_company_id());

drop policy if exists "absences_delete" on public.absences;
create policy "absences_delete" on public.absences
  for delete using (company_id = public.usuario_company_id());

-- ============ RPC (security definer, como fichar_desde_qr) ============
-- Conmuta: si el empleado tiene una ausencia abierta, la cierra (accion 'fin');
-- si no, registra una nueva (accion 'inicio').
create or replace function public.marcar_ausencia(qr text, motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp record;
  v_abierta record;
  v_motivo text;
  v_nueva record;
begin
  v_motivo := lower(btrim(motivo));
  if v_motivo not in ('medico', 'otros') then
    return jsonb_build_object('ok', false, 'motivo', 'motivo_invalido');
  end if;

  select e.*, p.full_name as nombre
    into v_emp
    from public.employees e
    join public.profiles p on p.id = e.profile_id
    where e.id::text = lower(btrim(qr))
    limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'desconocido');
  end if;

  if not coalesce(v_emp.active, false) then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'inactivo',
      'nombre', coalesce(v_emp.nombre, '')
    );
  end if;

  select a.*
    into v_abierta
    from public.absences a
    where a.employee_id = v_emp.id
      and a.closed_at is null
    order by a.recorded_at desc
    limit 1;

  if found then
    update public.absences set closed_at = now() where id = v_abierta.id;
    return jsonb_build_object(
      'ok', true,
      'accion', 'fin',
      'motivo', v_abierta.motivo,
      'nombre', coalesce(v_emp.nombre, ''),
      'recorded_at', v_abierta.recorded_at
    );
  end if;

  insert into public.absences (employee_id, company_id, motivo)
  values (v_emp.id, v_emp.company_id, v_motivo)
  returning *
    into v_nueva;

  return jsonb_build_object(
    'ok', true,
    'accion', 'inicio',
    'motivo', v_nueva.motivo,
    'nombre', coalesce(v_emp.nombre, ''),
    'recorded_at', v_nueva.recorded_at
  );
end;
$$;

revoke all on function public.marcar_ausencia(text, text) from public;
grant execute on function public.marcar_ausencia(text, text) to anon, authenticated;