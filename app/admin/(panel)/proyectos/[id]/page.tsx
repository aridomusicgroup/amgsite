import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/supabase/auth-server";
import { misRecordatorios } from "@/lib/recordatorios-server";
import { musicosConPortal } from "@/lib/musico-data";
import { getProyectoDetalle, getEquipoActivo, getVentas } from "@/lib/erp-data";
import { ProyectoDetalle } from "@/components/admin/ProyectoDetalle";

export const dynamic = "force-dynamic";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

type Props = { params: Promise<{ id: string }> };

export default async function ProyectoDetallePage({ params }: Props) {
  // Mismo candado que el tablero del que sale. Antes bastaba con tener sesión:
  // hoy los tres roles traen /admin/produccion de base, así que no cambiaba nada
  // en la práctica, pero dejaba la puerta abierta a que un rol futuro sin ese
  // módulo entrara por la URL directa.
  const session = await requireModule("/admin/produccion");

  const { id } = await params;
  // Los recordatorios dependen de QUIÉN abre la página: cada quien ve los suyos.
  const [proyecto, equipo, ventas, recordatorios, musicos] = await Promise.all([
    getProyectoDetalle(id, session.role === "admin"), getEquipoActivo(), getVentas(), misRecordatorios(session.email), musicosConPortal(),
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
      <ProyectoDetalle
        proyecto={proyecto} equipo={equipo} ventas={ventasLite}
        isAdmin={session.role === "admin"}
        recordatorios={recordatorios}
        musicos={musicos}
        miId={equipo.find((e) => e.email && e.email.toLowerCase() === session.email.toLowerCase())?.id ?? null}
      />
    </div>
  );
}
