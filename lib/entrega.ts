import "server-only";
import { Resend } from "resend";
import { adminEmails, crmEmails, moduloPermitido } from "@/lib/supabase/auth-server";
import { pushAEmails, destinoProyecto } from "@/lib/push";
import { registrarActividad } from "@/lib/actividad";
import { esProyectoDeCliente } from "@/lib/pedido-sync";
import { saldoDeVenta, type SaldoVenta } from "@/lib/cobranza";
import { entregaListaEmail, entregaRetenidaEmail } from "@/lib/emails";
import { tokenDePago } from "@/lib/pago-token";
import { pasoDe, type PasoEntrega } from "@/lib/pasos-entrega";
import { moverAEntregado } from "@/lib/proyecto-estado";

/**
 * La entrega de una producción, de "Aprobada" a "ya lo tiene el cliente".
 *
 *   1. Se palomea la aprobación y queda abierta sólo "Subir a Drive"
 *      → `entregaTrasPalomear` avisa, y el panel abre el cuadro de entrega.
 *   2. En el cuadro se eligen Entregables y Stems → se encolan como UN lote
 *      (`opciones.entrega.lote`).
 *   3. El script del estudio renderiza y sube; al terminar cada uno llama a
 *      `/api/reaper/aviso` → `cerrarEntrega`. Cuando el lote completo está en
 *      Drive: se palomea "Subir a Drive", nos avisa a nosotros, y
 *        · si el cliente ya liquidó → se le comparte y le llega un correo;
 *        · si debe → queda retenido y (si se eligió) le llega el correo de
 *          "ya está listo, se desbloquea al liquidar".
 *   4. Cuando paga, por el camino que sea → `liberarEntregas`.
 *   5. Si ya no queda nada abierto → el proyecto pasa a Entregado solo.
 *
 * EP y álbum van TEMA por tema: la unidad es la canción y sus pasos.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;

const SITE = "https://aridomusicgroup.com";
const FROM = "Latino Gang Beats <acceso@aridomusicgroup.com>";
const ACTIVOS = ["cola", "produccion", "revision"];
const EN_VUELO = ["pendiente", "renderizando", "subiendo"];
const TIPOS_ALBUM = ["ep", "album"];
const ACTOR = "entrega automática";
const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

export interface MarcaEntrega {
  lote: string;
  /** Mandarle correo al cliente (al subir y, si debía, al liberarse). */
  avisar: boolean;
  /** Si el correo de "se desbloquea al liquidar" lleva botón de pago. */
  conPago: boolean;
  /** Cuándo se cerró el lote. Sello de idempotencia: cerrar dos veces no hace nada. */
  cerrado?: string;
}

export interface EntregaLista {
  proyectoId: string;
  tareaId: string | null;
  titulo: string;
}

export function marcaDe(j: { opciones?: unknown } | null | undefined): MarcaEntrega | null {
  const m = (j?.opciones as { entrega?: MarcaEntrega } | null | undefined)?.entrega;
  return m && typeof m.lote === "string" ? m : null;
}

