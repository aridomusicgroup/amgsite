-- Forma de onda aproximada de cada versión (.rpp) de un proyecto de REAPER.
--
-- Para qué: el cuadro de opciones de render dibuja la onda del proyecto para ver
-- dónde empieza y termina el tema y elegir el tramo a renderizar (arrastrando o
-- escribiendo los segundos). El panel corre en Vercel y no ve los audios, así que
-- el script local la calcula y la publica aquí.
--
-- Por qué NO va dentro de render_inventario.proyectos: esa columna la relee el
-- script completa cada 2 minutos y el panel en cada carga; con 1,500 puntos por
-- versión la inflaba ~50 %, y el plan ya se pasó de egress en octubre. Aquí se
-- lee UNA fila (~2 KB) y sólo al abrir el cuadro de render.
--
-- La onda es una APROXIMACIÓN (suma de lo que hay en cada item): no pasa por
-- efectos, volúmenes ni envíos. Sirve para ver dónde hay sonido, no cómo suena.
--
-- Mientras esta tabla no exista el script no calcula nada (una sonda vacía por
-- corrida) y el cuadro de render funciona igual que siempre, sin onda.

create table if not exists public.render_ondas (
  -- La misma clave que render_inventario: tarea_id si es canción de EP/Álbum,
  -- si no proyecto_id. Con FK: al cerrarse un proyecto su inventario se borra y
  -- sus ondas se van en cascada.
  clave          text not null references public.render_inventario(clave) on delete cascade,
  -- Nombre del .rpp ("MELODY QA.rpp"). Cada versión tiene su onda.
  archivo        text not null,
  -- Fecha de modificación (ms) del .rpp con el que se calculó. El panel la
  -- compara con la del inventario: si no coinciden, la onda está desactualizada.
  mtime          bigint not null,
  -- Segundos que cubre la onda: del 0 al fin del último item. 0 = proyecto vacío.
  duracion       real not null,
  -- Un byte por punto (0-255, escala de raíz), en base64. ~8 puntos por segundo.
  picos          text not null,
  -- Items que se pudieron leer, y los que no (MP3, archivos que faltan…).
  items          integer not null default 0,
  omitidos       integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (clave, archivo)
);

-- Sólo el servidor (service role) la lee y la escribe; el panel pasa por
-- /api/admin/render/onda. Sin políticas = ningún usuario la ve directo.
alter table public.render_ondas enable row level security;
