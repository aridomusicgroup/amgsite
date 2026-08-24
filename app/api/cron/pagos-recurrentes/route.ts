import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAEmails } from "@/lib/push";
import { adminEmails } from "@/lib/supabase/auth-server";
import { registrarActividad } from "@/lib/actividad";
import { combinarConRegistrados, pagosPendientes, cicloDe, type EgresoLite, type GastoRecurrenteRegistrado } from "@/lib/gastos-recurrentes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://admin.aridomusicgroup.com";
const DIAS_ANTES = 5;
const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * Aviso diario de gastos recurrentes por vencer (renta, suscripciones,
 * servicios…) — combina lo registrado A MANO en `gastos_recurrentes` (gana,
 * avisa desde el día uno sin necesitar historial) con lo INFERIDO del patrón
 * de `egresos` para todo lo que nadie dio de alta explícita. En ambos casos,
 * en cuanto alguien registra el egreso del mes el próximo vencimiento se
 * recalcula solo y el aviso deja de salir hasta el siguiente ciclo.
 *
 * Empuja push TODOS los días mientras siga pendiente (como vencimientos.ts) —
 * la única forma de que se calle es registrar el egreso — pero solo escribe
 * UNA fila en la bitácora por ciclo (mes) para que la campanita de Finanzas no
 * se llene de la misma renta repetida cinco veces.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const hoy = new Date().toISOString().slice(0, 10);

  const [{ data: egresos }, { data: registradosRaw }] = await Promise.all([
    sb.from("egresos").select("fecha, categoria, proveedor, descripcion, total_mxn, es_capex").order("fecha", { ascending: true }).limit(2000),
    sb.from("gastos_recurrentes").select("id, nombre, categoria, proveedor, monto_estimado, dia_mes, activo"),
  ]);
  const registrados: GastoRecurrenteRegistrado[] = (registradosRaw ?? []).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    categoria: (r.categoria as string | null) ?? null,
    proveedor: (r.proveedor as string | null) ?? null,
    montoEstimado: Number(r.monto_estimado) || 0,
    diaMes: Number(r.dia_mes) || 1,
    activo: r.activo !== false,
  }));

  const recurrentes = combinarConRegistrados(registrados, (egresos ?? []) as EgresoLite[], hoy);
  const pendientes = pagosPendientes(recurrentes, hoy, DIAS_ANTES);
  if (pendientes.length === 0) return NextResponse.json({ ok: true, pendientes: 0 });

  const correos = [...new Set(adminEmails().map((e) => e.toLowerCase()))];
  let nuevosEnBitacora = 0;

  for (const p of pendientes) {
    const ciclo = cicloDe(p.proximaFecha);
    const entidadId = `recurrente:${p.clave}:${ciclo}`;
    const vencido = p.proximaFecha < hoy;
    const cuando = new Date(`${p.proximaFecha}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

    // Bitácora/campanita: una sola vez por ciclo (busca antes de insertar —
    // best-effort, si falla la tabla no truena el resto del aviso).
    try {
      const { data: yaEsta } = await sb
        .from("actividad")
        .select("id")
        .eq("entidad", "egreso")
        .eq("entidad_id", entidadId)
        .limit(1);
      if (!yaEsta || !yaEsta.length) {
        await registrarActividad(sb, {
          tipo: "pago_recurrente_pendiente",
          titulo: vencido
            ? `⚠️ Se venció ${p.etiqueta} (${peso(p.montoEstimado)}) — no se ha registrado el pago de este mes`
            : `💸 Se acerca ${p.etiqueta} (${peso(p.montoEstimado)}) el ${cuando}`,
          entidad: "egreso",
          entidad_id: entidadId,
          entidad_nombre: p.etiqueta,
          meta: { monto_mxn: p.montoEstimado, proxima_fecha: p.proximaFecha, veces_visto: p.vecesVisto, automatico: true },
        });
        nuevosEnBitacora++;
      }
    } catch { /* bitácora best-effort */ }

    // Push: todos los días mientras siga pendiente, para que de verdad empuje.
    await pushAEmails(sb, correos, {
      titulo: vencido ? `⚠️ Ya se venció: ${p.etiqueta}` : `💸 Se acerca: ${p.etiqueta}`,
      cuerpo: vencido
        ? `${peso(p.montoEstimado)} · debió pagarse el ${cuando} y no aparece registrado todavía.`
        : `${peso(p.montoEstimado)} el ${cuando} (según lo que se ha pagado antes).`,
      url: `${SITE}/admin/finanzas`,
    });
  }

  return NextResponse.json({ ok: true, pendientes: pendientes.length, nuevosEnBitacora, avisados: correos.length });
}
