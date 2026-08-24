-- Bitácora general del panel: además de Producción, ahora registra ventas,
-- pagos, cotizaciones, contratos, CRM, finanzas y accesos.
-- Agrega el CONTEXTO de la entidad para saber sobre qué fue cada movimiento.

alter table public.actividad add column if not exists entidad        text;  -- proyecto|tarea|venta|pago|cotizacion|contrato|contacto|egreso|ingreso|usuario
alter table public.actividad add column if not exists entidad_id     text;
alter table public.actividad add column if not exists entidad_nombre text;  -- folio / título / cliente (legible)

create index if not exists idx_actividad_created on public.actividad(created_at desc);
create index if not exists idx_actividad_entidad on public.actividad(entidad);
create index if not exists idx_actividad_actor   on public.actividad(actor);

-- Tiempo real de la bitácora (misma regla de staff que el resto del panel).
alter table public.actividad enable row level security;
drop policy if exists staff_rt_read on public.actividad;
create policy staff_rt_read on public.actividad for select to authenticated using (public.is_staff());
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='actividad') then
    alter publication supabase_realtime add table public.actividad;
  end if;
end $$;
