import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TIPOS_CON_SUBIDA, TIPO_ALMACENAMIENTO_LABEL, DEFAULTS_MB_FALLBACK, limiteEfectivoMb } from "@/lib/almacenamiento";

export interface AlmacenamientoTipoRow {
  tipo: string;
  label: string;
  limiteMb: number;
}

export interface ProyectoAlmacenamientoRow {
  id: string;
  folio: string | null;
  titulo: string;
  tipo: string | null;
  cliente: string | null;
  estado: string;
  overrideMb: number | null;
  limiteMb: number;
}

/**
 * Defaults por tipo, listos para mostrar/editar. Si la tabla aún no existe
 * (SQL sin correr) o le falta un tipo, cae al fallback en código — nunca
 * revienta el panel de Pedidos por esto.
 */
export async function getAlmacenamientoTipos(): Promise<AlmacenamientoTipoRow[]> {
  const sb = supabaseAdmin();
  let porTipo: Record<string, number> = {};
  try {
    const { data } = await sb.from("almacenamiento_tipos_default").select("tipo, limite_mb");
    for (const r of data ?? []) porTipo[r.tipo as string] = Number(r.limite_mb) || 0;
  } catch {
    porTipo = {};
  }
  return TIPOS_CON_SUBIDA.map((tipo) => ({
    tipo,
    label: TIPO_ALMACENAMIENTO_LABEL[tipo] ?? tipo,
    limiteMb: porTipo[tipo] || DEFAULTS_MB_FALLBACK[tipo],
  }));
}

/** Mapa tipo → límite MB, para calcular el efectivo de cada proyecto sin re-consultar. */
async function mapaDefaults(sb: ReturnType<typeof supabaseAdmin>): Promise<Record<string, number>> {
  try {
    const { data } = await sb.from("almacenamiento_tipos_default").select("tipo, limite_mb");
    const m: Record<string, number> = {};
    for (const r of data ?? []) m[r.tipo as string] = Number(r.limite_mb) || 0;
    return m;
  } catch {
    return {};
  }
}

const ESTADOS_ACTIVOS = ["cola", "produccion", "revision", "pausado"];

/**
 * Proyectos de producción actualmente activos (no entregados/cerrados/
 * cancelados), con su límite efectivo ya calculado — para la pestaña
 * Almacenamiento dentro de Pedidos.
 */
export async function getProyectosActivosAlmacenamiento(): Promise<ProyectoAlmacenamientoRow[]> {
  const sb = supabaseAdmin();
  const defaults = await mapaDefaults(sb);

  // Solo los tipos donde el cliente de verdad sube archivos — "creacion_contenido",
  // "distribucion", "admin", etc. son proyectos internos sin subida de cliente.
  const withOverride = await sb
    .from("proyectos")
    .select("id, folio, titulo, tipo, estado, limite_almacenamiento_mb, contactos(nombre)")
    .eq("clase", "produccion")
    .in("estado", ESTADOS_ACTIVOS)
    .in("tipo", TIPOS_CON_SUBIDA as unknown as string[])
    .order("fecha_inicio", { ascending: false });

  const res = withOverride.error
    ? await sb
        .from("proyectos")
        .select("id, folio, titulo, tipo, estado, contactos(nombre)")
        .eq("clase", "produccion")
        .in("estado", ESTADOS_ACTIVOS)
        .in("tipo", TIPOS_CON_SUBIDA as unknown as string[])
        .order("fecha_inicio", { ascending: false })
    : withOverride;

  return (res.data ?? []).map((p) => {
    const tipo = (p.tipo as string | null) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overrideMb = "limite_almacenamiento_mb" in p ? (Number((p as any).limite_almacenamiento_mb) || null) : null;
    return {
      id: p.id as string,
      folio: (p.folio as string | null) ?? null,
      titulo: p.titulo as string,
      tipo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cliente: ((p.contactos as any)?.nombre as string | null) ?? null,
      estado: p.estado as string,
      overrideMb,
      limiteMb: limiteEfectivoMb(tipo, overrideMb, defaults),
    };
  });
}
