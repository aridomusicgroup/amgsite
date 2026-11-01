/**
 * Qué .rpp ofrece el botón "Abrir en REAPER" del tablero de Producción y de la
 * sección REAPER.
 *
 * Sale del inventario que publica el script del estudio (render_inventario):
 * el panel corre en Vercel y no ve el disco. En una carpeta puede haber más de
 * un .rpp ("DE NEGRO.rpp", "DE NEGRO v2.rpp"…) y en un EP cada tema tiene su
 * carpeta, así que se ofrecen todos, del modificado más reciente al más viejo:
 * el primero es la sugerencia.
 *
 * El enlace `arido-reaper://` lo atiende reaper-sync/abrir-reaper.js, que sólo
 * abre un .rpp que exista dentro de la carpeta de proyectos del estudio.
 */

export interface RppOpcion {
  /** Ruta completa del .rpp en la compu del estudio. */
  ruta: string;
  archivo: string;
  mtime: number;
  /** El tema, cuando el proyecto es un EP/Álbum. */
  tema: string | null;
}

interface ConInventario {
  titulo: string;
  album: string | null;
  inventario: { carpeta: string | null; proyectos: { archivo: string; mtime: number }[] } | null;
}

/** Todos los .rpp de un proyecto (o de los temas de un EP), el más reciente primero. */
export function opcionesRpp(items: ConInventario[]): RppOpcion[] {
  const out: RppOpcion[] = [];
  for (const it of items) {
    const carpeta = it.inventario?.carpeta?.replace(/[\\/]+$/, "");
    if (!carpeta) continue;
    for (const a of it.inventario?.proyectos ?? []) {
      out.push({ ruta: `${carpeta}\\${a.archivo}`, archivo: a.archivo, mtime: a.mtime, tema: it.album ? it.titulo : null });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export const enlaceReaper = (ruta: string): string => `arido-reaper://abrir?ruta=${encodeURIComponent(ruta)}`;

/** "hace 3 h": para elegir entre versiones importa más eso que la fecha exacta. */
export function haceCuanto(mtime: number, ahora: number = Date.now()): string {
  const min = Math.round((ahora - mtime) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}
