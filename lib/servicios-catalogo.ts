import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CATALOGO_SEMILLA, type Catalogo, type Extra, type Paquete, type ServicioEstudio } from "@/lib/servicios";

/** Etiqueta de caché: al guardar en /admin/servicios se invalida al instante. */
export const TAG_SERVICIOS = "servicios";

interface Fila {
  tipo: "base" | "extra" | "studio";
  id: string;
  orden: number;
  activo: boolean;
  datos: Record<string, unknown>;
}

/** Arma el catálogo con la MISMA forma que tenía el JSON, con `activo` en cada elemento. */
function armar(filas: Fila[]): Catalogo {
  const de = (t: Fila["tipo"]) => filas.filter((f) => f.tipo === t).sort((a, b) => a.orden - b.orden);
  return {
    currency: CATALOGO_SEMILLA.currency,
    bases: de("base").map((f) => ({ id: f.id, activo: f.activo, ...f.datos }) as unknown as Paquete),
    extras: de("extra").map((f) => ({ graba: true, ...f.datos, id: f.id, activo: f.activo }) as unknown as Extra),
    studio: de("studio").map((f) => ({ id: f.id, activo: f.activo, ...f.datos }) as unknown as ServicioEstudio),
  };
}

/** Falta la config de Supabase (desarrollo local) o la tabla aún no se crea: la semilla es lo correcto. */
const sinBaseConfigurada = (msg: string) =>
  /no configurado/i.test(msg) || (/servicios_catalogo/i.test(msg) && /(does not exist|schema cache)/i.test(msg));

/**
 * Lee la tabla. Devuelve `null` sólo cuando no hay nada que leer (tabla sin
 * crear, sin config, o vacía): ahí la semilla es la respuesta correcta. Un
 * fallo TRANSITORIO de Supabase se lanza, para que no se cachee la semilla
 * durante 60 s — con un paquete oculto eso lo reabriría en el cobro.
 */
async function leerTabla(): Promise<Catalogo | null> {
  let res;
  try {
    res = await supabaseAdmin().from("servicios_catalogo").select("tipo, id, orden, activo, datos");
  } catch (e) {
    if (sinBaseConfigurada(String((e as Error)?.message))) return null;
    throw e;
  }
  if (res.error) {
    if (sinBaseConfigurada(res.error.message)) return null;
    throw new Error(res.error.message);
  }
  return res.data?.length ? armar(res.data as Fila[]) : null;
}

const cacheado = unstable_cache(async () => (await leerTabla()) ?? CATALOGO_SEMILLA, ["servicios-catalogo"], {
  revalidate: 60,
  tags: [TAG_SERVICIOS],
});

/**
 * El catálogo COMPLETO (incluye ocultos), cacheado 60 s.
 *
 * Para la web pública pásalo por `catalogoPublico()`. Para reconocer
 * conceptos de cotizaciones/ventas (instrumentos, "incluye…") úsalo completo:
 * un paquete que ya no se vende sigue apareciendo en cotizaciones viejas.
 *
 * Si Supabase falla en ese momento, cae a la semilla SIN cachearla y sigue
 * (una venta que ya se cobró no puede quedarse sin armar por un parpadeo).
 * Para cobrar usa `getCatalogoEstricto`.
 */
export async function getCatalogo(): Promise<Catalogo> {
  try {
    return await cacheado();
  } catch {
    return CATALOGO_SEMILLA;
  }
}

/** Igual, pero si la base falla LANZA: el cobro prefiere fallar a cobrar con precios viejos. */
export function getCatalogoEstricto(): Promise<Catalogo> {
  return cacheado();
}

/** Sin caché: para el panel de edición (acabas de guardar y tienes que verlo). */
export async function getCatalogoFresco(): Promise<{ catalogo: Catalogo; enBase: boolean }> {
  const t = await leerTabla();
  return { catalogo: t ?? CATALOGO_SEMILLA, enBase: t !== null };
}
