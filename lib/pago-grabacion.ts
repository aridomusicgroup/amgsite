import "server-only";
import { adminEmails } from "@/lib/supabase/auth-server";
import { pushAEmails } from "@/lib/push";
import { limpiarAbonos, totalAbonado } from "@/lib/abonos-musico";
import { instrumentoDeTarea, PARAM_PAGO_MUSICO, type PreguntaPago } from "@/lib/pago-grabacion-tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Fila = Record<string, unknown>;

const SITE = "https://admin.aridomusicgroup.com";

/**
 * "Ya grabó: ¿le pagas?" — lo que se pregunta al palomear "Grabar {instrumento}".
 *
 * El pago casi nunca hay que INVENTARLO: al crear la venta, `musicos-sync`
 * ya dejó uno pendiente por cada músico contratado ("Auto: Charchetas"). Lo que
 * faltaba es acordarse de liquidarlo cuando el trabajo ya está hecho, que es
 * justo el momento en que se palomea la tarea. Por eso aquí se BUSCA el pago
 * pendiente; sólo si no hay ninguno se ofrece registrarlo con la tarifa del
 * catálogo — y sólo si se sabe quién lo grabó (su asignación en el portal).
 *
 * Nunca lanza: la pregunta es un extra del palomeo, no debe tumbarlo.
 */

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Mismo criterio que en todo lo de músicos: igual, o uno contiene al otro. */
const mismoInstrumento = (a: unknown, b: unknown) => {
  const x = norm(a), y = norm(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
};

/** El instrumento de un pago: la columna, o la nota vieja "Auto: Charchetas". */
const instrumentoDePago = (p: Fila) =>
  (p.instrumento as string | null) || /^auto:\s*(.+)$/i.exec(String(p.nota ?? "").trim())?.[1] || null;

/** Lee los pagos de una venta tolerando columnas que aún no existan. */
async function pagosDeVenta(sb: SB, ventaId: string): Promise<Fila[]> {
  for (const cols of [
    "id, musico, musico_id, instrumento, nota, monto, pagado, abonos",
    "id, musico, musico_id, instrumento, nota, monto, pagado",
    "id, musico, nota, monto, pagado",
  ]) {
    const { data, error } = await sb.from("pagos_musico").select(cols).eq("venta_id", ventaId);
    if (!error) return (data ?? []) as Fila[];
  }
  return [];
}

/**
 * En un EP: cuántos temas de ese instrumento le quedan por grabar, CONTANDO el
 * que se acaba de palomear (ya viene marcado como hecho). Sirve para sugerir
 * la parte de este tema: un solo pago cubre todos.
 */
async function temasRestantes(sb: SB, proyectoId: string, instrumento: string): Promise<number> {
  const { data: temas } = await sb.from("proyecto_tareas")
    .select("id").eq("proyecto_id", proyectoId).eq("es_cancion", true);
  const ids = ((temas ?? []) as Fila[]).map((t) => t.id as string);
  if (!ids.length) return 1;
  const { data: subs } = await sb.from("proyecto_subtareas").select("titulo, hecho").in("tarea_id", ids);
  const faltan = ((subs ?? []) as Fila[])
    .filter((s) => !s.hecho && mismoInstrumento(instrumentoDeTarea(s.titulo as string), instrumento)).length;
  return faltan + 1;
}

/**
 * La pregunta para ese instrumento en ese proyecto/tema, o null si no hay
 * nada que preguntar: sin venta, ya pagado, o no se sabe quién lo grabó.
 */
export async function preguntaDePago(
  sb: SB,
  d: { proyectoId: string; temaId: string | null; instrumento: string },
): Promise<PreguntaPago | null> {
  try {
    const { data: proy } = await sb.from("proyectos").select("titulo, venta_id").eq("id", d.proyectoId).maybeSingle();
    const ventaId = proy?.venta_id as string | null;
    if (!ventaId) return null;

    let donde = String(proy?.titulo ?? "el proyecto");
    if (d.temaId) {
      const { data: tema } = await sb.from("proyecto_tareas").select("titulo").eq("id", d.temaId).maybeSingle();
      if (tema?.titulo) donde = `${donde} · ${tema.titulo}`;
    }

    const restantes = d.temaId ? await temasRestantes(sb, d.proyectoId, d.instrumento) : null;
    const base = { proyectoId: d.proyectoId, temaId: d.temaId, donde, instrumento: d.instrumento, ventaId, temasRestantes: restantes };
    const parte = (pendiente: number) =>
      restantes && restantes > 1 ? Math.round(pendiente / restantes) : pendiente;

    const delInstrumento = (await pagosDeVenta(sb, ventaId)).filter((p) => mismoInstrumento(instrumentoDePago(p), d.instrumento));

    if (delInstrumento.length) {
      const pendiente = delInstrumento.find((p) => !p.pagado);
      if (!pendiente) return null;   // ya se le pagó: no hay nada que preguntar
      const monto = Number(pendiente.monto) || 0;
      const abonado = totalAbonado(limpiarAbonos(pendiente.abonos));
      const falta = Math.max(0, Math.round((monto - abonado) * 100) / 100);
      if (falta <= 0) return null;
      return {
        ...base,
        musico: String(pendiente.musico || "el músico"),
        pagoId: pendiente.id as string,
        monto, abonado, pendiente: falta, sugerido: parte(falta),
      };
    }

    // Sin pago en la venta: sólo se ofrece registrarlo si se sabe quién grabó.
    let qAsig = sb.from("musico_asignaciones").select("musico_id, instrumento, tarea_id").eq("proyecto_id", d.proyectoId);
    if (d.temaId) qAsig = qAsig.eq("tarea_id", d.temaId);
    const { data: asigs } = await qAsig;
    const asig = ((asigs ?? []) as Fila[]).find((a) => mismoInstrumento(a.instrumento, d.instrumento));
    if (!asig) return null;
    const { data: m } = await sb.from("musicos").select("nombre, tarifa").eq("id", asig.musico_id).maybeSingle();
    if (!m) return null;
    const tarifa = Number(m.tarifa) || 0;
    return {
      ...base,
      musico: String(m.nombre),
      pagoId: null,
      monto: tarifa, abonado: 0, pendiente: tarifa, sugerido: parte(tarifa),
    };
  } catch {
    return null;
  }
}

/**
 * Tras palomear una tarea o subtarea: la pregunta si es una grabación con pago
 * pendiente. `temaId` es el tema de EP del que cuelga la subtarea, si aplica.
 */
export async function preguntaTrasPalomear(
  sb: SB,
  d: { proyectoId: string | null; temaId: string | null; titulo: string | null },
): Promise<PreguntaPago | null> {
  const instrumento = instrumentoDeTarea(d.titulo);
  if (!instrumento || !d.proyectoId) return null;
  return preguntaDePago(sb, { proyectoId: d.proyectoId, temaId: d.temaId, instrumento });
}

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/** El enlace que abre la pregunta desde cualquier página del panel. */
export const urlPregunta = (p: PreguntaPago) =>
  `${SITE}/admin/produccion?${PARAM_PAGO_MUSICO}=${encodeURIComponent(`${p.proyectoId}:${p.temaId ?? ""}:${p.instrumento}`)}`;

/**
 * Decide qué pasa con la pregunta según quién palomeó, igual que la entrega:
 * pagar sólo lo puede un administrador. Si fue él, se le devuelve y su
 * navegador abre la ventanita; si fue alguien más (o el portal del músico), a
 * esa persona no se le abre nada y a los admins les llega un push que la abre.
 *
 * `quien` es lo que va en el aviso: "Diego palomeó…" o "Martín subió…".
 */
export async function pagoParaQuienPalomeo(
  sb: SB,
  p: PreguntaPago | null,
  d: { esAdmin: boolean; quien: string },
): Promise<PreguntaPago | null> {
  if (!p) return null;
  if (d.esAdmin) return p;
  await pushAEmails(sb, adminEmails(), {
    titulo: `💸 ¿Le pagas a ${p.musico}?`,
    cuerpo: `${d.quien} · ${p.instrumento} de ${p.donde}. Le debes ${peso(p.pendiente)}.`,
    url: urlPregunta(p),
  });
  return null;
}
