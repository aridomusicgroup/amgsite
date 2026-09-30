import "server-only";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta } from "@/lib/drive-oauth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Dónde vive en Drive lo que se le manda a quien edita.
 *
 *   beat personalizado:  {proyecto} / EDICION / Media, MUSICOS…
 *   EP / álbum:          {álbum}    / EDICION / {tema} / Media, MUSICOS…
 *
 * En un álbum EDICION va ARRIBA de los temas, no adentro de cada uno, y es
 * decisión del dueño (2026-09-29): así se comparte UNA sola carpeta y quien
 * edita ve el disco entero en un lugar, en vez de diez carpetas sueltas en
 * "Compartidos conmigo". Y como se comparte sólo EDICION, no ve PREVIOS ni
 * ENTREGABLES del álbum.
 *
 * La caché es `edicion_carpetas` con subruta "":
 *   (proyecto_id, "") = {proyecto}/EDICION — la que se comparte, en los dos casos
 *   (tarea_id,    "") = {álbum}/EDICION/{tema} — la raíz del manifiesto del tema
 */

/** `{proyecto}/EDICION`. Es la carpeta que se comparte, sea álbum o no. */
export async function carpetaEdicionProyecto(sb: SB, proyectoId: string): Promise<string | null> {
  const enCache = await leer(sb, proyectoId, "");
  if (enCache) return enCache;

  const base = await carpetaDelProyecto(sb, proyectoId);
  if (!base) return null;
  const edicion = await buscarOCrearCarpeta("EDICION", base);
  if (edicion) await guardarCarpeta(sb, proyectoId, "", edicion);
  return edicion;
}

/**
 * La raíz de una clave: `{proyecto}/EDICION` o `{álbum}/EDICION/{tema}`.
 *
 * Devuelve `error` legible en vez de lanzar: lo llaman dos rutas que lo
 * traducen a una respuesta HTTP distinta cada una.
 */
export async function carpetaEdicionDe(
  sb: SB,
  d: { proyectoId: string; tareaId: string | null },
): Promise<{ id: string } | { error: string; status: number }> {
  const clave = d.tareaId || d.proyectoId;
  const enCache = await leer(sb, clave, "");
  if (enCache) return { id: enCache };

  const edicion = await carpetaEdicionProyecto(sb, d.proyectoId);
  if (!edicion) return { error: "No se pudo resolver la carpeta del proyecto.", status: 409 };
  if (!d.tareaId) return { id: edicion };

  const { data: t } = await sb.from("proyecto_tareas")
    .select("titulo, proyecto_id").eq("id", d.tareaId).maybeSingle();
  if (!t || t.proyecto_id !== d.proyectoId) return { error: "La canción ya no existe.", status: 409 };

  const tema = await buscarOCrearCarpeta(String(t.titulo), edicion);
  if (!tema) return { error: "No se pudo crear la carpeta de la canción.", status: 502 };
  await guardarCarpeta(sb, clave, "", tema);
  return { id: tema };
}

async function leer(sb: SB, clave: string, subruta: string): Promise<string | null> {
  const { data } = await sb.from("edicion_carpetas")
    .select("drive_id").eq("clave", clave).eq("subruta", subruta).maybeSingle();
  return (data?.drive_id as string | undefined) ?? null;
}

/** Cachea el id. `ignoreDuplicates` porque dos corridas solapadas pueden
 *  resolver la misma carpeta a la vez, y eso no es un error. */
export async function guardarCarpeta(sb: SB, clave: string, subruta: string, driveId: string): Promise<void> {
  try {
    await sb.from("edicion_carpetas").upsert(
      { clave, subruta, drive_id: driveId },
      { onConflict: "clave,subruta", ignoreDuplicates: true },
    );
  } catch {
    /* el id ya lo tenemos en memoria; cachearlo es una optimización */
  }
}
