import "server-only";
import { papeleraCarpeta } from "@/lib/drive-oauth";

/**
 * Las pistas que mandó un músico: si ya están todas, y cómo quitar una.
 *
 * Quitar existe porque Jorge subió su trombón al proyecto equivocado y no había
 * forma de deshacerlo: la pista bajó a la PC, intentó entrar a un .rpp que no
 * era el suyo y ahí se quedó. Qué pasa al quitar depende de hasta dónde llegó:
 *
 *   sólo en Drive   → papelera de Drive (recuperable 30 días) y se borra la fila.
 *   ya en la PC     → se marca `retirar_at`; reaper-sync borra el wav, y si ya
 *                     había entrado al .rpp le quita esa toma (con respaldo).
 *
 * El músico puede quitarla hasta que entra a REAPER; después, sólo el estudio.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/** Los slots de sus pistas vigentes. Una pista que se está retirando ya no cuenta. */
async function slotsVigentes(sb: SB, asignacionId: string): Promise<Set<number>> {
  const leer = (cols: string) => sb.from("musico_archivos").select(cols).eq("asignacion_id", asignacionId).eq("clase", "stem");
  let r = await leer("slot, retirar_at");
  if (r.error) r = await leer("slot");
  const filas = (r.data ?? []) as { slot: number | null; retirar_at?: string | null }[];
  return new Set(filas.filter((s) => !s.retirar_at).map((s) => Number(s.slot) || 0));
}

/**
 * ¿Ya llegaron todas las pistas que se le piden? Una por canal del instrumento
 * (`instrumento_pistas.canales`, p. ej. Charchetas = "L, R"); sin canales, una.
 * Mismo criterio que los botones del portal (`SubirParte`): hueco 0..n-1.
 */