/** `paso` es columna nueva: sin la migración, pedirla tumba la consulta entera. */
async function conRespaldo(
  a: () => PromiseLike<{ data: unknown; error: unknown }>,
  b: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Fila[]> {
  const r = await a();
  if (!r.error) return (r.data as Fila[] | null) ?? [];
  return ((await b()).data as Fila[] | null) ?? [];
}

interface Item { id: string; titulo: string; hecho: boolean; paso: PasoEntrega | null }

/** Lo que forma la unidad: los pasos de un tema, o las tareas del proyecto. */
async function itemsDeUnidad(sb: SB, proyectoId: string, tareaId: string | null): Promise<Item[]> {
  const filas = tareaId
    ? await conRespaldo(
        () => sb.from("proyecto_subtareas").select("id, titulo, hecho, paso").eq("tarea_id", tareaId),
        () => sb.from("proyecto_subtareas").select("id, titulo, hecho").eq("tarea_id", tareaId),
      )
    : await conRespaldo(
        () => sb.from("proyecto_tareas").select("id, titulo, hecho, paso, es_cancion").eq("proyecto_id", proyectoId),
        () => sb.from("proyecto_tareas").select("id, titulo, hecho, es_cancion").eq("proyecto_id", proyectoId),
      );
  return filas
    .filter((f) => !f.es_cancion)
    .map((f) => ({ id: f.id as string, titulo: String(f.titulo ?? ""), hecho: Boolean(f.hecho), paso: pasoDe(f) }));
}

/** Los renders de entrega de esa unidad, del más nuevo al más viejo. */
async function jobsDeUnidad(sb: SB, proyectoId: string, tareaId: string | null): Promise<Fila[]> {
  let q = sb
    .from("render_jobs")
    .select("id, proyecto_id, tarea_id, tipo, estado, compartir, drive_urls, opciones, created_at")
    .eq("proyecto_id", proyectoId)
    .in("tipo", ["entregables", "stems"]);
  q = tareaId ? q.eq("tarea_id", tareaId) : q.is("tarea_id", null);
  const { data } = await q.order("created_at", { ascending: false });
  return ((data ?? []) as Fila[]).filter((j) => marcaDe(j));
}

async function proyectoDe(sb: SB, id: string): Promise<Fila | null> {
  const { data } = await sb
    .from("proyectos")
    .select("id, folio, titulo, tipo, clase, estado, venta_id, order_id, contactos(nombre, email)")
    .eq("id", id)
    .maybeSingle();
  return (data as Fila | null) ?? null;
}

/** En un EP, el título del TEMA: es lo que el cliente reconoce en el correo. */
async function tituloDe(sb: SB, p: Fila, tareaId: string | null): Promise<string> {
  if (tareaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo").eq("id", tareaId).maybeSingle();
    const titulo = String(t?.titulo || "").trim();
    if (titulo) return titulo;
  }
  return String(p.titulo || "").trim() || "tu producción";
}

export async function saldoDelProyecto(sb: SB, p: { venta_id?: string | null }): Promise<SaldoVenta | null> {
  return p.venta_id ? saldoDeVenta(sb, p.venta_id) : null;
}

/** Sin venta no hay nada que cobrar; sin pagos la venta cuenta como cobrada. */
const liquidado = (s: SaldoVenta | null) => !s || s.saldo <= 0.5;

/** ¿El cliente ya puede ver sus archivos finales? */
export async function finiquitadoProyecto(sb: SB, proyectoId: string): Promise<boolean> {
  const { data: p } = await sb.from("proyectos").select("venta_id").eq("id", proyectoId).maybeSingle();
  return liquidado(await saldoDelProyecto(sb, p ?? {}));
}

// ── 1. ¿Ya sólo falta subir? ────────────────────────────────────────────────

/**
 * La unidad está lista para entregar cuando: es de un cliente, la aprobación
 * está hecha, "Subir a Drive" sigue abierta, TODO lo demás ya está hecho y no
 * hay otra entrega corriendo. Faltar cualquiera de los dos pasos también dice
 * que no: sin "Aprobada" no hay quien haya dicho que ya quedó.
 */
export async function unidadLista(sb: SB, proyectoId: string, tareaId: string | null): Promise<EntregaLista | null> {
  const p = await proyectoDe(sb, proyectoId);
  if (!p || !esProyectoDeCliente(p) || !ACTIVOS.includes(p.estado) || !p.venta_id) return null;
  // Un EP no se entrega entero: se entrega tema por tema.
  if (!tareaId && TIPOS_ALBUM.includes(String(p.tipo ?? ""))) return null;

  const items = await itemsDeUnidad(sb, proyectoId, tareaId);
  const aprobacion = items.find((i) => i.paso === "aprobacion");
  const entrega = items.find((i) => i.paso === "entrega");
  if (!aprobacion?.hecho || !entrega || entrega.hecho) return null;
  if (items.some((i) => i.id !== entrega.id && !i.hecho)) return null;

  const jobs = await jobsDeUnidad(sb, proyectoId, tareaId);
  if (jobs.some((j) => EN_VUELO.includes(j.estado))) return null;

  return { proyectoId, tareaId, titulo: await tituloDe(sb, p, tareaId) };
}

/**
 * Se llama al palomear. Una tarea normal revisa su proyecto; una subtarea
 * revisa su tema, si es de un EP. Palomear el TEMA completo no dispara nada:
 * eso palomea de golpe todos sus pasos, "Subir a Drive" incluido.
 */
export async function entregaTrasPalomear(
  sb: SB, d: { tareaId?: string; subtareaId?: string },
): Promise<EntregaLista | null> {
  try {
    if (d.subtareaId) {
      const { data: s } = await sb.from("proyecto_subtareas").select("tarea_id").eq("id", d.subtareaId).maybeSingle();
      if (!s?.tarea_id) return null;
      const { data: t } = await sb.from("proyecto_tareas").select("id, proyecto_id, es_cancion").eq("id", s.tarea_id).maybeSingle();
      if (!t?.es_cancion) return null;
      return await unidadLista(sb, t.proyecto_id as string, t.id as string);
    }
    if (d.tareaId) {
      const { data: t } = await sb.from("proyecto_tareas").select("proyecto_id, es_cancion").eq("id", d.tareaId).maybeSingle();
      if (!t || t.es_cancion) return null;
      return await unidadLista(sb, t.proyecto_id as string, null);
    }
  } catch { /* nunca estorba al palomeo */ }
  return null;
}

/**
 * Decide qué pasa con la entrega lista según quién palomeó.
 *
 * El cuadro sólo lo puede abrir quien puede lanzar renders (encender REAPER en
 * la máquina del estudio). Si palomeó alguien más, a esa persona no se le abre
 * nada y a los admins les llega un push que abre el cuadro directo.
 */
export async function entregaParaQuienPalomeo(sb: SB, e: EntregaLista | null): Promise<EntregaLista | null> {
  if (!e) return null;
  if (await moduloPermitido("/admin/dev-logs")) return e;
  await pushAEmails(sb, adminEmails(), {
    titulo: "🎚️ Lista para entregar",
    cuerpo: `${e.titulo} — ya sólo falta subirla. Toca para preparar entregables y stems.`,
    url: `${SITE}/admin/produccion?entregar=${e.proyectoId}${e.tareaId ? `:${e.tareaId}` : ""}`,
  });
  return null;
}

// ── 3. Terminó la subida ─────────────────────────────────────────────────────

/** Palomea "Subir a Drive"; en un EP, también el tema si ya no le queda nada. */
async function palomearPaso(sb: SB, proyectoId: string, tareaId: string | null): Promise<void> {
  const items = await itemsDeUnidad(sb, proyectoId, tareaId);
  const entrega = items.find((i) => i.paso === "entrega");
  const ahora = new Date().toISOString();
  if (entrega && !entrega.hecho) {
    if (tareaId) await sb.from("proyecto_subtareas").update({ hecho: true }).eq("id", entrega.id);
    else await sb.from("proyecto_tareas").update({ hecho: true, completado_at: ahora }).eq("id", entrega.id);
  }
  if (tareaId) {
    const quedan = items.filter((i) => i.id !== entrega?.id && !i.hecho).length;
    if (!quedan) await sb.from("proyecto_tareas").update({ hecho: true, completado_at: ahora }).eq("id", tareaId).eq("hecho", false);
  }
}

async function mandar(correo: string | null, mail: { subject: string; html: string }): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !correo) return null;
  try {
    await new Resend(key).emails.send({ from: FROM, to: correo, subject: mail.subject, html: mail.html });
    return correo;
  } catch {
    // El archivo YA está en su cuenta; sólo no le llegó el correo.
    return null;
  }
}

