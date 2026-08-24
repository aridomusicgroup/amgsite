import { resolverEquipo, crearTareasDeProyecto } from "@/lib/produccion-tareas";
import { crearPedidoDeProyecto } from "@/lib/pedido-sync";
import { crearPagosMusicoPendientes } from "@/lib/musicos-sync";
import { registrarActividad } from "@/lib/actividad";
import { seguimientoAuto } from "@/lib/seguimiento-auto";
import { inferirInstrumentos } from "@/lib/servicios";
import { nextFolio } from "@/lib/folio";
import { sincronizarFidelidadVenta } from "@/lib/fidelidad-server";

/**
 * Cuando llega CUALQUIER pago de Stripe contra una cotización (aunque sea
 * solo el anticipo), esto crea la venta (y el proyecto, si aplica) SOLA —
 * sin que el staff dé clic en "Convertir en venta". Cada tramo que llega
 * después se registra como un pago normal sobre esa misma venta (tabla
 * `pagos`), así que el saldo pendiente y la fidelidad ("pago de contado")
 * se calculan solos según lo que de verdad se ha cobrado — ver
 * `sincronizarFidelidadVenta`.
 *
 * Deliberadamente separado de `POST /api/admin/ventas` / `ConvertirVentaModal`
 * en vez de reusarlos: ese flujo existe para cuando el staff captura datos a
 * mano (tiene que adivinar/unir el contacto, etc.); aquí todo ya viene resuelto
 * en la cotización — es un caso más simple, no vale la pena arriesgar el flujo
 * manual que ya funciona con un refactor.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Pipeline de una canción individual — el mismo que un beat personalizado, como subtareas. */
function pipelineCancion(instrumentos: string[]): string[] {
  return [
    "Hacer maqueta",
    ...instrumentos.map((i) => `Grabar ${i}`),
    "Editar y cuantizar",
    "Mezclar",
    "Masterizar",
    "Subir a Drive",
  ];
}

interface MapaTipo {
  ventaTipo: string;
  tproy: string | null;
}

/** A qué tipo de venta/proyecto mapea cada tipo de cotización — sin ambigüedad real que resolver. */
const MAPA_TIPO: Record<string, MapaTipo> = {
  beat_personalizado: { ventaTipo: "Beat personalizado", tproy: "beat_personalizado" },
  exclusiva: { ventaTipo: "Exclusividad", tproy: "exclusividad" },
  servicio: { ventaTipo: "Grabación", tproy: "grabacion" },
  produccion: { ventaTipo: "Grabación", tproy: "grabacion" },
};

export interface ResultadoVentaAutomatica {
  ventaId: string;
  ventaFolio: string;
  proyectoFolio: string | null;
  proyectoCreado: boolean;
  /** true si la venta ya existía (este tramo solo se sumó como un pago más). */
  yaExistia: boolean;
}

/** Convierte un monto en la moneda nativa de la cotización a MXN, con la misma
 *  proporción total/total_mxn que ya se usó para cotizar (evita depender de un
 *  tipo de cambio fijo aparte). */
function aMxn(montoNativo: number, total: number, totalMxn: number): number {
  if (!(total > 0)) return montoNativo;
  return Math.round(montoNativo * (totalMxn / total) * 100) / 100;
}

/**
 * Registra el tramo recién pagado como un pago normal sobre la venta y
 * resincroniza la fidelidad ("pago de contado" solo aplica si con este pago
 * la venta queda cobrada al 100%, no antes).
 */
