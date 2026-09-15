-- ============================================================================
-- ARREGLO DE TRiP MX (P0065 · Juanjo Pemberthy) · 2026-09-15
-- Correr DESPUÉS de supabase-temas-ep.sql. Se puede correr más de una vez.
--
-- El proyecto nació sin tareas y los temas se armaron a mano como tareas
-- normales. Esto los vuelve temas, ANCLADOS a las carpetas que ya existen en la
-- PC (JUANJO PEMBERTHY\TRIP MX\EFÍMERO · LA KHABALAH · PROFECÍA, cada una con su
-- .rpp) para que el script no cree nada nuevo, completa los pasos que faltaban y
-- cuelga a cada músico del tema donde toca. No toca nada palomeado.
-- ============================================================================

do $$
declare
  p   uuid := '2659cc4f-1a62-4787-a34e-c2060095c2b3';
  kh  uuid := 'b45b7937-9d74-4a40-aa44-20f39e51b951';  -- LA KHABALAH
  ef  uuid := '62f07f35-fe8b-4794-826e-5cb038abb2bb';  -- EFÍMERO
  pr  uuid := '81b5ab29-fd74-4eb7-be1d-2845716e074a';  -- PROFECÍA
  eliud uuid := 'a3a6bb48-a408-4075-8a2b-46e1c68d5197';
  luis  uuid := '03e44613-5c81-4579-9814-1686d03912b2';
  diego uuid := 'bd162403-2a00-4005-88e9-0cee87b98a40';
  adal   uuid := '75ae14f8-febb-441a-8443-e8f1fb6b3ad4';
  martin uuid := '75a1924a-0139-4cde-8005-dad9273891a5';
  jorge  uuid := '05eb9c02-7346-4f0b-bc4d-a9bfb1e6a428';