function cliente(p: Fila): { nombre: string | null; correo: string | null; panel: string | null } {
  const ct = p.contactos ?? null;
  const correo = String(ct?.email || "").trim().toLowerCase() || null;
  return {
    nombre: (ct?.nombre as string | null)?.split(" ")[0] ?? null,
    // Sin pedido ligado no hay dónde descargar: no tiene caso escribirle.
    correo: p.order_id ? correo : null,
    panel: p.order_id ? `${SITE}/cuenta/pedido/${p.order_id}` : null,
  };
}

/** El enlace de pago que nunca caduca (ver lib/pago-token.ts). */
export function urlDePago(ventaId: string | null | undefined): string | null {
  const t = ventaId ? tokenDePago(ventaId) : null;
  return t ? `${SITE}/api/pagar-saldo/${t}` : null;
}

async function compartirLote(sb: SB, lote: Fila[]): Promise<void> {
  const ahora = new Date().toISOString();
  // `avisado_en` también: el correo de la entrega es UNO por lote, y así el
  // aviso suelto de cada render (`avisarClienteDeRender`) no manda otros dos.
  await sb.from("render_jobs").update({ compartir: true, avisado_en: ahora }).in("id", lote.map((j) => j.id));
}

/**
 * Llamado por `/api/reaper/aviso` cada vez que un render de entrega termina de
 * subir. No hace nada hasta que el lote COMPLETO está en Drive.
 */
