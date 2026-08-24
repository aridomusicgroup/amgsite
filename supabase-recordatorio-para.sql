-- ============================================================================
-- Recordatorios: poder ponérselo al RESPONSABLE de la tarea (2026-08-05)
-- ============================================================================
-- Hasta ahora el recordatorio siempre caía en quien lo ponía, aunque la tarea
-- fuera de otra persona. Ahora se puede elegir: a mí, al responsable, o a los
-- dos.
--
-- Con una sola columna basta porque la tabla ya guarda UNA FILA POR PERSONA
-- (índice único en tarea_id + email): mandarlo a los dos son dos filas.
--
-- `puesto_por` es quién lo creó, y sirve para dos cosas:
--   1. El correo dice "te lo puso Fulano" en vez de "tú te lo pusiste".
--   2. Nadie puede borrar ni pisar el recordatorio PROPIO de otro: solo se
--      toca el que uno mismo colocó.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.tarea_recordatorios
  add column if not exists puesto_por text;

-- Los que ya existían se los puso su propio dueño.
update public.tarea_recordatorios
   set puesto_por = email
 where puesto_por is null;

comment on column public.tarea_recordatorios.puesto_por is
  'Correo de quien creó el recordatorio. Si difiere de email, se lo puso alguien más.';