async function registrarTramoPagado(
  sb: SB,
  ventaId: string,
  montoMxn: number,
  esPrimerPago: boolean,
  comisionMxn: number | null,
): Promise<void> {
  const { data: prev } = await sb.from("pagos").select("monto_mxn").eq("venta_id", ventaId);
  const cobradoPrev = (prev ?? []).reduce((a: number, p: { monto_mxn: number }) => a + (Number(p.monto_mxn) || 0), 0);
  const { data: venta } = await sb.from("ventas").select("total_mxn").eq("id", ventaId).single();
  const saldoAntes = Math.max(0, (Number(venta?.total_mxn) || 0) - cobradoPrev);
  const esUltimo = montoMxn >= saldoAntes - 0.5;
  const tipo = esUltimo ? "finiquito" : esPrimerPago ? "anticipo" : "abono";

  const campos = {
    venta_id: ventaId,
    fecha: new Date().toISOString().slice(0, 10),
    monto_mxn: montoMxn,
    tipo,
    medio_pago: "Stripe",
    notas: "Tramo de cotización pagado por Stripe",
    comision_stripe_mxn: comisionMxn,
  };
  const { error } = await sb.from("pagos").insert(campos);
  if (error) {
    // Probablemente falta la columna (SQL de comisión Stripe sin correr) — reintenta sin ella.
    const { comision_stripe_mxn: _omit, ...sinComision } = campos;
    await sb.from("pagos").insert(sinComision);
  }

  await sincronizarFidelidadVenta(sb, ventaId);
}

/**
 * Crea la venta (y el proyecto de producción si el tipo lo permite) a partir
 * de una cotización en cuanto llega el PRIMER pago de Stripe contra ella
 * (aunque sea solo el anticipo). Idempotente: si ya existe una venta con este
 * `cotizacion_id` (el staff se pudo haber adelantado a mano, o este es un
 * tramo posterior), solo registra el tramo como un pago más sobre esa venta.
 *
 * `montoTramoNativo`: lo que se acaba de pagar de este tramo, en la moneda
 * nativa de la cotización (antes de convertir a MXN).
 */