export async function cerrarEntrega(sb: SB, jobId: string): Promise<{ ok: true; entrega?: string; omitido?: string; avisado?: string | null }> {
  const { data: job } = await sb.from("render_jobs").select("id, proyecto_id, tarea_id, opciones").eq("id", jobId).maybeSingle();
  const marca = marcaDe(job);
  if (!job || !marca) return { ok: true, omitido: "no es parte de una entrega" };

  const lote = (await jobsDeUnidad(sb, job.proyecto_id, job.tarea_id ?? null))
    .filter((j) => marcaDe(j)?.lote === marca.lote);
  if (lote.some((j) => j.estado !== "listo" || !((j.drive_urls as unknown[] | null) ?? []).length)) {
    return { ok: true, omitido: "todavía falta otra parte de la entrega" };
  }
  if (lote.some((j) => marcaDe(j)?.cerrado)) return { ok: true, omitido: "esa entrega ya se cerró" };

  // Se sella ANTES de avisar, igual que `avisado_en`: si esto corriera dos
  // veces, vale más que falte un correo a que lleguen dos iguales.
  const ahora = new Date().toISOString();
  for (const j of lote) {
    await sb.from("render_jobs")
      .update({ opciones: { ...(j.opciones ?? {}), entrega: { ...marcaDe(j), cerrado: ahora } } })
      .eq("id", j.id);
  }

  await palomearPaso(sb, job.proyecto_id, job.tarea_id ?? null);

  const p = await proyectoDe(sb, job.proyecto_id);
  if (!p) return { ok: true, omitido: "el proyecto ya no existe" };
  const tema = await tituloDe(sb, p, job.tarea_id ?? null);
  const conStems = lote.some((j) => j.tipo === "stems");
  const s = await saldoDelProyecto(sb, p);
  const pagado = liquidado(s);
  const c = cliente(p);

  let avisado: string | null = null;
  if (pagado) {
    await compartirLote(sb, lote);
    if (marca.avisar && c.panel) {
      avisado = await mandar(c.correo, entregaListaEmail({ customerName: c.nombre, concepto: tema, conStems, url: c.panel }));
    }
  } else if (marca.avisar && s) {
    avisado = await mandar(c.correo, entregaRetenidaEmail({
      nombre: c.nombre, concepto: tema, folio: s.folio,
      total: s.total, cobrado: s.cobrado, saldo: s.saldo,
      urlPago: marca.conPago ? urlDePago(p.venta_id) : null,
      urlPanel: c.panel, conStems,
    }));
  }

  const estadoTxt = pagado ? "✓ ya se le mostró al cliente" : `🔒 retenido hasta que liquide ${peso(s?.saldo ?? 0)}`;
  await registrarActividad(sb, {
    tipo: "entrega_subida",
    titulo: `☁️ ${tema} ya está en Drive — ${estadoTxt}${avisado ? " · se le avisó por correo" : ""}`,
    actor: ACTOR, proyecto_id: p.id, tarea_id: job.tarea_id ?? null,
    meta: { lote: marca.lote, pagado, saldo: s?.saldo ?? 0, avisado, conStems },
  });
  await pushAEmails(sb, [...new Set([...adminEmails(), ...crmEmails()])], {
    titulo: "☁️ Ya está en Drive",
    cuerpo: `${p.folio ?? ""} ${tema} — ${pagado ? "✓ se le mostró al cliente" : `🔒 debe ${peso(s?.saldo ?? 0)}`}`.trim(),
    url: destinoProyecto(p.id),
  });

  if (pagado) await quizaEntregado(sb, p.id);
  return { ok: true, entrega: pagado ? "compartida" : "retenida", avisado };
}

