-- ============================================================================
-- Plantillas de tareas de producción, editables (2026-09-05)
-- ============================================================================
-- Hoy viven en un switch de lib/produccion-tareas.ts con SÓLO 4 casos: beat,
-- grabacion, mezcla_master y beat_personalizado. Los otros 8 valores de
-- proyectos.tipo — bp_letra, exclusividad, ep, album, contenido, distribucion,
-- creacion_contenido y admin — caen en `default: []` y NACEN SIN NINGUNA TAREA.
--
-- Esto las mueve a la base para poder editarlas desde el panel. El switch se
-- queda en el código como respaldo vivo: si este SQL no se corre, o si un tipo
-- no tiene filas, se sigue usando el de siempre.
--
-- Correr en el SQL Editor de Supabase. Idempotente: la semilla NO pisa lo que ya
-- se haya editado desde la pantalla.
-- ============================================================================

create table if not exists public.tarea_plantillas (
  tipo        text primary key,   -- proyectos.tipo, o pseudo-tipo interno con '_'
  nombre      text,
  descripcion text,
  activo      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_por text
);

create table if not exists public.tarea_plantilla_items (
  id     uuid primary key default gen_random_uuid(),
  tipo   text not null references public.tarea_plantillas(tipo) on delete cascade,
  orden  int  not null default 0,

  -- 'tarea'        → una tarea fija, con su título tal cual.
  -- 'instrumentos' → el HUECO donde se expanden las tareas de los instrumentos
  --                  que traiga la venta.
  --
  -- Es una FILA y no una bandera del tipo porque los instrumentos NO van al
  -- final: en beat_personalizado van entre "Hacer maqueta" y "Editar y
  -- cuantizar". Con una bandera se perdía ese orden, que es el orden real en
  -- que ocurre el trabajo.
  clase  text not null default 'tarea' check (clase in ('tarea', 'instrumentos')),

  -- En clase='instrumentos' es el patrón; {instrumento} se sustituye.
  titulo text not null default 'Grabar {instrumento}',

  -- Alias de nombre, lo que ya entiende `resolverEquipo` (eliud|diego|luis|tozi).
  resp   text,
  -- Elección explícita desde la pantalla. GANA sobre el alias: el alias casa por
  -- coincidencia parcial contra el nombre, y con un miembro nuevo del equipo eso
  -- puede resolver a null en silencio y dejar la tarea sin responsable.
  responsable_id uuid references public.equipo(id) on delete set null,

  subs   text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_tpl_items_tipo on public.tarea_plantilla_items (tipo, orden);

-- ── Guardar una plantilla completa, en UNA transacción ──────────────────────
-- Por qué una función y no borrar+insertar desde el cliente: serían dos viajes,
-- y si el insert falla entre uno y otro la plantilla queda VACÍA. Una plantilla
-- vacía se lee como "no hay nada configurado", así que ese tipo empezaría a
-- nacer sin tareas sin que nadie se entere.
create or replace function public.guardar_tarea_plantilla(p_tipo text, p_items jsonb)
returns void
language plpgsql
as $$
begin
  insert into public.tarea_plantillas (tipo) values (p_tipo)
    on conflict (tipo) do update set updated_at = now();

  delete from public.tarea_plantilla_items where tipo = p_tipo;

  insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, responsable_id, subs)
  select p_tipo,
         (t.n - 1)::int,
         coalesce(nullif(t.i->>'clase', ''), 'tarea'),
         coalesce(nullif(t.i->>'titulo', ''), 'Grabar {instrumento}'),
         nullif(t.i->>'resp', ''),
         nullif(t.i->>'responsable_id', '')::uuid,
         coalesce((select array_agg(v) from jsonb_array_elements_text(t.i->'subs') as v), '{}')
    from jsonb_array_elements(p_items) with ordinality as t(i, n);
end $$;

-- Sólo el service-role, igual que las tablas: a esto se entra desde las rutas
-- del servidor, nunca desde el navegador.
revoke all on function public.guardar_tarea_plantilla(text, jsonb) from public;
grant execute on function public.guardar_tarea_plantilla(text, jsonb) to service_role;

alter table public.tarea_plantillas      enable row level security;
alter table public.tarea_plantilla_items enable row level security;

comment on table public.tarea_plantillas is
  'Qué tareas nacen con cada tipo de proyecto. Editable desde Ajustes; sin filas se usa la plantilla de fábrica que vive en lib/produccion-tareas.ts.';
comment on column public.tarea_plantilla_items.clase is
  '"instrumentos" marca DÓNDE se expanden las tareas Grabar X. Es una fila y no una bandera porque no siempre van al final.';

