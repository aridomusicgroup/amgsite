import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/supabase/auth-server";
import { musicosParaPrevio } from "@/lib/render-jobs";
import { fichaReaper } from "@/lib/reaper-ficha";
import { getEquipoActivo } from "@/lib/erp-data";
import { ReaperFicha } from "@/components/admin/reaper/ReaperFicha";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ key: string }> };

/**
 * Un proyecto de REAPER visto de punta a punta: qué se renderizó, a qué músico
 * le llegó su previo, qué previos vio el cliente, si ya tiene stems y cómo va
 * el envío a edición. Es la vista de 360° sin salirse de la sección de REAPER.
 */
export default async function ReaperFichaPage({ params }: Props) {
  // Mismo candado que la lista de la que sale.
  const session = await requireModule("/admin/dev-logs");
  const { key } = await params;

  const [ficha, musicos, equipo] = await Promise.all([
    fichaReaper(key),
    musicosParaPrevio().catch(() => []),
    getEquipoActivo().catch(() => []),
  ]);
  if (!ficha) notFound();

  const miId = equipo.find((e) => e.email && e.email.toLowerCase() === session.email.toLowerCase())?.id ?? null;

  return (
    <div>
      <Link href="/admin/dev-logs" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4 transition-colors w-fit">
        <ArrowLeft size={15} /> REAPER
      </Link>
      <ReaperFicha ficha={ficha} musicos={musicos} miId={miId} />
    </div>
  );
}
