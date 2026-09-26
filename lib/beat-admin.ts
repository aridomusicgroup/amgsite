import "server-only";
import driveLinks from "@/data/drive-links.json";
import licensesRaw from "@/data/licenses.json";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { catalogoCompleto, beatParaPanel, esOriginal, preciosDeBeat, type CatalogBeat } from "@/lib/catalog";
import { overridesCarpetas, carpetaDelRepo } from "@/lib/beat-carpetas";
import { cuentaServicioEmail } from "@/lib/drive-api";
import { DIRECT_CHECKOUT_ENABLED } from "@/lib/site";
import { EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { fichaVacia, LICENCIAS, type FichaRow, type LicenciaId, type PreciosEfectivos } from "@/lib/beat-ficha";
import { nombreBeat, ventaEsDelBeat } from "@/lib/beat-nombre";
import type { Formato } from "@/lib/beats-auditoria";

/**
 * Lo que el panel de Beats necesita saber de cada beat: la lista con su
 * semáforo y la ficha completa de uno. SIN caché — quien edita tiene que ver
 * su cambio al instante (la tienda sí va cacheada, ver lib/catalog.ts).
 */

const jsonFolders = driveLinks as Record<string, { driveFolderId?: string }>;

const mismosPrecios = (a: PreciosEfectivos, b: PreciosEfectivos) => LICENCIAS.every((id) => a[id] === b[id]);

// ─── Lista ──────────────────────────────────────────────────────────────────

export interface BeatListaAdmin {
  id: string;
  title: string;
  url: string;
  bpm: number;
  key: string | null;
  genre: string;
  price: number;
  artworkUrl: string | null;
  beatstarsUrl: string | null;
  source: "original" | "agregado";
  entrega: "ok" | "sin_carpeta";
  /** false = la tienda no puede reproducirlo y el play manda a BeatStars. */
  audio: boolean;
  oculto: boolean;
  destacado: boolean;
  /** Videos / reels registrados. null = aún no existe la tabla. */
  publicaciones: number | null;
  /** ¿Algún precio distinto al de siempre? */
  precioPropio: boolean;
}

/** Los agregados sin tonalidad traen "—"; el panel lo quiere vacío para marcarlo. */
const sinGuion = (k: string): string | null => (k && k !== "—" ? k : null);

async function contarPublicaciones(): Promise<Map<string, number> | null> {
  try {
    const { data, error } = await supabaseAdmin().from("beat_publicaciones").select("beat_id");
    if (error) return null;
    const out = new Map<string, number>();
    for (const r of data ?? []) out.set(r.beat_id as string, (out.get(r.beat_id as string) ?? 0) + 1);
    return out;
  } catch {
    return null;
  }
}

async function carpetasDeLaTabla(): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  try {
    const { data } = await supabaseAdmin().from("beats").select("id, drive_folder_id");
    for (const r of data ?? []) out.set(r.id as string, Boolean(r.drive_folder_id));
  } catch {
    /* sin DB → los agregados quedan como sin carpeta (conservador) */
  }
  return out;
}

export async function listarBeatsAdmin(): Promise<BeatListaAdmin[]> {
  const [{ beats }, dbFolders, manual, pubs] = await Promise.all([
    catalogoCompleto(), carpetasDeLaTabla(), overridesCarpetas(), contarPublicaciones(),
  ]);

  return beats.map((b) => {
    const original = esOriginal(b.id);
    // Sin carpeta = se vende pero el cliente paga y NO recibe descarga.
    const tieneCarpeta =
      manual.has(b.id) || (original ? Boolean(jsonFolders[b.id]?.driveFolderId) : dbFolders.get(b.id) === true);
    return {
      id: b.id,
      title: b.title,
      url: b.url,
      bpm: b.bpm,
      key: sinGuion(b.key),
      genre: b.genre,
      price: b.price,
      artworkUrl: b.artworkUrl,
      beatstarsUrl: b.beatstarsUrl,
      source: original ? "original" : "agregado",
      entrega: tieneCarpeta ? "ok" : "sin_carpeta",
      audio: Boolean(b.hlsUrl || b.previewUrl),
      oculto: b.oculto,
      destacado: b.destacado,
      publicaciones: pubs ? pubs.get(b.id) ?? 0 : null,
      precioPropio: !mismosPrecios(b.precios, preciosDeBeat(b.id, null)),
    };
  });
}

