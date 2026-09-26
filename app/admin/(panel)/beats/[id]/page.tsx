import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/supabase/auth-server";
import { getBeatAdmin } from "@/lib/beat-admin";
import { BeatDetalle } from "@/components/admin/BeatDetalle";

export const metadata: Metadata = { title: "Beat — Admin ARIDO", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function BeatAdminPage({ params }: Props) {
  const session = await requireModule("/admin/beats");
  const { id } = await params;
  const beatId = decodeURIComponent(id);
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(beatId)) notFound();
  // Las ventas son dinero: sólo las ve el admin.
  const detalle = await getBeatAdmin(beatId, { verVentas: session.role === "admin" });
  if (!detalle) notFound();

  return (
    <div>
      <Link href="/admin/beats" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4 transition-colors w-fit">
        <ArrowLeft size={15} /> Beats
      </Link>
      <BeatDetalle d={detalle} />
    </div>
  );
}
