import type { OpcionesRender } from "@/lib/render-jobs";

/** Tope de pistas por render: más que esto es que algo va mal, no una elección. */
const MAX_PISTAS = 200;

/**
 * Valida lo que eligió el usuario en el cuadro de opciones.
 *
 * Se revisa aunque la ruta ya esté cerrada al desarrollador: estos valores
 * terminan armando una ruta de archivo y modificando un .rpp en el disco local,
 * así que no pueden pasar tal cual desde el navegador.
 *
 * Vive fuera de la ruta porque ahora la usan dos: el render suelto
 * (`/api/admin/render`) y la entrega (`/api/admin/entrega`), que encola
 * Entregables y Stems de un golpe con las mismas reglas.
 */
export function leerOpciones(raw: unknown): { ok: true; op: OpcionesRender | null } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: true, op: null };
  const b = raw as Record<string, unknown>;
  const op: OpcionesRender = {};

  if (b.rpp !== undefined && b.rpp !== null) {
    const rpp = String(b.rpp).trim();
    // Un nombre de archivo suelto, nada de rutas: el script lo va a unir con la
    // carpeta del proyecto y no debe poder salirse de ahí.
    if (!rpp || rpp.length > 260 || /[\\/]/.test(rpp) || rpp.includes("..") || !rpp.toLowerCase().endsWith(".rpp")) {
      return { ok: false, error: "El proyecto base elegido no es válido." };
    }
    op.rpp = rpp;
  }

  if (b.rango !== undefined && b.rango !== null) {
    const r = b.rango as Record<string, unknown>;
    const inicio = Number(r.inicio);
    const fin = Number(r.fin);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio < 0) {
      return { ok: false, error: "El rango de tiempo no es válido." };
    }
    if (fin - inicio < 1) return { ok: false, error: "El rango tiene que durar al menos un segundo." };
    op.rango = { inicio, fin };
  }

  if (b.avisar !== undefined) op.avisar = b.avisar === true;

  if (b.musicoId) op.musicoId = String(b.musicoId).trim();
  if (b.bpm !== undefined && b.bpm !== null && b.bpm !== "") op.bpm = Number(b.bpm);
  if (b.tonalidad) op.tonalidad = String(b.tonalidad).trim();

  // Estos dos NO son opciones del render: no cambian ni un byte del mp3. Van
  // aquí porque el cuadro los manda en el mismo cuerpo, y omitirlos de esta
  // lista blanca es exactamente lo que los tuvo muertos: la casilla salía
  // palomeada, el navegador la mandaba y el servidor la tiraba, así que
  // `asignarEnPortal()` nunca corrió y el músico recibía el correo con el
  // previo y encontraba su portal vacío.
  if (b.asignar !== undefined) op.asignar = b.asignar === true;
  if (b.instrumento !== undefined && b.instrumento !== null) {
    const inst = String(b.instrumento).trim();
    // Se guarda tal cual en la asignación y se le muestra al músico; el largo
    // es el mismo del campo del formulario.
    if (inst.length > 40) return { ok: false, error: "El instrumento es demasiado largo." };
    if (inst) op.instrumento = inst;
  }

  // "A todos los de la venta": los demás músicos a quienes se reenvía el previo.
  if (b.musicosExtra !== undefined && b.musicosExtra !== null) {
    if (!Array.isArray(b.musicosExtra) || b.musicosExtra.length > 20) {
      return { ok: false, error: "La lista de músicos no es válida." };
    }
    const extras = (b.musicosExtra as { musicoId?: unknown; instrumento?: unknown }[])
      .map((e) => ({ musicoId: String(e?.musicoId ?? "").trim(), instrumento: String(e?.instrumento ?? "").trim().slice(0, 40) }))
      .filter((e) => /^[0-9a-f-]{36}$/i.test(e.musicoId));
    if (extras.length) op.musicosExtra = extras;
  }

  if (b.pistas !== undefined && b.pistas !== null) {
    if (!Array.isArray(b.pistas)) return { ok: false, error: "La lista de pistas no es válida." };
    const pistas = b.pistas.map((p) => String(p).trim()).filter(Boolean);
    if (!pistas.length) return { ok: false, error: "Hay que elegir al menos una pista." };
    if (pistas.length > MAX_PISTAS) return { ok: false, error: "Demasiadas pistas." };
    op.pistas = pistas;
  }

  // `entrega` NUNCA se lee del navegador: la pone el servidor al armar el lote.
  // Si viniera de fuera, alguien podría inventar un lote y hacer que el panel
  // palomeara "Subir a Drive" de otro proyecto.
  return { ok: true, op: Object.keys(op).length ? op : null };
}