// ─── Detalle ────────────────────────────────────────────────────────────────

export type CanalPublicacion = "youtube" | "instagram" | "tiktok" | "facebook" | "otro";

export interface PublicacionBeat {
  id: string;
  canal: CanalPublicacion;
  url: string;
  titulo: string | null;
  miniatura: string | null;
  publicado_at: string | null;
  mostrar_en_tienda: boolean;
  social_post_id: string | null;
  /** Números del reel, si está ligado a uno que ya sincronizamos. */
  metricas: { reproducciones: number; likes: number; comentarios: number } | null;
}

export interface SugerenciaIg {
  id: string;
  permalink: string;
  caption: string;
  thumbnail: string | null;
  publicado_at: string | null;
  reproducciones: number;
}

export interface VentaBeat {
  id: string;
  folio: string | null;
  fecha: string;
  tipo: string | null;
  canal: string | null;
  moneda: string;
  /** Lo que se cobró por ESTE beat, en la moneda de la venta. */
  monto: number;
  /** Lo mismo en pesos (para sumar ventas de monedas distintas). */
  mxn: number;
  cliente: string | null;
  /** Licencia exacta (sólo ventas web nuevas); si no, la dice `tipo`. */
  licencia: string | null;
  /** Cómo se ligó: por id guardado, por el inventario o por nombre. */
  via: "id" | "inventario" | "nombre";
  /** Pedido web con más de un beat: el monto es sólo la parte de este. */
  parcial: boolean;
}

export interface CarpetaDetalle {
  folderId: string;
  manual: boolean;
  /** Última foto guardada al asignarla a mano (no es la verdad de Drive). */
  archivos: Partial<Record<Formato, number>> | null;
}

export interface BeatDetalleAdmin {
  id: string;
  source: "original" | "agregado";
  nombreCorto: string;
  beat: CatalogBeat;
  /** Lo que el beat trae de su fuente: lo que vuelve al restablecer un campo. */
  base: { bpm: number; key: string | null; genre: string; artists: string[]; mood: string; tags: string[]; artworkUrl: string | null; artworkLarge: string | null };
  preciosBase: PreciosEfectivos;
  /** Precio global de la exclusiva cuando se vende directo ($600). */
  exclusivaDirectaGlobal: number;
  ficha: FichaRow;
  /** false = falta correr supabase-beat-ficha.sql: el panel avisa y no deja guardar. */
  tablaFicha: boolean;
  audio: boolean;
  carpeta: CarpetaDetalle | null;
  publicaciones: PublicacionBeat[] | null;
  sugerenciasIg: SugerenciaIg[];
  /** null = quien mira no es admin (las ventas son dinero). */
  ventas: VentaBeat[] | null;
  directCheckout: boolean;
  cuentaServicio: string | null;
}

export async function carpetaDe(id: string, source: "original" | "agregado", fila: Record<string, unknown> | null): Promise<CarpetaDetalle | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("beat_carpetas").select("drive_folder_id, archivos").eq("beat_id", id).maybeSingle();
    if (data?.drive_folder_id) {
      return { folderId: data.drive_folder_id as string, manual: true, archivos: (data.archivos as CarpetaDetalle["archivos"]) ?? null };
    }
  } catch {
    /* tabla aún no creada */
  }
  const auto = source === "original" ? carpetaDelRepo(id)?.driveFolderId : (fila?.drive_folder_id as string | undefined);
  return auto ? { folderId: auto, manual: false, archivos: null } : null;
}

