-- ============================================================================
-- Mezcla de voces sobre un tema que ya se entregó (2026-10-30)
-- ============================================================================
-- El cliente regresa por la mezcla de sus voces cuando su producción ya está
-- entregada. Es una VENTA NUEVA con su proyecto propio (tipo `mezcla_voces`),
-- ligado al original con `proyectos.proyecto_origen_id` (la columna de Diseño
-- visual, supabase-diseno.sql) y trabajado en la MISMA sesión de REAPER.
--
-- Esto da de alta la plantilla de tareas del tipo nuevo y su límite de archivos.
-- NADA depende de correrlo para que el sitio funcione: sin esto, las tareas salen
-- de la plantilla de fábrica de lib/produccion-tareas.ts y el límite de subida
-- del cliente de DEFAULTS_MB_FALLBACK (2 GB). Correrlo solo las vuelve editables
-- desde Ajustes.
--
-- Correr en el SQL Editor de Supabase. Idempotente: no pisa lo que ya se editó.
-- ============================================================================

insert into public.tarea_plantillas (tipo, nombre) values
  ('mezcla_voces', 'Mezcla de voces')
on conflict (tipo) do nothing;

-- Llegan las voces, se limpian y se mezclan; "Aprobada" y "Subir a Drive" son los
-- dos pasos que mueven la entrega automática (supabase-pasos-entrega.sql).
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, subs, paso)
select v.* from (values
  ('mezcla_voces', 0, 'tarea', 'Recibir las voces del cliente', 'luis',  '{}'::text[], null),
  ('mezcla_voces', 1, 'tarea', 'Editar voces',                  'diego',
     array['Eliminar ruidos','Eliminar silencios','Corregir empalmes','Mandarlo a mezcla'], null),
  ('mezcla_voces', 2, 'tarea', 'Mezclar voces',                 'luis',  '{}'::text[], null),
  ('mezcla_voces', 3, 'tarea', 'Aprobada',                      'luis',  '{}'::text[], 'aprobacion'),
  ('mezcla_voces', 4, 'tarea', 'Subir a Drive',                 'luis',  '{}'::text[], 'entrega')
) as v(tipo, orden, clase, titulo, resp, subs, paso)
where not exists (select 1 from public.tarea_plantilla_items where tipo = 'mezcla_voces');

-- Solo sube sus voces (un tema, pocas pistas).
insert into public.almacenamiento_tipos_default (tipo, limite_mb) values
  ('mezcla_voces', 2048)
on conflict (tipo) do nothing;