// ── 4. Pagó ──────────────────────────────────────────────────────────────────

/**
 * Libera lo retenido de una venta que ya quedó liquidada. Idempotente: se
 * puede llamar de más sin mandar dos correos, porque sólo toca lo que sigue
 * sin compartir.
 *
 * Se llama desde los pagos del panel, desde el webhook de Stripe, y al abrir
 * el cliente su pedido — así da igual por dónde haya entrado el dinero.
 */
export async function liberarEntregas(sb: SB, ventaId: string): Promise<number> {
  const s = await saldoDeVenta(sb, ventaId);
  if (!liquidado(s)) return 0;

  const { data: proys } = await sb.from("proyectos").select("id").eq("venta_id", ventaId);
  const ids = ((proys ?? []) as Fila[]).map((x) => x.id as string);
  if (!ids.length) return 0;

  const { data: jobs } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tarea_id, tipo, estado, compartir, opciones")
    .in("proyecto_id", ids)
    .in("tipo", ["entregables", "stems"])
    .eq("estado", "listo")
    .eq("compartir", false);
  const retenidos = ((jobs ?? []) as Fila[]).filter((j) => marcaDe(j)?.cerrado);
  if (!retenidos.length) return 0;

  const lotes = new Map<string, Fila[]>();
  for (const j of retenidos) {
    const k = marcaDe(j)!.lote;
    lotes.set(k, [...(lotes.get(k) ?? []), j]);
  }

  for (const lote of lotes.values()) {
    await compartirLote(sb, lote);
    const primero = lote[0];
    const p = await proyectoDe(sb, primero.proyecto_id);
    if (!p) continue;
    const tema = await tituloDe(sb, p, primero.tarea_id ?? null);
    const c = cliente(p);
    const avisado = marcaDe(primero)?.avisar && c.panel
      ? await mandar(c.correo, entregaListaEmail({
          customerName: c.nombre, concepto: tema, conStems: lote.some((j) => j.tipo === "stems"), url: c.panel,
        }))
      : null;
    await registrarActividad(sb, {
      tipo: "entrega_liberada",
      titulo: `🔓 Se liquidó y ya se le mostró ${tema} al cliente${avisado ? " · se le avisó por correo" : ""}`,
      actor: ACTOR, proyecto_id: p.id, tarea_id: primero.tarea_id ?? null,
      meta: { lote: marcaDe(primero)?.lote, avisado },
    });
  }

  for (const id of ids) await quizaEntregado(sb, id);
  return lotes.size;
}

// ── 5. ¿Ya se entregó todo? ──────────────────────────────────────────────────

/**
 * Pasa el proyecto a Entregado cuando ya no queda nada abierto, el cliente
 * liquidó y al menos una entrega salió por aquí. Lo último importa: un
 * proyecto que alguien palomeó entero a mano no es asunto de este motor.
 */
export async function quizaEntregado(sb: SB, proyectoId: string): Promise<boolean> {
  try {
    const p = await proyectoDe(sb, proyectoId);
    if (!p || !esProyectoDeCliente(p) || !ACTIVOS.includes(p.estado)) return false;

    const { data: ts } = await sb.from("proyecto_tareas").select("hecho").eq("proyecto_id", proyectoId);
    if (!ts?.length || (ts as Fila[]).some((t) => !t.hecho)) return false;
    if (!liquidado(await saldoDelProyecto(sb, p))) return false;

    const { data: js } = await sb
      .from("render_jobs").select("opciones, compartir")
      .eq("proyecto_id", proyectoId).in("tipo", ["entregables", "stems"]);
    if (!((js ?? []) as Fila[]).some((j) => marcaDe(j)?.cerrado && j.compartir)) return false;

    return await moverAEntregado(sb, proyectoId, ACTOR, "todo quedó en Drive y el cliente ya liquidó");
  } catch {
    return false;
  }
}