async function publicacionesDe(id: string): Promise<PublicacionBeat[] | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("beat_publicaciones")
    .select("id, canal, url, titulo, miniatura, publicado_at, mostrar_en_tienda, social_post_id")
    .eq("beat_id", id)
    .order("publicado_at", { ascending: false, nullsFirst: false });
  if (error) return null;
  const filas = data ?? [];
  const ids = filas.map((p) => p.social_post_id).filter(Boolean) as string[];
  const metricas = new Map<string, PublicacionBeat["metricas"]>();
  if (ids.length) {
    const { data: posts } = await sb.from("social_posts").select("id, reproducciones, likes, comentarios").in("id", ids);
    for (const p of posts ?? []) {
      metricas.set(p.id as string, {
        reproducciones: Number(p.reproducciones) || 0, likes: Number(p.likes) || 0, comentarios: Number(p.comentarios) || 0,
      });
    }
  }
  return filas.map((p) => ({
    ...(p as Omit<PublicacionBeat, "metricas">),
    metricas: p.social_post_id ? metricas.get(p.social_post_id as string) ?? null : null,
  }));
}

/**
 * Reels ya sincronizados cuyo texto menciona el beat y que todavía no están
 * ligados. Se compara palabra completa: "SOLO" no sugiere un reel de "SOLOS".
 */
async function sugerenciasIgDe(nombreCorto: string, yaLigados: Set<string>): Promise<SugerenciaIg[]> {
  const nombre = nombreCorto.trim();
  if (nombre.length < 3) return [];
  try {
    const { data } = await supabaseAdmin()
      .from("social_posts")
      .select("id, permalink, caption, thumbnail_url, publicado_at, reproducciones")
      .ilike("caption", `%${nombre.replace(/[%_]/g, "")}%`)
      .order("publicado_at", { ascending: false })
      .limit(20);
    const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const palabra = new RegExp(`(^|[^\\p{L}\\p{N}])${escapado}($|[^\\p{L}\\p{N}])`, "iu");
    return (data ?? [])
      .filter((p) => !yaLigados.has(p.id as string) && p.permalink && palabra.test(String(p.caption ?? "")))
      .slice(0, 6)
      .map((p) => ({
        id: p.id as string,
        permalink: p.permalink as string,
        caption: String(p.caption ?? "").slice(0, 140),
        thumbnail: (p.thumbnail_url as string) ?? null,
        publicado_at: (p.publicado_at as string) ?? null,
        reproducciones: Number(p.reproducciones) || 0,
      }));
  } catch {
    return [];
  }
}

const NOMBRE_LICENCIA = Object.fromEntries(
  (licensesRaw as Array<{ id: string; name: { es: string } }>).map((l) => [l.id, l.name.es]),
) as Record<LicenciaId, string>;

/**
 * Las ventas de este beat. Las ventas no guardan el id del beat, así que se
 * ligan en este orden: por el id del renglón del pedido web (desde que existe
 * `order_items.beat_id`), por el inventario enlazado al catálogo, y por nombre.
 */
