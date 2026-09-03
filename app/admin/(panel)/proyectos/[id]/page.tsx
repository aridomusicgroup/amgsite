import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/supabase/auth-server";
import { getProyectoDetalle, getEquipoActivo, getVentas } from "@/lib/erp-data";
import { ProyectoDetalle } from "@/components/admin/ProyectoDetalle";

export const dynamic = "force-dynamic";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

type Props = { params: Promise<{ id: string }> };

export default async function ProyectoDetallePage({ params }: Props) {
  // Mismo acceso que el tablero de Producción del que sale (admin, crm/Tozi, producción).
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { id } = await params;
  const [proyecto, equipo, ventas] = await Promise.all([
    getProyectoDetalle(id), getEquipoActivo(), getVentas(),
  ]);
  if (!proyecto) notFound();

  const ventasLite = session.role === "admin"
    ? ventas.map((v) => ({
        id: v.id,
        label: `${v.beat_nombre || v.tipo || "Venta"}${v.cliente ? " · " + v.cliente : ""} · ${peso(v.total_mxn)}`,
      }))
    : [];

  return (
    <div>
      <Link href="/admin/produccion" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4 transition-colors w-fit">
        <ArrowLeft size={15} /> Producción
      </Link>
      <ProyectoDetalle proyecto={proyecto} equipo={equipo} ventas={ventasLite} isAdmin={session.role === "admin"} />
    </div>
  );
}
