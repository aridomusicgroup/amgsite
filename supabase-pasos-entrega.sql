-- ============================================================================
-- Pasos marcados: Aprobación y Entrega (2026-09-11)
-- ============================================================================
-- "Aprobada" y "Subir a Drive" eran texto libre. En la base el paso de Drive
-- estaba escrito de cinco maneras y "Aprobada" también como "Aprovada". El
-- motor de entrega automática necesita reconocerlos sin depender de cómo se
-- tecleó, así que ganan una marca: `paso`.
--
-- El panel funciona SIN correr esto (reconoce los pasos por el título como
-- respaldo), pero con esto la marca sobrevive a que alguien los renombre.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.proyecto_tareas       add column if not exists paso text;
alter table public.proyecto_subtareas    add column if not exists paso text;
alter table public.tarea_plantilla_items add column if not exists paso text;

do $$ begin
  alter table public.proyecto_tareas add constraint proyecto_tareas_paso_chk
    check (paso in ('aprobacion', 'entrega'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.proyecto_subtareas add constraint proyecto_subtareas_paso_chk
    check (paso in ('aprobacion', 'entrega'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tarea_plantilla_items add constraint tarea_plantilla_items_paso_chk
    check (paso in ('aprobacion', 'entrega'));
exception when duplicate_object then null; end $$;

comment on column public.proyecto_tareas.paso is
  'aprobacion | entrega. Cuando la aprobación está hecha y sólo queda la entrega abierta, el panel abre el cuadro de Entregables + Stems.';

-- ── La función que guarda plantillas ahora también guarda el paso ───────────
create or replace function public.guardar_tarea_plantilla(p_tipo text, p_items jsonb)
returns void
language plpgsql
as $$
begin
  insert into public.tarea_plantillas (tipo) values (p_tipo)
    on conflict (tipo) do update set updated_at = now();

  delete from public.tarea_plantilla_items where tipo = p_tipo;

  insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, responsable_id, subs, paso)
  select p_tipo,
         (t.n - 1)::int,
         coalesce(nullif(t.i->>'clase', ''), 'tarea'),
         coalesce(nullif(t.i->>'titulo', ''), 'Grabar {instrumento}'),
         nullif(t.i->>'resp', ''),
         nullif(t.i->>'responsable_id', '')::uuid,
         coalesce((select array_agg(v) from jsonb_array_elements_text(t.i->'subs') as v), '{}'),
         nullif(t.i->>'paso', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, n);
end $$;

revoke all on function public.guardar_tarea_plantilla(text, jsonb) from public;
grant execute on function public.guardar_tarea_plantilla(text, jsonb) to service_role;

-- ============================================================================
-- Marcar lo que ya existe — SÓLO proyectos de cliente
-- ============================================================================
-- Beats de catálogo, contenido propio y tareas internas se quedan sin marca:
-- no se le entregan a nadie.
--
-- Regex estricta a propósito: "Aprobar letra" o "Subir nuevos archivos de quinto
-- a drive" (existe, es para edición) NO son estos pasos.

-- Ortografía: "Aprovada" → "Aprobada"
update public.proyecto_tareas       set titulo = 'Aprobada' where titulo ~* '^\s*aprovada\s*$';
update public.proyecto_subtareas    set titulo = 'Aprobada' where titulo ~* '^\s*aprovada\s*$';
update public.tarea_plantilla_items set titulo = 'Aprobada' where titulo ~* '^\s*aprovada\s*$';

-- Tareas
update public.proyecto_tareas t set paso = 'aprobacion'
  from public.proyectos p
 where p.id = t.proyecto_id and p.clase = 'produccion'
   and coalesce(p.tipo, '') not in ('beat', 'contenido', 'creacion_contenido')
   and t.paso is null
   and t.titulo ~* '^\s*(aprobad[oa]|aprovad[oa])\y';

update public.proyecto_tareas t set paso = 'entrega'
  from public.proyectos p
 where p.id = t.proyecto_id and p.clase = 'produccion'
   and coalesce(p.tipo, '') not in ('beat', 'contenido', 'creacion_contenido')
   and t.paso is null
   and t.titulo ~* '^\s*subir\s+(los\s+)?(archivos\s+)?a\s+drive\y';

-- Subtareas (los pasos de cada tema de un EP/álbum)
update public.proyecto_subtareas s set paso = 'aprobacion'
  from public.proyecto_tareas t, public.proyectos p
 where t.id = s.tarea_id and p.id = t.proyecto_id and p.clase = 'produccion'
   and coalesce(p.tipo, '') not in ('beat', 'contenido', 'creacion_contenido')
   and s.paso is null
   and s.titulo ~* '^\s*(aprobad[oa]|aprovad[oa])\y';

update public.proyecto_subtareas s set paso = 'entrega'
  from public.proyecto_tareas t, public.proyectos p
 where t.id = s.tarea_id and p.id = t.proyecto_id and p.clase = 'produccion'
   and coalesce(p.tipo, '') not in ('beat', 'contenido', 'creacion_contenido')
   and s.paso is null
   and s.titulo ~* '^\s*subir\s+(los\s+)?(archivos\s+)?a\s+drive\y';

-- Plantillas (todas menos la del beat de catálogo)
update public.tarea_plantilla_items set paso = 'aprobacion'
 where tipo <> 'beat' and paso is null
   and titulo ~* '^\s*(aprobad[oa]|aprovad[oa])\y';
update public.tarea_plantilla_items set paso = 'entrega'
 where tipo <> 'beat' and paso is null
   and titulo ~* '^\s*subir\s+(los\s+)?(archivos\s+)?a\s+drive\y';

-- ── Que toda plantilla de cliente tenga los dos pasos ────────────────────────
-- grabacion tenía "Subir archivos a Drive" pero no "Aprobada": se mete justo
-- antes, que es cuando pasa.
update public.tarea_plantilla_items set orden = orden + 1
 where tipo = 'grabacion' and paso = 'entrega'
   and not exists (select 1 from public.tarea_plantilla_items where tipo = 'grabacion' and paso = 'aprobacion');
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, paso)
select 'grabacion', e.orden - 1, 'tarea', 'Aprobada', 'luis', 'aprobacion'
  from public.tarea_plantilla_items e
 where e.tipo = 'grabacion' and e.paso = 'entrega'
   and not exists (select 1 from public.tarea_plantilla_items where tipo = 'grabacion' and paso = 'aprobacion')
 limit 1;

-- mezcla_master no tenía ninguno de los dos: se agregan al final.
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, paso)
select 'mezcla_master',
       coalesce((select max(orden) from public.tarea_plantilla_items where tipo = 'mezcla_master'), -1) + 1,
       'tarea', 'Aprobada', 'luis', 'aprobacion'
 where exists (select 1 from public.tarea_plantilla_items where tipo = 'mezcla_master')
   and not exists (select 1 from public.tarea_plantilla_items where tipo = 'mezcla_master' and paso = 'aprobacion');
insert into public.tarea_plantilla_items (tipo, orden, clase, titulo, resp, paso)
select 'mezcla_master',
       coalesce((select max(orden) from public.tarea_plantilla_items where tipo = 'mezcla_master'), -1) + 1,
       'tarea', 'Subir a Drive', null, 'entrega'
 where exists (select 1 from public.tarea_plantilla_items where tipo = 'mezcla_master')
   and not exists (select 1 from public.tarea_plantilla_items where tipo = 'mezcla_master' and paso = 'entrega');
