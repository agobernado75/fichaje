-- Logo de empresa + Real Time para el panel de administración.
-- Idempotente: puedes ejecutarlo varias veces sin romper nada.

-- ============ companies: logo (data URL base64, reducido a ~256px) ============
alter table public.companies
  add column if not exists logo_url text;

-- ============ Real Time: publicación supabase_realtime ============
-- Alta de las tablas del panel para que Supabase envíe cambios
-- (postgres_changes). El RLS de cada tabla ya limita por empresa.
do $$
begin
  begin
    alter publication supabase_realtime add table public.time_records;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.employees;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.work_centers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.absences;
  exception when duplicate_object then null;
  end;
end;
$$;