import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { archivosDeCarpeta } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Conteos en vivo para el diálogo de borrado en cascada — SOLO admin total,
// mismo gate que el DELETE que este diálogo dispara después.
export async function GET(_req: NextRequest, { params }: Props) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const sb = supabaseAdmin();
  const { data: p } = await sb.from("proyectos").select("venta_id, drive_folder_id").eq("id", id).single();
  if (!p) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const ventaId = (p.venta_id as string | null) ?? null;
  const driveCarpetaId = (p.drive_folder_id as string | null) ?? null;

  const [tareasRes, contratosRes, ventaRes, pagosRes, pagosMusicoRes, archivos] = await Promise.all([
    sb.from("proyecto_tareas").select("id").eq("proyecto_id", id),
    sb.from("contratos").select("estado").eq("proyecto_id", id),
    ventaId ? sb.from("ventas").select("total_mxn").eq("id", ventaId).single() : Promise.resolve({ data: null as { total_mxn: number } | null }),
    ventaId ? sb.from("pagos").select("id", { count: "exact", head: true }).eq("venta_id", ventaId) : Promise.resolve({ count: 0 }),
    // pagos_musico SÍ tiene ON DELETE CASCADE sobre venta_id — borrar la venta se
    // lleva también el costo de músicos, no solo el anticipo/saldo del cliente.
    // Hay que mostrarlo aparte para que el admin sepa que también se va.
    ventaId ? sb.from("pagos_musico").select("id, monto", { count: "exact" }).eq("venta_id", ventaId) : Promise.resolve({ count: 0, data: [] as { monto: number }[] }),
    // Este es el único round-trip potencialmente lento (llamada real a la API de Drive) — el resto son conteos baratos.
    driveCarpetaId ? archivosDeCarpeta(driveCarpetaId).catch(() => []) : Promise.resolve([]),
  ]);

  const tareaIds = (tareasRes.data ?? []).map((t) => t.id as string);
  const [subtareasRes, recordatoriosRes, renderJobsRes, renderInvRes] = await Promise.all([
    tareaIds.length ? sb.from("proyecto_subtareas").select("id", { count: "exact", head: true }).in("tarea_id", tareaIds) : Promise.resolve({ count: 0 }),
    tareaIds.length ? sb.from("tarea_recordatorios").select("id", { count: "exact", head: true }).in("tarea_id", tareaIds) : Promise.resolve({ count: 0 }),
    sb.from("render_jobs").select("id", { count: "exact", head: true }).eq("proyecto_id", id),
    sb.from("render_inventario").select("id", { count: "exact", head: true }).eq("proyecto_id", id),
  ]);

  const contratos = contratosRes.data ?? [];

  return NextResponse.json({
    tareas: tareaIds.length,
    subtareas: subtareasRes.count ?? 0,
    recordatorios: recordatoriosRes.count ?? 0,
    renderJobs: renderJobsRes.count ?? 0,
    renderInventario: renderInvRes.count ?? 0,
    ventas: ventaId ? 1 : 0,
    pagos: typeof pagosRes.count === "number" ? pagosRes.count : 0,
    montoTotalMxn: ventaRes.data ? Number(ventaRes.data.total_mxn) || 0 : 0,
    pagosMusico: typeof pagosMusicoRes.count === "number" ? pagosMusicoRes.count : 0,
    montoPagosMusicoMxn: (pagosMusicoRes.data ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0),
    contratos: contratos.length,
    contratosFirmados: contratos.filter((c) => c.estado === "firmado").length,
    driveArchivos: driveCarpetaId ? archivos.length : null,
    driveCarpetaId,
  });
}