-- ============================================================================
-- SEMILLA — exactamente lo que hace hoy el código
-- ============================================================================
-- Cada bloque se salta si ese tipo YA tiene filas, para que volver a correr este
-- archivo no revierta lo que alguien editó desde la pantalla.

insert into public.tarea_plantillas (tipo, nombre) values
  ('beat',               'Beat de catálogo'),
  ('grabacion',          'Grabación'),
  ('mezcla_master',      'Mezcla / Master'),
  ('beat_personalizado', 'Beat personalizado')
on conflict (tipo) do nothing;

-- beat — 9 tareas, sin hueco de instrumentos (las guitarras y el bass son fijas)
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, subs)
select v.* from (values
  ('beat', 0, 'tarea', 'Hacer maqueta',      'eliud', '{}'::text[]),
  ('beat', 1, 'tarea', 'Grabar guitarras',   'eliud', '{}'::text[]),
  ('beat', 2, 'tarea', 'Grabar bass',        'eliud', '{}'::text[]),
  ('beat', 3, 'tarea', 'Editar y cuantizar', 'diego',
     array['Cuantizar guitarras','Cuantizar bass','Eliminar ruidos','Eliminar silencios','Corregir empalmes','Mandarlo a mezcla']),
  ('beat', 4, 'tarea', 'Mezclar',            'luis',  '{}'::text[]),
  ('beat', 5, 'tarea', 'Masterizar',         'luis',  '{}'::text[]),
  ('beat', 6, 'tarea', 'Hacer portada',      'tozi',  '{}'::text[]),
  ('beat', 7, 'tarea', 'Hacer video',        'tozi',  '{}'::text[]),
  ('beat', 8, 'tarea', 'Subir beat',         'tozi',  array['Beatstars','YouTube','Links al admin'])
) as v(tipo, orden, clase, titulo, resp, subs)
where not exists (select 1 from public.tarea_plantilla_items where tipo = 'beat');

-- grabacion
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, subs)
select v.* from (values
  ('grabacion', 0, 'instrumentos', 'Grabar {instrumento}',  'eliud', '{}'::text[]),
  ('grabacion', 1, 'tarea',        'Editar y cuantizar',    'diego',
     array['Cuantizar guitarras','Cuantizar bass','Eliminar ruidos','Eliminar silencios','Corregir empalmes','Mandarlo a mezcla']),
  ('grabacion', 2, 'tarea',        'Subir archivos a Drive','diego', '{}'::text[])
) as v(tipo, orden, clase, titulo, resp, subs)
where not exists (select 1 from public.tarea_plantilla_items where tipo = 'grabacion');

-- mezcla_master — una sola tarea, porque el material llega grabado
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, subs)
select v.* from (values
  ('mezcla_master', 0, 'tarea', 'Editar y cuantizar', 'diego',
     array['Cuantizar guitarras','Cuantizar bass','Eliminar ruidos','Eliminar silencios','Corregir empalmes','Mandarlo a mezcla'])
) as v(tipo, orden, clase, titulo, resp, subs)
where not exists (select 1 from public.tarea_plantilla_items where tipo = 'mezcla_master');

-- beat_personalizado — el hueco de instrumentos va EN MEDIO, después de la maqueta
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, subs)
select v.* from (values
  ('beat_personalizado', 0, 'tarea',        'Hacer maqueta',       'eliud', '{}'::text[]),
  ('beat_personalizado', 1, 'instrumentos', 'Grabar {instrumento}','eliud', '{}'::text[]),
  ('beat_personalizado', 2, 'tarea',        'Editar y cuantizar',  'diego',
     array['Cuantizar guitarras','Cuantizar bass','Eliminar ruidos','Eliminar silencios','Corregir empalmes','Mandarlo a mezcla']),
  ('beat_personalizado', 3, 'tarea',        'Mezclar',             'luis',  '{}'::text[]),
  ('beat_personalizado', 4, 'tarea',        'Masterizar',          'luis',  '{}'::text[]),
  ('beat_personalizado', 5, 'tarea',        'Subir a Drive',       'luis',  '{}'::text[])
) as v(tipo, orden, clase, titulo, resp, subs)
where not exists (select 1 from public.tarea_plantilla_items where tipo = 'beat_personalizado');

-- ============================================================================
-- Los 8 tipos que hoy nacen VACÍOS quedan igual de vacíos: crear la tabla no
-- inventa el trabajo que lleva un EP o una exclusividad. Lo que cambia es que
-- ahora hay dónde escribirlo, y la pantalla de Ajustes los muestra marcados
-- como "sin tareas — nace vacío" en vez de que se descubra proyecto por proyecto.
-- ============================================================================
