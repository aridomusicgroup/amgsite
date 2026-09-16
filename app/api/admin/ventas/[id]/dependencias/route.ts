import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { archivosDeCarpeta } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Qué cuelga de una venta, para el diálogo de borrado en cascada. Mismo gate
 * que el DELETE que dispara después (admin total).
 *
 * Una venta arrastra más de lo que parece: su proyecto de producción (con
 * tareas y renders), el contrato, el pedido que el cliente ve en su panel y la
 * carpeta de Drive. Antes borrar la venta dejaba todo eso suelto.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const sb = supabaseAdmin();
  const { data: venta } = await sb.from("ventas").select("id, total_mxn").eq("id", id).single();
  if (!venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  const { data: proys } = await sb.from("proyectos")
    .select("id, titulo, drive_folder_id, order_id").eq("venta_id", id);
  const proyectos = proys ?? [];
  const proyIds = proyectos.map((p) => p.id as string);
  const pedidoIds = [...new Set(proyectos.map((p) => p.order_id as string | null).filter(Boolean))] as string[];

  const [tareasRes, pagosRes, pagosMusicoRes, contratosVentaRes, contratosProyRes] = await Promise.all([
    proyIds.length ? sb.from("proyecto_tareas").select("id").in("proyecto_id", proyIds) : Promise.resolve({ data: [] as { id: string }[] }),
    sb.from("pagos").select("id", { count: "exact", head: true }).eq("venta_id", id),
    // pagos_musico tiene ON DELETE CASCADE sobre venta_id: se van con la venta.
    sb.from("pagos_musico").select("id, monto", { count: "exact" }).eq("venta_id", id),
    sb.from("contratos").select("id, estado").eq("venta_id", id),
    proyIds.length ? sb.from("contratos").select("id, estado").in("proyecto_id", proyIds) : Promise.resolve({ data: [] as { id: string; estado: string }[] }),
  ]);

  const tareaIds = (tareasRes.data ?? []).map((t) => t.id as string);
  const [subtareasRes, recordatoriosRes, renderJobsRes, renderInvRes, ...archivosPorProy] = await Promise.all([
    tareaIds.length ? sb.from("proyecto_subtareas").select("id", { count: "exact", head: true }).in("tarea_id", tareaIds) : Promise.resolve({ count: 0 }),
    tareaIds.length ? sb.from("tarea_recordatorios").select("id", { count: "exact", head: true }).in("tarea_id", tareaIds) : Promise.resolve({ count: 0 }),
    proyIds.length ? sb.from("render_jobs").select("id", { count: "exact", head: true }).in("proyecto_id", proyIds) : Promise.resolve({ count: 0 }),
    proyIds.length ? sb.from("render_inventario").select("id", { count: "exact", head: true }).in("proyecto_id", proyIds) : Promise.resolve({ count: 0 }),
    // Lo único potencialmente lento: una llamada real a Drive por proyecto.
    ...proyectos.map((p) => (p.drive_folder_id
      ? archivosDeCarpeta(p.drive_folder_id as string).catch(() => [])
      : Promise.resolve([]))),
  ]);

  // Un contrato puede apuntar a la venta y al proyecto a la vez: no contarlo dos veces.
  const contratos = [...(contratosVentaRes.data ?? []), ...(contratosProyRes.data ?? [])]
    .filter((c, i, todos) => todos.findIndex((x) => x.id === c.id) === i);
  const conCarpeta = proyectos.some((p) => p.drive_folder_id);

  return NextResponse.json({
    tareas: tareaIds.length,
    subtareas: subtareasRes.count ?? 0,
    recordatorios: recordatoriosRes.count ?? 0,
    renderJobs: renderJobsRes.count ?? 0,
    renderInventario: renderInvRes.count ?? 0,
    proyectos: proyectos.length,
    proyectosTitulos: proyectos.map((p) => (p.titulo as string) || "sin título"),
    ventas: 1,
    pagos: typeof pagosRes.count === "number" ? pagosRes.count : 0,
    montoTotalMxn: Number(venta.total_mxn) || 0,
    pagosMusico: typeof pagosMusicoRes.count === "number" ? pagosMusicoRes.count : 0,
    montoPagosMusicoMxn: (pagosMusicoRes.data ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0),
    contratos: contratos.length,
    contratosFirmados: contratos.filter((c) => c.estado === "firmado").length,
    pedidos: pedidoIds.length,
    driveArchivos: conCarpeta ? (archivosPorProy as { id: string }[][]).reduce((a, l) => a + l.length, 0) : null,
    driveCarpetaId: (proyectos.find((p) => p.drive_folder_id)?.drive_folder_id as string | null) ?? null,
  });
}
