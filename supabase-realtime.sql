-- Tiempo real del tablero de Producción: los cambios de un miembro del equipo
-- aparecen al instante para los demás. El app sigue leyendo con service-role
-- (ignora RLS); esto SOLO habilita que Realtime entregue los cambios al staff.

-- 1) Quiénes son "staff" (acota la lectura en tiempo real al equipo).
create table if not exists public.staff (email text primary key);
alter table public.staff enable row level security;  -- sin policies: no legible por clientes

-- 👉 IMPORTANTE: pon aquí los MISMOS correos de tu equipo que tienes en
--    ADMIN_EMAILS / CRM_EMAILS / PRODUCCION_EMAILS (agrega los que falten).
insert into public.staff (email) values
  ('altiplanoprod@gmail.com')
  -- , ('otro-del-equipo@correo.com')
on conflict (email) do nothing;

-- 2) Función que verifica si el usuario autenticado es staff. SECURITY DEFINER
--    para poder leer `staff` sin exponerla a los clientes.
create or replace function public.is_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.staff s where s.email = (auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- 3) Lectura en tiempo real SOLO para staff autenticado (el app usa service-role).
drop policy if exists staff_rt_read on public.proyectos;
create policy staff_rt_read on public.proyectos for select to authenticated using (public.is_staff());

drop policy if exists staff_rt_read on public.proyecto_tareas;
create policy staff_rt_read on public.proyecto_tareas for select to authenticated using (public.is_staff());

-- 4) Publicar los cambios de esas tablas en Realtime (idempotente).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='proyectos') then
    alter publication supabase_realtime add table public.proyectos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='proyecto_tareas') then
    alter publication supabase_realtime add table public.proyecto_tareas;
  end if;
end $$;
