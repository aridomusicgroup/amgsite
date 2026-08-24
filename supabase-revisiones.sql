-- Rondas de revisión de proyectos de cliente.
-- revision_actual: la ronda de cambios en curso (0 = sin revisiones todavía).
-- proyecto_tareas.revision: a qué ronda pertenece cada tarea (0 = producción
-- original; 1, 2, 3… = tareas de esa ronda de cambios). Se ve igual en el panel
-- (Producción) y en el panel del cliente (/cuenta). Idempotente.

alter table public.proyectos
  add column if not exists revision_actual int not null default 0;

alter table public.proyecto_tareas
  add column if not exists revision int not null default 0;