async function ventasDe(id: string, tituloCrudo: string, tituloLimpio: string): Promise<VentaBeat[]> {
  const sb = supabaseAdmin();
  const [ventasRes, invRes] = await Promise.all([
    sb.from("ventas")
      .select("id, folio, fecha, tipo, canal, moneda, monto_cobrado, total_mxn, tipo_cambio, beat_nombre, inventario_beat_id, contactos(nombre)")
      .order("fecha", { ascending: false })
      .limit(3000),
    sb.from("inventario_beats").select("id").eq("catalogo_beat_id", id),
  ]);
  const inventario = new Set((invRes.data ?? []).map((r) => r.id as string));

  type Fila = {
    id: string; folio: string | null; fecha: string; tipo: string | null; canal: string | null; moneda: string | null;
    monto_cobrado: number | null; total_mxn: number | null; tipo_cambio: number | null; beat_nombre: string | null;
    inventario_beat_id: string | null; contactos: { nombre: string | null } | { nombre: string | null }[] | null;
  };
  const filas = (ventasRes.data ?? []) as unknown as Fila[];
  const ligadas: { v: Fila; via: VentaBeat["via"] }[] = [];
  for (const v of filas) {
    if (v.inventario_beat_id && inventario.has(v.inventario_beat_id)) ligadas.push({ v, via: "inventario" });
    else if (ventaEsDelBeat(v.beat_nombre, tituloCrudo, tituloLimpio)) ligadas.push({ v, via: "nombre" });
  }

  // Pedidos web: el monto y la licencia de ESTE beat salen de su renglón.
  const sesiones = ligadas.map(({ v }) => v.folio).filter((f): f is string => Boolean(f?.startsWith("WEB-"))).map((f) => f.slice(4));
  const renglones = new Map<string, { amount: number; license_id: string | null; porId: boolean }>();
  if (sesiones.length) {
    const consulta = (cols: string) =>
      sb.from("orders").select(`stripe_session_id, order_items(${cols})`).in("stripe_session_id", sesiones);
    let res = await consulta("description, amount, beat_id, license_id");
    if (res.error) res = await consulta("description, amount");
    for (const o of (res.data ?? []) as unknown as { stripe_session_id: string; order_items: Record<string, unknown>[] }[]) {
      const items = o.order_items ?? [];
      const mio = items.find((it) => it.beat_id === id) ??
        items.find((it) => ventaEsDelBeat(String(it.description ?? ""), tituloCrudo, tituloLimpio));
      if (mio) {
        renglones.set(o.stripe_session_id, {
          amount: Number(mio.amount) || 0,
          license_id: (mio.license_id as string | undefined) ?? null,
          porId: mio.beat_id === id,
        });
      }
    }
  }

  return ligadas.map(({ v, via }) => {
    const moneda = (v.moneda || "MXN").toUpperCase();
    const monto = Number(v.monto_cobrado) || 0;
    const mxn = Number(v.total_mxn) || 0;
    const r = v.folio?.startsWith("WEB-") ? renglones.get(v.folio.slice(4)) : undefined;
    const parcial = Boolean(r && monto > 0 && Math.abs(r.amount - monto) > 0.5);
    const cliente = Array.isArray(v.contactos) ? v.contactos[0]?.nombre ?? null : v.contactos?.nombre ?? null;
    return {
      id: v.id,
      folio: v.folio,
      fecha: v.fecha,
      tipo: v.tipo,
      canal: v.canal,
      moneda,
      monto: r ? r.amount : monto,
      mxn: r && monto > 0 ? Math.round(mxn * (r.amount / monto) * 100) / 100 : mxn,
      cliente,
      licencia: r?.license_id ? NOMBRE_LICENCIA[r.license_id as LicenciaId] ?? r.license_id : null,
      via: r?.porId ? "id" : via,
      parcial,
    };
  });
}

export async function getBeatAdmin(id: string, opts: { verVentas: boolean }): Promise<BeatDetalleAdmin | null> {
  const p = await beatParaPanel(id);
  if (!p) return null;

  const nombreCorto = nombreBeat(p.tituloCrudo) || p.beat.title;
  const [carpeta, publicaciones, ventas] = await Promise.all([
    carpetaDe(id, p.source, p.fila),
    p.tablaFicha ? publicacionesDe(id) : Promise.resolve(null),
    opts.verVentas ? ventasDe(id, p.tituloCrudo, p.beat.title) : Promise.resolve(null),
  ]);
  const ligados = new Set((publicaciones ?? []).map((x) => x.social_post_id).filter(Boolean) as string[]);
  const sugerenciasIg = publicaciones ? await sugerenciasIgDe(nombreCorto, ligados) : [];

  return {
    id,
    source: p.source,
    nombreCorto,
    beat: p.beat,
    base: {
      bpm: p.base.bpm,
      key: sinGuion(p.base.key),
      genre: p.base.genre,
      artists: p.base.artists,
      mood: p.base.mood,
      tags: p.base.tags,
      artworkUrl: p.base.artworkUrl,
      artworkLarge: p.base.artworkLarge,
    },
    preciosBase: p.preciosBase,
    exclusivaDirectaGlobal: EXCLUSIVE_DIRECT_PRICE,
    ficha: p.ficha ?? fichaVacia(id),
    tablaFicha: p.tablaFicha,
    audio: Boolean(p.beat.hlsUrl || p.beat.previewUrl),
    carpeta,
    publicaciones,
    sugerenciasIg,
    ventas,
    directCheckout: DIRECT_CHECKOUT_ENABLED,
    cuentaServicio: cuentaServicioEmail(),
  };
}
