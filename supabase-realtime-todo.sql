-- Tiempo real para TODO el panel: habilita que Realtime entregue los cambios de
-- estas tablas a los navegadores del staff. El app sigue leyendo/escribiendo con
-- service-role (ignora RLS); esto solo agrega LECTURA para staff (para Realtime).
-- Requiere que ya exista la función public.is_staff() (ver supabase-realtime.sql).
--
-- Seguro: ninguna de estas tablas se lee desde el navegador con la llave pública;
-- todo el acceso de la app es server-side con service-role.

do $$
declare
  tbl text;
  tablas text[] := array[
    'contactos','identidades_canal','interacciones',
    'cotizaciones','contratos','ventas','pagos',
    'orders','order_items','customers',
    'expenses','manual_income','proyecto_subtareas'
  ];
begin
  foreach tbl in array tablas loop
    -- Solo si la tabla existe (evita romper si alguna no está en este proyecto).
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=tbl) then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('drop policy if exists staff_rt_read on public.%I', tbl);
      execute format('create policy staff_rt_read on public.%I for select to authenticated using (public.is_staff())', tbl);
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      end if;
    end if;
  end loop;
end $$;
