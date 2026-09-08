-- Amplía el CHECK de time_records para admitir pausas (descansos).
alter table public.time_records drop constraint if exists time_records_event_type_check;
alter table public.time_records add constraint time_records_event_type_check
  check (event_type in ('entry', 'exit', 'break_start', 'break_end'));

create or replace function public.fichar_desde_qr(qr text, tipo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp record;
  v_centro record;
  v_ultimo record;
  v_tipo text;
  v_nuevo record;
begin
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

  select w.*
    into v_centro
    from public.work_centers w
    where w.company_id = v_emp.company_id
      and w.active
    order by w.created_at
    limit 1;

  if not found then
    select w.*
      into v_centro
      from public.work_centers w
      where w.company_id = v_emp.company_id
      order by w.created_at
      limit 1;

    if found then
      update public.work_centers set active = true where id = v_centro.id;
    else
      insert into public.work_centers
        (company_id, name, address, latitude, longitude, radius_meters, qr_token_hash, active)
      values
        (v_emp.company_id, 'Centro por defecto', '', 0, 0, 200, gen_random_uuid(), true)
      returning *
        into v_centro;
    end if;
  end if;

  select t.event_type
    into v_ultimo
    from public.time_records t
    where t.employee_id = v_emp.id
      and t.recorded_at >= date_trunc('day', now())
    order by t.recorded_at desc
    limit 1;

  if tipo = 'pausa' then
    if v_ultimo.event_type is null then
      return jsonb_build_object('ok', false, 'motivo', 'pausa_sin_entrada');
    end if;
    if v_ultimo.event_type = 'exit' then
      return jsonb_build_object(
        'ok', false,
        'motivo', 'finalizada',
        'nombre', coalesce(v_emp.nombre, '')
      );
    end if;
    v_tipo := case when v_ultimo.event_type = 'break_start'
      then 'break_end'
      else 'break_start'
    end;
  else
    v_tipo := case v_ultimo.event_type
      when 'entry' then 'exit'
      when 'break_start' then 'break_end'
      when 'break_end' then 'exit'
      else 'entry'
    end;
  end if;

  insert into public.time_records
    (employee_id, company_id, work_center_id, event_type, recorded_at, qr_verified, gps_verified, idempotency_key)
  values
    (v_emp.id, v_emp.company_id, v_centro.id, v_tipo, now(), true, false, gen_random_uuid())
  returning *
    into v_nuevo;

  return jsonb_build_object(
    'ok', true,
    'tipo', v_tipo,
    'nombre', coalesce(v_emp.nombre, ''),
    'recorded_at', v_nuevo.recorded_at
  );
end;
$$;

-- Elimina la versión antigua de un solo argumento (text).
drop function if exists public.fichar_desde_qr(text);

revoke all on function public.fichar_desde_qr(text, text) from public;
grant execute on function public.fichar_desde_qr(text, text) to anon, authenticated;