begin
  -- 1. Carpeta del proyecto: la que ya existe en la PC (sin la bandera del título).
  update public.proyectos set reaper_carpeta = 'TRIP MX' where id = p;

  -- 2. Los tres son temas, con su carpeta y su .rpp ya creados a mano.
  update public.proyecto_tareas set
    titulo = 'LA KHABALAH', reaper_carpeta = 'LA KHABALAH', es_cancion = true, reaper_creado = true, orden = 0,
    conceptos = '["Paquete Tumbes","Tololoche","Trombón","Mezcla de voces"]'::jsonb
  where id = kh;
  update public.proyecto_tareas set
    reaper_carpeta = 'EFÍMERO', es_cancion = true, reaper_creado = true, orden = 1,
    conceptos = '["Paquete Tumbes","Tololoche","Charchetas","Trombón","Mezcla de voces"]'::jsonb
  where id = ef;
  update public.proyecto_tareas set
    reaper_carpeta = 'PROFECÍA', es_cancion = true, reaper_creado = true, orden = 2,
    conceptos = '["Paquete Tumbes","Tololoche","Charchetas","Mezcla de voces"]'::jsonb
  where id = pr;

  -- 3a. Nombres parejos (mismo criterio que la plantilla: "Grabar {Instrumento}").
  update public.proyecto_subtareas set titulo = 'Grabar Tololoche'
    where id in ('c1dec7b6-9736-4bab-bef0-9af8f78e8b9e', 'e37efe0a-237e-47f5-8250-989b244e2662', 'ac0e336a-b71e-4ff9-a762-b114fc244319');
  update public.proyecto_subtareas set titulo = 'Grabar Bajo'
    where id in ('d306898b-8846-4a6f-8fb3-3ba22f94bdf9', '08764267-fe31-466b-a8e0-9e499072f4b3');
  update public.proyecto_subtareas set titulo = 'Grabar Bass'        where id = '07bf09cd-2825-402c-9fef-91e7f1404385';
  update public.proyecto_subtareas set titulo = 'Grabar Bajoquinto'  where id = '14b8a19a-1318-4f2a-a864-fc4580dbf68d';
  update public.proyecto_subtareas set titulo = 'Grabar Armonía de 6'
    where id in ('32b5c188-da4c-4732-9631-8e164263ad2c', 'cd2dc88a-3135-44d2-925c-5b1ce4cd1588');
  update public.proyecto_subtareas set titulo = 'Grabar Requinto'
    where id in ('9004aadb-4263-4e55-a689-267fb0be2d0a', '11a4339d-a2f7-4add-8527-480eaca9492a', 'ac8cae7b-9347-4f4e-bb35-78fbb8afea74');
  update public.proyecto_subtareas set titulo = 'Grabar Trombón'
    where id in ('7bef8c69-4dd7-45f7-bd41-4408c3bc50eb', 'a6e2cae1-4b95-444e-b29a-aa7bfef57ddd');
  update public.proyecto_subtareas set titulo = 'Grabar Charchetas'  where id = 'f09adf7a-0679-4c91-9326-581f23601814';
  update public.proyecto_subtareas set titulo = 'Grabar Voces'
    where id in ('bae51654-ef3f-4297-93f2-7f75bc1a4649', '53b0fce8-fb53-4043-bd87-a9d1c3c86d8b');
  update public.proyecto_subtareas set titulo = 'Subir a Drive', paso = 'entrega'
    where id in ('3fa1f21c-f330-4709-bc6f-367f85874f91', 'a3ac8256-e91e-411b-a0e6-6af030500a55');

  -- 3b. Los pasos que faltaban (sólo si no están ya, sin importar mayúsculas).
  insert into public.proyecto_subtareas (tarea_id, titulo, hecho, orden, responsable_id, paso)
  select v.tarea_id, v.titulo, false, 99, v.responsable_id, v.paso
  from (values
    (kh, 'Editar y cuantizar', diego, null::text),
    (kh, 'Aprobada',           luis,  'aprobacion'),
    (pr, 'Editar y cuantizar', diego, null),
    (pr, 'Aprobada',           luis,  'aprobacion'),
    (ef, 'Maqueta recibida',   eliud, null),
    (ef, 'Grabar Charchetas',  eliud, null),
    (ef, 'Grabar Voces',       luis,  null),
    (ef, 'Editar y cuantizar', diego, null),
    (ef, 'Mezclar',            luis,  null),
    (ef, 'Masterizar',         luis,  null),
    (ef, 'Aprobada',           luis,  'aprobacion'),
    (ef, 'Subir a Drive',      luis,  'entrega')
  ) as v(tarea_id, titulo, responsable_id, paso)
  where not exists (
    select 1 from public.proyecto_subtareas s
    where s.tarea_id = v.tarea_id and lower(s.titulo) = lower(v.titulo)
  );

  -- 3c. En el orden de la plantilla: maqueta → grabar → editar → mezclar →
  --     masterizar → aprobada → subir. Dentro de "grabar", el orden que ya tenían.
  update public.proyecto_subtareas s set orden = o.nuevo
  from (
    select id, row_number() over (
      partition by tarea_id
      order by case
        when titulo ilike 'maqueta%' then 0
        when titulo ilike 'grabar%'  then 1
        when titulo ilike 'editar%'  then 2
        when titulo ilike 'mezcl%'   then 3
        when titulo ilike 'master%'  then 4
        when titulo ilike 'aprobad%' then 5
        when titulo ilike 'subir%'   then 6
        else 1 end,
      orden, created_at
    ) - 1 as nuevo
    from public.proyecto_subtareas
    where tarea_id in (kh, ef, pr)
  ) o
  where s.id = o.id and s.orden is distinct from o.nuevo;

  -- 4. Cada músico colgado del TEMA donde toca. Se reusan las asignaciones
  --    sueltas (sin tarea) y se crean las que faltan, todas pendientes.
  update public.musico_asignaciones set tarea_id = kh
    where id = '8c581d16-1992-4ec5-b46e-1cca16264500' and tarea_id is null;               -- Adal
  update public.musico_asignaciones set tarea_id = pr
    where id = 'f3100724-9d71-4740-993d-613fb74fee02' and tarea_id is null;               -- Martín
  update public.musico_asignaciones set tarea_id = kh, estado = 'pendiente', updated_at = now()
    where id = '28fd0b9c-8568-4450-ac6a-89b4b90ad9b6' and tarea_id is null;               -- Jorge

  insert into public.musico_asignaciones (musico_id, proyecto_id, tarea_id, instrumento, estado, creado_por)
  select v.musico_id, p, v.tarea_id, v.instrumento, 'pendiente', 'arreglo-trip-mx'
  from (values
    (adal,   ef, 'Tololoche'),
    (adal,   pr, 'Tololoche'),
    (jorge,  ef, 'Trombón'),
    (martin, ef, 'Charchetas')
  ) as v(musico_id, tarea_id, instrumento)
  where not exists (
    select 1 from public.musico_asignaciones a
    where a.musico_id = v.musico_id and a.tarea_id = v.tarea_id
  );
end $$;

-- REVISIÓN 1: los tres temas, anclados y con sus pasos en orden.
select t.orden, t.titulo, t.es_cancion, t.reaper_carpeta, t.reaper_creado,
       string_agg(s.titulo || case when s.hecho then ' ✓' else '' end, ' → ' order by s.orden) as pasos
from public.proyecto_tareas t
left join public.proyecto_subtareas s on s.tarea_id = t.id
where t.proyecto_id = '2659cc4f-1a62-4787-a34e-c2060095c2b3'
group by t.id order by t.orden;

-- REVISIÓN 2: quién graba qué en cada tema.
select t.titulo as tema, m.nombre as musico, a.instrumento, a.estado
from public.musico_asignaciones a
join public.musicos m on m.id = a.musico_id
left join public.proyecto_tareas t on t.id = a.tarea_id
where a.proyecto_id = '2659cc4f-1a62-4787-a34e-c2060095c2b3'
order by t.orden, m.nombre;
