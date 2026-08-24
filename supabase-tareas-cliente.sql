-- Visibilidad de cada tarea de producción hacia el cliente (panel /cuenta).
-- Las tareas visibles son las que el cliente ve en el detalle de su pedido y las
-- que disparan el correo "vamos avanzando". Por defecto TRUE (visible); las
-- tareas internas de distribución se crean en FALSE desde el código.
alter table public.proyecto_tareas
  add column if not exists visible_cliente boolean not null default true;