export async function crearVentaDesdeCotizacionPagada(
  sb: SB,
  cotizacionId: string,
  montoTramoNativo: number,
  comisionTramoMxn: number | null = null,
): Promise<ResultadoVentaAutomatica | null> {
  const { data: cot } = await sb
    .from("cotizaciones")
    .select("id, folio, tipo, contacto_id, cliente_nombre, cliente_email, cliente_telefono, moneda, tipo_cambio, items, total, total_mxn, num_canciones, ep_album_formato")
    .eq("id", cotizacionId)
    .single();
  if (!cot) return null;

  const totalNativo = Number(cot.total) || 0;
  const totalMxn = Number(cot.total_mxn) || 0;
  const montoTramoMxn = aMxn(montoTramoNativo, totalNativo, totalMxn);

  const { data: existente } = await sb.from("ventas").select("id, folio").eq("cotizacion_id", cotizacionId).maybeSingle();
  if (existente) {
    const ventaId = existente.id as string;
    await registrarTramoPagado(sb, ventaId, montoTramoMxn, false, comisionTramoMxn);
    return { ventaId, ventaFolio: existente.folio as string, proyectoFolio: null, proyectoCreado: false, yaExistia: true };
  }

  const items: { label: string }[] = Array.isArray(cot.items) ? cot.items : [];
  const instrumentos = inferirInstrumentos(items.map((i) => i.label));
  const extrasStr = instrumentos.length ? instrumentos.join(", ") : null;

  // ── Resuelve tipo de venta + tipo de proyecto ──
  let ventaTipo: string;
  let tproy: string | null;
  if (cot.tipo === "ep_album") {
    const formato = cot.ep_album_formato as "ep" | "album" | null;
    const numCanciones = Number(cot.num_canciones) || 0;
    if (formato && numCanciones > 0) {
      ventaTipo = formato === "album" ? "Álbum" : "EP";
      tproy = formato;
    } else {
      // Sin formato o sin número de canciones no hay con qué armar las tareas
      // a ciegas — se crea solo la venta, el proyecto lo arma el staff a mano.
      ventaTipo = "EP / Álbum";
      tproy = null;
    }
  } else {
    const mapa = MAPA_TIPO[cot.tipo as string];
    ventaTipo = mapa?.ventaTipo ?? items[0]?.label ?? "Producción";
    tproy = mapa?.tproy ?? null;
  }

  // ── Venta ──
  const ventaFolio = await nextFolio(sb, "ventas", "I");
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: ventaRow, error: ventaErr } = await sb
    .from("ventas")
    .insert({
      folio: ventaFolio,
      fecha: hoy,
      contacto_id: cot.contacto_id,
      cotizacion_id: cotizacionId,
      tipo: ventaTipo,
      beat_nombre: items[0]?.label ?? cot.folio,
      canal: "stripe",
      moneda: cot.moneda,
      monto_cobrado: Number(cot.total) || 0,
      tipo_cambio: cot.tipo_cambio ? Number(cot.tipo_cambio) : null,
      total_mxn: Number(cot.total_mxn) || 0,
      medio_pago: "Stripe",
      quien_cerro: "Automático (Stripe)",
    })
    .select("id")
    .single();
  if (ventaErr || !ventaRow) return null;
  const ventaId = ventaRow.id as string;

  if (extrasStr) await crearPagosMusicoPendientes(sb, ventaId, extrasStr);

  try {
    await registrarActividad(sb, {
      tipo: "venta_creada",
      titulo: `Se creó sola la venta ${ventaFolio} al recibirse un pago de ${cot.folio} por Stripe`,
      entidad: "venta", entidad_id: ventaId, entidad_nombre: ventaFolio,
      meta: { total_mxn: cot.total_mxn, cotizacion_id: cotizacionId, automatico: true },
    });
  } catch { /* bitácora best-effort */ }

  await seguimientoAuto(sb, { contactoId: cot.contacto_id, accion: null, motivo: `se cerró la venta ${ventaFolio}`, actor: null });

  // Fidelidad ("de contado") solo se otorga cuando la venta queda cobrada al
  // 100% — registrarTramoPagado se encarga de checarlo cada vez.
  await registrarTramoPagado(sb, ventaId, montoTramoMxn, true, comisionTramoMxn);

  if (cot.contacto_id) {
    const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", cot.contacto_id);
    const sum = (vts ?? []).reduce((a: number, v: { total_mxn: number }) => a + (Number(v.total_mxn) || 0), 0);
    const n = (vts ?? []).length;
    await sb.from("contactos").update({ ltv: sum, etapa: n > 1 ? "recurrente" : "cliente", updated_at: new Date().toISOString() }).eq("id", cot.contacto_id);
  }

  await sb.from("cotizaciones").update({ estado: "aceptada", updated_at: new Date().toISOString() }).eq("id", cotizacionId);

  // ── Proyecto (si el tipo lo permite) ──
  let proyectoFolio: string | null = null;
  if (tproy) {
    try {
      const proyectoFolioGen = await nextFolio(sb, "proyectos", "P");
      const { data: proy } = await sb
        .from("proyectos")
        .insert({
          folio: proyectoFolioGen, clase: "produccion",
          titulo: items[0]?.label ?? cot.folio, tipo: tproy, estado: "cola", prioridad: "media",
          contacto_id: cot.contacto_id, venta_id: ventaId, cotizacion_id: cotizacionId, creado_por: "stripe",
        })
        .select("id")
        .single();

      if (proy?.id) {
        if (tproy === "ep" || tproy === "album") {
          const { data: eq } = await sb.from("equipo").select("id, nombre");
          const findId = resolverEquipo((eq ?? []) as { id: string; nombre: string }[]);
          const numCanciones = Math.max(1, Number(cot.num_canciones) || 1);
          const rows = Array.from({ length: numCanciones }, (_, i) => ({
            proyecto_id: proy.id, titulo: `Canción ${i + 1}`, responsable_id: findId("eliud"), orden: i, hecho: false,
          }));
          const { data: ins } = await sb.from("proyecto_tareas").insert(rows).select("id, orden");
          const pipeline = pipelineCancion(instrumentos);
          const subRows: { tarea_id: string; titulo: string; orden: number; hecho: boolean }[] = [];
          for (const r of ins ?? []) {
            pipeline.forEach((titulo, j) => subRows.push({ tarea_id: r.id as string, titulo, orden: j, hecho: false }));
          }
          if (subRows.length) await sb.from("proyecto_subtareas").insert(subRows);
        } else {
          await crearTareasDeProyecto(sb, proy.id, tproy, instrumentos);
        }
        try { await crearPedidoDeProyecto(sb, proy.id); } catch { /* pedido-sync best-effort */ }
        proyectoFolio = proyectoFolioGen;
      }
    } catch (e) {
      console.error("Proyecto automático desde cotización pagada falló:", e);
    }
  }

  return { ventaId, ventaFolio, proyectoFolio, proyectoCreado: !!proyectoFolio, yaExistia: false };
}
