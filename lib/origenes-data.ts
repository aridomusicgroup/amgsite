import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clasificarReel, esTipoReel, mediana } from "@/lib/tipo-reel";

/**
 * De dónde llegan los clientes, mes a mes, y qué contenido los trae.
 *
 * Lo que se mide es el ORIGEN del contacto (`contactos.origen`), no el canal
 * donde se cerró la venta: casi todo se cierra por WhatsApp, pero llega de
 * Instagram, TikTok o BeatStars. Todo es tolerante a que el SQL nuevo no se
 * haya corrido: sin él salen los números por canal y faltan reel y clics.
 */

export interface FilaOrigen {
  origen: string;
  /** Contactos que entraron ese mes. */
  nuevos: number;
  /** De esos, cuántos ya compraron (en cualquier fecha). */
  compradores: number;
  /** Ventas del mes de clientes con ese origen. */
  ventas: number;
  ventasMxn: number;
  /** Clics en el enlace de la bio de ese canal. */
  clics: number;
}

export interface MesOrigenes {
  mes: string;                 // "2026-09"
  medianaReel: number;         // mediana de reproducciones de los reels publicados ese mes
  reels: number;
  filas: FilaOrigen[];
}

export interface ResumenOrigenes {
  meses: MesOrigenes[];        // del más viejo al actual
  /** Instagram, últimos 90 días: de los contactos que llegaron, cuántos compraron. */
  conversionIg: { contactos: number; compradores: number; pct: number };
  tipos: { tipo: string | null; reels: number; mediana: number; pctReproducciones: number }[];
  reelsConClientes: {
    id: string; caption: string; permalink: string | null; publicado_at: string | null;
    reproducciones: number; clientes: number; ventasMxn: number;
  }[];
  sinOrigen: { clientes: number; ventasMxn: number };
  /** false = falta supabase-origen-clientes.sql (sin reel de origen ni clics). */
  completo: boolean;
}

type Fila = Record<string, unknown>;
const MESES_ATRAS = 4;
const DIA = 86_400_000;

async function todas(sb: ReturnType<typeof supabaseAdmin>, tabla: string, cols: string): Promise<{ data: Fila[]; error: boolean }> {
  const out: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from(tabla).select(cols).range(desde, desde + 999);
    if (error) return { data: out, error: true };
    out.push(...((data ?? []) as unknown as Fila[]));
    if (!data || data.length < 1000) break;
  }
  return { data: out, error: false };
}

const mesDe = (iso: unknown) => String(iso ?? "").slice(0, 7);

