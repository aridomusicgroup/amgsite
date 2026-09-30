import "server-only";
import { unstable_cache } from "next/cache";
import raw from "@/data/diseno.json";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sinCosto, type EjemploDiseno, type ServicioDiseno, type ServicioDisenoPublico } from "@/lib/diseno";

/**
 * El catálogo de diseño visual, CON el costo del diseñador.
 *
 * Vive en la tabla `diseno_catalogo` (se edita en /admin/servicios → Diseño);
 * `data/diseno.json` queda de semilla y de respaldo si la tabla no existe.
 *
 * server-only a propósito: el costo no puede terminar en el JS público (la
 * landing se vende con marca ARIDO; con su lista a la vista, el artista le
 * escribe directo). La landing recibe `catalogoDisenoPublico()`; el panel, que
 * va con sesión, el completo.
 */

/** Etiqueta de caché: al guardar en el panel se invalida al instante. */
export const TAG_DISENO = "diseno";

/** A quién se le paga el diseño. Mismo nombre que su fila en `musicos`. */
export const PROVEEDOR_DISENO = "Julio Guerrero";

const valido = (s: ServicioDiseno): boolean =>
  !!s.id && !!s.nombre?.es && Number(s.precio) > 0 && Number(s.costo) >= 0;

/** La semilla: el archivo, todo visible. */
const SEMILLA: ServicioDiseno[] = (raw.servicios as unknown as ServicioDiseno[]).filter(valido);

interface Fila { id: string; orden: number; activo: boolean; datos: Record<string, unknown> }

const sinBaseConfigurada = (msg: string) =>
  /no configurado/i.test(msg) || (/diseno_catalogo/i.test(msg) && /(does not exist|schema cache)/i.test(msg));

/**
 * Lee la tabla. `null` sólo cuando no hay nada que leer (sin crear, sin config o
 * vacía); un fallo transitorio se lanza para que la semilla no se cachee 60 s
 * (reabriría lo oculto y traería precios viejos).
 */
async function leerTabla(): Promise<ServicioDiseno[] | null> {
  let res;
  try {
    res = await supabaseAdmin().from("diseno_catalogo").select("id, orden, activo, datos").order("orden");
  } catch (e) {
    if (sinBaseConfigurada(String((e as Error)?.message))) return null;
    throw e;
  }
  if (res.error) {
    if (sinBaseConfigurada(res.error.message)) return null;
    throw new Error(res.error.message);
  }
  if (!res.data?.length) return null;
  return (res.data as Fila[])
    .map((f) => ({ ...f.datos, id: f.id, activo: f.activo }) as unknown as ServicioDiseno)
    .filter(valido);
}

const cacheado = unstable_cache(async () => (await leerTabla()) ?? SEMILLA, ["diseno-catalogo"], {
  revalidate: 60,
  tags: [TAG_DISENO],
});

/**
 * TODO el catálogo (incluye lo oculto), con costo. Es el que sirve para
 * reconocer conceptos de cotizaciones viejas y calcular lo que se le debe al
 * diseñador. Si Supabase falla en ese momento cae a la semilla sin cachearla.
 */
export async function catalogoDiseno(): Promise<ServicioDiseno[]> {
  try {
    return await cacheado();
  } catch {
    return SEMILLA;
  }
}

/** Sólo lo que hoy se ofrece, SIN costo: lo único que puede salir al público. */
export async function catalogoDisenoPublico(): Promise<ServicioDisenoPublico[]> {
  return sinCosto((await catalogoDiseno()).filter((s) => s.activo !== false));
}

/** Sin caché, para el panel de edición. */
export async function catalogoDisenoFresco(): Promise<{ catalogo: ServicioDiseno[]; enBase: boolean }> {
  const t = await leerTabla();
  return { catalogo: t ?? SEMILLA, enBase: t !== null };
}

/** Muestras de trabajo para la landing (imágenes en /public). Vacío = no se muestra la sección. */
export function ejemplosDiseno(): EjemploDiseno[] {
  const lista = (raw as { ejemplos?: unknown }).ejemplos;
  return (Array.isArray(lista) ? lista : [])
    .filter((e): e is EjemploDiseno => !!e && typeof e.src === "string" && e.src.startsWith("/"))
    .map((e) => ({ src: e.src, alt: String(e.alt || "Diseño para artista") }));
}