export async function pistasCompletas(sb: SB, asignacionId: string, instrumento: string): Promise<boolean> {
  const [{ data: mapa }, llegaron] = await Promise.all([
    sb.from("instrumento_pistas").select("instrumento, canales"),
    slotsVigentes(sb, asignacionId),
  ]);
  const fila = ((mapa ?? []) as { instrumento: string; canales: string | null }[])
    .find((m) => norm(String(m.instrumento)) === norm(instrumento));
  const canales = String(fila?.canales ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const pedidos = Math.max(1, canales.length);
  for (let i = 0; i < pedidos; i++) if (!llegaron.has(i)) return false;
  return true;
}

/**
 * Lo contrario de palomear sola la tarea al llegar la última pista: si al quitar
 * una ya no están todas, "Grabar X" se reabre y la asignación vuelve a pendiente.
 * Sin esto la tarea diría "hecha" con la pista en la papelera.
 *
 * Devuelve el título de lo que se reabrió, o null.
 */
export async function reabrirTareaDelMusico(sb: SB, asignacionId: string): Promise<string | null> {
  try {
    const { data: asig } = await sb.from("musico_asignaciones")
      .select("id, tarea_id, instrumento, estado").eq("id", asignacionId).maybeSingle();
    if (!asig) return null;
    if (await pistasCompletas(sb, asig.id, asig.instrumento)) return null;

    if (asig.estado === "entregado") {
      await sb.from("musico_asignaciones")
        .update({ estado: "pendiente", updated_at: new Date().toISOString() }).eq("id", asig.id);
    }
    if (!asig.tarea_id) return null;

    const buscado = norm(`Grabar ${asig.instrumento}`);
    const { data: t } = await sb.from("proyecto_tareas")
      .select("id, titulo, hecho, es_cancion").eq("id", asig.tarea_id).maybeSingle();
    if (!t) return null;

    if (t.es_cancion) {
      const { data: subs } = await sb.from("proyecto_subtareas").select("id, titulo, hecho").eq("tarea_id", t.id);
      const sub = ((subs ?? []) as { id: string; titulo: string; hecho: boolean }[])
        .find((s) => s.hecho && norm(s.titulo) === buscado);
      if (!sub) return null;
      await sb.from("proyecto_subtareas").update({ hecho: false }).eq("id", sub.id);
      return `${sub.titulo} · ${t.titulo}`;
    }

    // Sólo si la tarea ES su "Grabar X": colgada de otra cosa, no se reabre nada ajeno.
    if (!t.hecho || norm(String(t.titulo)) !== buscado) return null;
    await sb.from("proyecto_tareas").update({ hecho: false, completado_at: null }).eq("id", t.id);
    return t.titulo as string;
  } catch (e) {
    console.error("reabrir-tarea-musico:", e);
    return null;
  }
}

export type ResultadoRetiro =
  | { ok: true; modo: "borrado" | "retiro"; nombre: string; asignacionId: string; reabierta: string | null }
  | { ok: false; error: string; status: number };

/**
 * Quita un archivo de músico.
 *
 * `puedeImportado`: sólo el estudio puede quitar una pista que ya entró al .rpp.
 * Un previo que ya se compartió con el cliente no se quita por aquí: el cliente
 * ya lo tiene en su panel y desaparecerlo sin avisar es peor.
 */
export async function retirarArchivo(
  sb: SB,
  archivoId: string,
  { actor, puedeImportado }: { actor: string; puedeImportado: boolean },
): Promise<ResultadoRetiro> {
  const leer = (cols: string) => sb.from("musico_archivos").select(cols).eq("id", archivoId).maybeSingle();
  const BASE = "id, asignacion_id, clase, nombre, drive_id, aprobado_at, bajado_at, importado_at";
  let r = await leer(`${BASE}, retirar_at`);
  const sinColumna = Boolean(r.error);
  if (sinColumna) r = await leer(BASE);
  const a = r.data as {
    id: string; asignacion_id: string; clase: string; nombre: string; drive_id: string | null;
    aprobado_at: string | null; bajado_at: string | null; importado_at: string | null; retirar_at?: string | null;
  } | null;
  if (!a) return { ok: false, error: "Ese archivo ya no existe.", status: 404 };

  const listo = (modo: "borrado" | "retiro", reabierta: string | null) =>
    ({ ok: true as const, modo, nombre: a.nombre, asignacionId: a.asignacion_id, reabierta });

  if (a.retirar_at) return listo("retiro", null);
  if (a.clase === "previo" && a.aprobado_at) {
    return { ok: false, error: "Ese previo ya se compartió con el cliente: ya no se puede quitar desde aquí.", status: 409 };
  }
  if (a.importado_at && !puedeImportado) {
    return { ok: false, error: "Tu pista ya entró al proyecto del estudio. Pídeles que la quiten si hace falta.", status: 409 };
  }
  const vaAlaPc = a.clase === "stem" && Boolean(a.bajado_at);
  if (vaAlaPc && sinColumna) {
    return { ok: false, error: "Falta correr supabase-temas-ep.sql para poder quitar una pista que ya bajó a la PC.", status: 503 };
  }

  // Papelera y no borrado: si alguien se equivocó al quitarla, sigue en Drive 30 días.
  if (a.drive_id) await papeleraCarpeta(a.drive_id).catch(() => false);

  if (vaAlaPc) {
    const { error } = await sb.from("musico_archivos")
      // `error: null`: la de Jorge traía "no hay ningún .rpp" y reaper-sync salta
      // las filas con error — sin limpiarlo nunca se habría retirado.
      .update({ retirar_at: new Date().toISOString(), retirado_por: actor, error: null }).eq("id", a.id);
    if (error) return { ok: false, error: error.message, status: 500 };
  } else {
    const { error } = await sb.from("musico_archivos").delete().eq("id", a.id);
    if (error) return { ok: false, error: error.message, status: 500 };
  }

  const reabierta = a.clase === "stem" ? await reabrirTareaDelMusico(sb, a.asignacion_id) : null;
  return listo(vaAlaPc ? "retiro" : "borrado", reabierta);
}
