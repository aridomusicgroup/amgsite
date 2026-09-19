-- ============================================================================
-- Diseño visual para artistas (2026-09-18)
-- ============================================================================
-- Portada, canvas, visualizer, lyric video, logo, branding y redes, hechos por
-- un diseñador externo (Julio). ARIDO cobra su precio y le paga su costo.
--
-- 1. Una cotización de diseño se liga al TEMA que produjimos (si lo hicimos):
--    cotizaciones.proyecto_origen_id → el proyecto de la canción.
-- 2. Lo que se le paga al diseñador queda congelado en la cotización
--    (cotizaciones.costo_proveedor, SIEMPRE en pesos aunque se cotice en USD).
--    Al nacer la venta se vuelve un pago pendiente en "Pagos a músicos" y entra
--    a ventas.costo_extra, así el margen se ve en Finanzas.
-- 3. El proyecto de diseño recuerda de qué tema salió
--    (proyectos.proyecto_origen_id).
-- 4. El diseñador entra al catálogo de músicos con el instrumento "Diseño",
--    sin portal: así su pago usa el mismo flujo (pendiente, anticipos, Pagar).
-- 5. Las tareas con las que nace un proyecto de diseño.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.cotizaciones
  add column if not exists proyecto_origen_id uuid references public.proyectos(id) on delete set null;

alter table public.cotizaciones
  add column if not exists costo_proveedor numeric;

comment on column public.cotizaciones.proyecto_origen_id is
  'Diseño visual: el proyecto (canción) que produjimos y para el que es este diseño. null = no lo produjimos.';
comment on column public.cotizaciones.costo_proveedor is
  'Lo que se le paga al diseñador externo, en MXN. Congelado al guardar; se vuelve pago pendiente al crear la venta.';

alter table public.proyectos
  add column if not exists proyecto_origen_id uuid references public.proyectos(id) on delete set null;

comment on column public.proyectos.proyecto_origen_id is
  'Proyecto de diseño visual: la canción de la que sale (portada, canvas, video…).';

create index if not exists idx_proyectos_origen on public.proyectos(proyecto_origen_id)
  where proyecto_origen_id is not null;

-- El diseñador, en el catálogo de músicos (sin portal, sin tarifa fija: cada
-- cotización dice cuánto se le paga).
insert into public.musicos (nombre, instrumentos, tarifa, activo, nota)
select 'Julio Guerrero', '{Diseño}', 0, true, 'Diseño visual (portadas, canvas, videos). Se le paga lo que diga cada cotización.'
where not exists (
  select 1 from public.musicos where lower(nombre) = lower('Julio Guerrero')
);

-- Tareas con las que nace un proyecto de diseño (editables en Ajustes →
-- Plantillas de tareas). Se salta si ya hay filas, para no pisar lo editado.
insert into public.tarea_plantillas (tipo, nombre) values ('diseno', 'Diseño visual')
on conflict (tipo) do nothing;

insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, subs)
select v.* from (values
  ('diseno', 0, 'tarea', 'Brief y referencias del cliente',              'tozi', '{}'::text[]),
  ('diseno', 1, 'tarea', 'Diseño (Julio)',                               null,   '{}'::text[]),
  ('diseno', 2, 'tarea', 'Revisión con el cliente (1 ronda de cambios)', 'tozi', '{}'::text[]),
  ('diseno', 3, 'tarea', 'Entregar archivos al cliente',                 'tozi', '{}'::text[])
) as v(tipo, orden, clase, titulo, resp, subs)
where not exists (select 1 from public.tarea_plantilla_items where tipo = 'diseno');

-- Verificación (debe salir 3 columnas, 1 músico y 4 tareas):
-- select table_name, column_name from information_schema.columns
--  where column_name in ('proyecto_origen_id', 'costo_proveedor') and table_schema = 'public';
-- select id, nombre, instrumentos from public.musicos where nombre = 'Julio Guerrero';
-- select orden, titulo, resp from public.tarea_plantilla_items where tipo = 'diseno' order by orden;
