-- ============================================================================
-- Llave de verdad en los pagos a músicos (2026-09-04)
-- ============================================================================
-- Hasta hoy, saber a qué instrumento corresponde un pago exigía PARSEAR la nota
-- ("Auto: Charchetas"), y el músico se casaba por NOMBRE EN TEXTO. De eso
-- dependen ya tres pantallas: PagosMusicoSection, PagosMusicoResumen y
-- /api/admin/musicos-de-venta.
--
-- Se le pone una llave al lado. La columna `musico` (texto) SE QUEDA: es el
-- respaldo si algún día se borra un músico del catálogo, y evita tener que
-- tocar de golpe las tres pantallas que ya la leen.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.pagos_musico
  add column if not exists musico_id uuid references public.musicos(id) on delete set null;

-- El instrumento deja de vivir dentro de la nota.
alter table public.pagos_musico
  add column if not exists instrumento text;

create index if not exists idx_pagos_musico_musico on public.pagos_musico (musico_id);

-- ── Rellenar lo que ya existe ───────────────────────────────────────────────
-- Se casa por nombre en minúsculas y sin espacios de sobra. Verificado antes de
-- escribir esto: los 9 nombres distintos que hay en `pagos_musico` existen tal
-- cual en `musicos`, así que no se pierde ninguno. Lo que no case se queda en
-- null y se sigue leyendo por el nombre de siempre.
update public.pagos_musico p
   set musico_id = m.id
  from public.musicos m
 where p.musico_id is null
   and lower(btrim(p.musico)) = lower(btrim(m.nombre));

-- El instrumento sale de la nota que escribió `musicos-sync.ts`. Las notas que
-- puso una persona a mano no llevan ese prefijo y se quedan sin instrumento,
-- que es lo correcto: no se inventa.
update public.pagos_musico
   set instrumento = btrim(substring(nota from '^[Aa]uto:[[:space:]]*(.+)$'))
 where instrumento is null
   and nota ~* '^auto:';

comment on column public.pagos_musico.musico_id is
  'Llave al catálogo. `musico` (texto) se conserva como respaldo y por compatibilidad.';
comment on column public.pagos_musico.instrumento is
  'Para qué se le contrató en esta venta. Antes vivía dentro de la nota como "Auto: X".';

-- ============================================================================
-- OJO, para revisar a mano (no se toca aquí):
--
-- La venta I0080 "Grabación trombón" (2026-09-02) tiene DOS pagos pendientes de
-- trombón, $600 cada uno: Jorge Orlando y Samuel Torres. Los generó el reparto
-- automático que este cambio viene a corregir — pedía "Trombón" y en el
-- catálogo hay dos trombones, así que creó los dos.
--
-- NO se borra ninguno desde aquí porque ninguno está pagado y no hay forma de
-- saber cuál tocó de verdad. Si fue uno solo, hay que borrar el otro desde
-- Ventas → esa venta → Pagos a músicos; `costo_extra` (hoy $1,200) se recalcula
-- solo al borrarlo.
-- ============================================================================