export async function getResumenOrigenes(): Promise<ResumenOrigenes> {
  const sb = supabaseAdmin();
  const hoy = new Date();
  const meses: string[] = [];
  for (let i = MESES_ATRAS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  const desde = `${meses[0]}-01`;

  let contactosRes = await todas(sb, "contactos", "id, origen, created_at, merged_into, origen_post_id");
  const completo = !contactosRes.error;
  if (contactosRes.error) contactosRes = await todas(sb, "contactos", "id, origen, created_at, merged_into");
  const ventasRes = await todas(sb, "ventas", "contacto_id, total_mxn, fecha");

  const leerPosts = (cols: string) => sb.from("social_posts").select(cols)
    .order("publicado_at", { ascending: false }).limit(300);
  let postsQ = await leerPosts("id, caption, permalink, publicado_at, reproducciones, tipo_contenido, tipo_manual");
  if (postsQ.error) postsQ = await leerPosts("id, caption, permalink, publicado_at, reproducciones");
  const clicsQ = await sb.from("clics_enlace").select("canal, creado_at").gte("creado_at", desde).limit(20000);

  const contactos = contactosRes.data.filter((c) => !c.merged_into);
  const ventas = ventasRes.data;
  const posts = ((postsQ.data ?? []) as unknown as Fila[]);
  const clics = clicsQ.error ? [] : ((clicsQ.data ?? []) as unknown as Fila[]);

  const origenDe = new Map(contactos.map((c) => [c.id as string, (c.origen as string | null) ?? null]));
  const compro = new Set(ventas.map((v) => v.contacto_id as string | null).filter(Boolean) as string[]);

  // ── Por mes y por origen ──
  const mesesOut: MesOrigenes[] = meses.map((mes) => {
    const filas = new Map<string, FilaOrigen>();
    const fila = (origen: string) => {
      if (!filas.has(origen)) filas.set(origen, { origen, nuevos: 0, compradores: 0, ventas: 0, ventasMxn: 0, clics: 0 });
      return filas.get(origen)!;
    };
    for (const c of contactos) {
      if (mesDe(c.created_at) !== mes) continue;
      const f = fila((c.origen as string | null) ?? "sin_origen");
      f.nuevos++;
      if (compro.has(c.id as string)) f.compradores++;
    }
    for (const v of ventas) {
      if (mesDe(v.fecha) !== mes) continue;
      const cid = v.contacto_id as string | null;
      const f = fila((cid && origenDe.get(cid)) || "sin_origen");
      f.ventas++;
      f.ventasMxn += Number(v.total_mxn) || 0;
    }
    for (const k of clics) {
      if (mesDe(k.creado_at) === mes) fila(String(k.canal)).clics++;
    }
    const delMes = posts.filter((p) => mesDe(p.publicado_at) === mes);
    return {
      mes,
      medianaReel: mediana(delMes.map((p) => Number(p.reproducciones) || 0)),
      reels: delMes.length,
      filas: [...filas.values()].sort((a, b) => b.ventasMxn - a.ventasMxn || b.nuevos - a.nuevos),
    };
  });

  // ── Conversión de Instagram, últimos 90 días ──
  const hace90 = Date.now() - 90 * DIA;
  const igRecientes = contactos.filter((c) => c.origen === "instagram" && Date.parse(String(c.created_at)) >= hace90);
  const igCompradores = igRecientes.filter((c) => compro.has(c.id as string)).length;

  // ── Qué tipo de reel rinde (últimos 90 días) ──
  const posts90 = posts.filter((p) => Date.parse(String(p.publicado_at)) >= hace90);
  const totalRepro = posts90.reduce((a, p) => a + (Number(p.reproducciones) || 0), 0) || 1;
  const porTipo = new Map<string | null, number[]>();
  for (const p of posts90) {
    const tipo = p.tipo_manual && esTipoReel(p.tipo_contenido) ? (p.tipo_contenido as string) : clasificarReel(p.caption as string | null);
    const arr = porTipo.get(tipo) ?? [];
    arr.push(Number(p.reproducciones) || 0);
    porTipo.set(tipo, arr);
  }
  const tipos = [...porTipo.entries()]
    .map(([tipo, nums]) => ({
      tipo,
      reels: nums.length,
      mediana: mediana(nums),
      pctReproducciones: Math.round((nums.reduce((a, n) => a + n, 0) / totalRepro) * 100),
    }))
    .sort((a, b) => b.mediana - a.mediana);

  // ── Reels que trajeron clientes ──
  const porReel = new Map<string, { clientes: Set<string>; ventasMxn: number }>();
  if (completo) {
    for (const c of contactos) {
      const pid = c.origen_post_id as string | null;
      if (!pid) continue;
      const r = porReel.get(pid) ?? { clientes: new Set<string>(), ventasMxn: 0 };
      r.clientes.add(c.id as string);
      porReel.set(pid, r);
    }
    const reelDeContacto = new Map(contactos.filter((c) => c.origen_post_id).map((c) => [c.id as string, c.origen_post_id as string]));
    for (const v of ventas) {
      const pid = reelDeContacto.get(v.contacto_id as string);
      if (pid) porReel.get(pid)!.ventasMxn += Number(v.total_mxn) || 0;
    }
  }
  const postPorId = new Map(posts.map((p) => [p.id as string, p]));
  const reelsConClientes = [...porReel.entries()]
    .map(([id, r]) => {
      const p = postPorId.get(id);
      return {
        id,
        caption: (p?.caption as string | null) ?? "",
        permalink: (p?.permalink as string | null) ?? null,
        publicado_at: (p?.publicado_at as string | null) ?? null,
        reproducciones: Number(p?.reproducciones) || 0,
        clientes: r.clientes.size,
        ventasMxn: r.ventasMxn,
      };
    })
    .sort((a, b) => b.ventasMxn - a.ventasMxn || b.clientes - a.clientes)
    .slice(0, 10);

  // ── Clientes con compras y sin origen: lo que hay que ir llenando ──
  const sinOrigenIds = new Set(contactos.filter((c) => !c.origen && compro.has(c.id as string)).map((c) => c.id as string));
  const sinOrigenMxn = ventas
    .filter((v) => !v.contacto_id || sinOrigenIds.has(v.contacto_id as string))
    .reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);

  return {
    meses: mesesOut,
    conversionIg: {
      contactos: igRecientes.length,
      compradores: igCompradores,
      pct: igRecientes.length ? Math.round((igCompradores / igRecientes.length) * 100) : 0,
    },
    tipos,
    reelsConClientes,
    sinOrigen: { clientes: sinOrigenIds.size, ventasMxn: sinOrigenMxn },
    completo,
  };
}
