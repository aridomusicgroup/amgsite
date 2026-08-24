import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAEmails } from "@/lib/push";
import { adminEmails } from "@/lib/supabase/auth-server";
import { registrarActividad } from "@/lib/actividad";
import { pagosMusicoPendientes, type PagoMusicoLite } from "@/lib/pagos-musico-recordatorio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://admin.aridomusicgroup.com";
const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * Aviso diario de pagos a músicos pendientes que llevan rato sin liquidarse
 * (ver `PagosMusicoResumen` en Finanzas, que muestra lo mismo pero solo si
 * alguien entra a mirar). Aviso interno al equipo — nadie externo recibe
 * nada, los músicos no se enteran de esto.
 *
 * Empuja push TODOS los días mientras siga pendiente (mismo estilo que
 * vencimientos.ts y pagos-recurrentes) — la única forma de que se calle es
 * marcarlo pagado — pero solo UNA fila en la bitácora por día, para que la
 * campanita de Finanzas no se llene del mismo aviso repetido.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const ahora = new Date().toISOString();
  const hoy = ahora.slice(0, 10);

  const { data: pagos } = await sb
    .from("pagos_musico")
    .select("id, musico, monto, created_at")
    .eq("pagado", false);

  const pendientesLite: PagoMusicoLite[] = (pagos ?? []).map((p) => ({
    id: p.id as string,
    musico: (p.musico as string | null) ?? null,
    monto: Number(p.monto) || 0,
    createdAt: (p.created_at as string) ?? ahora,
  }));
  const pendientes = pagosMusicoPendientes(pendientesLite, ahora);
  if (pendientes.length === 0) return NextResponse.json({ ok: true, pendientes: 0 });

  const totalMonto = pendientes.reduce((a, p) => a + p.monto, 0);
  const masViejo = pendientes[0];
  const correos = [...new Set(adminEmails().map((e) => e.toLowerCase()))];

  const titulo =
    pendientes.length === 1
      ? `🎸 Pago pendiente a ${masViejo.musico || "un músico"} (${peso(masViejo.monto)}, hace ${masViejo.diasPendiente} días)`
      : `🎸 ${pendientes.length} pagos a músicos pendientes — ${peso(totalMonto)}`;
  const cuerpo =
    pendientes.length === 1
      ? "Sigue sin registrarse como pagado."
      : `El más viejo: ${masViejo.musico || "sin nombre"} (${peso(masViejo.monto)}, hace ${masViejo.diasPendiente} días).`;

  // Bitácora: una sola vez por día.
  const entidadId = `pagos-musico-pendientes:${hoy}`;
  try {
    const { data: yaEsta } = await sb.from("actividad").select("id").eq("entidad", "musico").eq("entidad_id", entidadId).limit(1);
    if (!yaEsta || !yaEsta.length) {
      await registrarActividad(sb, {
        tipo: "pago_musico_pendiente",
        titulo,
        entidad: "musico",
        entidad_id: entidadId,
        meta: { total_pendiente: totalMonto, cantidad: pendientes.length, mas_viejo_dias: masViejo.diasPendiente, automatico: true },
      });
    }
  } catch { /* bitácora best-effort */ }

  await pushAEmails(sb, correos, { titulo, cuerpo, url: `${SITE}/admin/finanzas` });

  return NextResponse.json({ ok: true, pendientes: pendientes.length, totalMonto, avisados: correos.length });
}
