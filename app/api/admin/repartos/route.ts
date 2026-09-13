import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/** "2026-T3" → primer y último día del trimestre. */
function rangoDe(periodo: string): { inicio: string; fin: string } | null {
  const m = /^(\d{4})-T([1-4])$/.exec(periodo);
  if (!m) return null;
  const y = Number(m[1]), t = Number(m[2]);
  const mesIni = (t - 1) * 3 + 1;
  const ultimo = new Date(Date.UTC(y, mesIni + 2, 0)).getUTCDate();
  const mm = (n: number) => String(n).padStart(2, "0");
  return { inicio: `${y}-${mm(mesIni)}-01`, fin: `${y}-${mm(mesIni + 2)}-${mm(ultimo)}` };
}

// Cierra (y registra como pagado) el reparto de un trimestre: lo que falta por
// repartir según las bolsas, mitad y mitad o según la participación de cada socio.
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const periodo = String(b.periodo || "");
  const rango = rangoDe(periodo);
  if (!rango) return NextResponse.json({ error: "Periodo inválido (ej. 2026-T3)." }, { status: 400 });

  const socios = (Array.isArray(b.socios) ? b.socios : [])
    .map((s: { socio_id?: unknown; participacion_pct?: unknown; monto?: unknown }) => ({
      socio_id: String(s?.socio_id ?? ""),
      participacion_pct: Number(s?.participacion_pct) || 0,
      monto: Math.round((Number(s?.monto) || 0) * 100) / 100,
    }))
    .filter((s: { socio_id: string; monto: number }) => s.socio_id && s.monto > 0);
  if (!socios.length) return NextResponse.json({ error: "No hay nada que repartir." }, { status: 400 });

  const total = socios.reduce((a: number, s: { monto: number }) => a + s.monto, 0);
  const fechaPago = /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha_pago || "")) ? String(b.fecha_pago) : new Date().toISOString().slice(0, 10);
  const n = (k: string) => Number(b[k]) || 0;

  const sb = supabaseAdmin();
  const { data: rep, error } = await sb.from("repartos").insert({
    periodo,
    fecha_inicio: rango.inicio,
    fecha_fin: rango.fin,
    ingresos: n("ingresos"),
    costos_directos: n("costos_directos"),
    gastos_operativos: n("gastos_operativos"),
    nomina: n("nomina"),
    reserva_pct: n("reserva_pct"),
    reserva_monto: n("reserva_monto"),
    utilidad_repartible: total,
    estado: "pagado",
    notas: String(b.notas || "Cierre del trimestre con las bolsas."),
  }).select("id").single();
  if (error || !rep) return NextResponse.json({ error: error?.message || "No se pudo guardar el reparto." }, { status: 500 });

  const { error: e2 } = await sb.from("reparto_socio").insert(
    socios.map((s: { socio_id: string; participacion_pct: number; monto: number }) => ({ ...s, reparto_id: rep.id, estado: "pagado", fecha_pago: fechaPago })),
  );
  if (e2) {
    await sb.from("repartos").delete().eq("id", rep.id);
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "reparto_cerrado",
      titulo: `${quien} cerró el reparto de ${periodo.replace("-", " ")} · ${peso(total)}`,
      actor, entidad: "reparto", entidad_id: rep.id as string, entidad_nombre: periodo,
      meta: { total, socios },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, id: rep.id, total });
}

// Borra un reparto registrado por error (sus renglones por socio se van en cascada).
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: rep } = await sb.from("repartos").select("periodo, utilidad_repartible").eq("id", id).single();
  const { error } = await sb.from("repartos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "reparto_eliminado",
      titulo: `${quien} borró un reparto de ${String(rep?.periodo ?? "").replace("-", " ")}${rep?.utilidad_repartible ? ` · ${peso(Number(rep.utilidad_repartible))}` : ""}`,
      actor, entidad: "reparto", entidad_id: id, entidad_nombre: (rep?.periodo as string) ?? null,
    });
  } catch { /* bitácora best-effort */ }
  return NextResponse.json({ ok: true });
}
