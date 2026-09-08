-- Mejoras: centro/provincia, datos de empleado (apellidos, NIF, turno, horario)
-- y estampado del centro en las ausencias para los informes de absentismo.
-- Idempotente: puedes ejecutarlo varias veces sin romper nada.

-- ============ employees: nuevos campos ============
alter table public.employees
  add column if not exists surname text,
  add column if not exists nif text,
  add column if not exists shift text,
  add column if not exists shift_start time,
  add column if not exists shift_end time,
  add column if not exists shift_start_pm time,
  add column if not exists shift_end_pm time;

-- Valores permitidos para 'shift' (mañana/tarde/noche/jornada partida).
-- Se reemplaza el constraint si existe para admitir 'partida'.
alter table public.employees drop constraint if exists employees_shift_check;
alter table public.employees
  add constraint employees_shift_check
  check (shift is null or shift in ('manana', 'tarde', 'noche', 'partida'));

-- ============ work_centers: provincia ============
alter table public.work_centers
  add column if not exists provincia text;

-- ============ work_centers: descanso permitido ============
-- Minutos de descanso permitidos dentro del horario laboral.
-- NULL = sin descanso permitido (se trata como 0).
alter table public.work_centers
  add column if not exists descanso_min int;

alter table public.work_centers drop constraint if exists work_centers_descanso_min_check;
alter table public.work_centers
  add constraint work_centers_descanso_min_check
  check (descanso_min is null or descanso_min >= 0);

-- ============ absences: centro de trabajo ============
alter table public.absences
  add column if not exists work_center_id uuid;

-- ============ RPC marcar_ausencia: estampa el centro del empleado ============
-- Se crea de nuevo para resolver el centro activo del empleado (igual que
-- fichar_desde_qr) y guardarlo en absences.work_center_id.
drop function if exists public.marcar_ausencia(text, text);
create or replace function public.marcar_ausencia(qr text, motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp record;
  v_centro_id uuid;
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

  select coalesce(
    (select wc.id
       from public.employee_work_centers ewc
       join public.work_centers wc on wc.id = ewc.work_center_id
      where ewc.employee_id = v_emp.id
        and ewc.active
        and wc.active
      order by wc.created_at
      limit 1),
    (select wc.id
       from public.work_centers wc
      where wc.company_id = v_emp.company_id
      order by wc.created_at
      limit 1)
  ) into v_centro_id;

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
      'recorded_at', v_abierta.recorded_at,
      'work_center_id', v_abierta.work_center_id
    );
  end if;

  insert into public.absences (employee_id, company_id, work_center_id, motivo)
  values (v_emp.id, v_emp.company_id, v_centro_id, v_motivo)
  returning *
    into v_nueva;

  return jsonb_build_object(
    'ok', true,
    'accion', 'inicio',
    'motivo', v_nueva.motivo,
    'nombre', coalesce(v_emp.nombre, ''),
    'recorded_at', v_nueva.recorded_at,
    'work_center_id', v_nueva.work_center_id
  );
end;
$$;

revoke all on function public.marcar_ausencia(text, text) from public;
grant execute on function public.marcar_ausencia(text, text) to anon, authenticated;