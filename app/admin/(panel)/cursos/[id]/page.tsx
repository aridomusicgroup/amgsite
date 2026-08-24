import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/supabase/auth-server";
import { getCursoDetalle } from "@/lib/cursos-admin";
import { cuentaServicioEmail } from "@/lib/drive-api";
import { CursoEditor } from "@/components/admin/CursoEditor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CursoAdminDetallePage({ params }: Props) {
  await requireModule("/admin/cursos");
  const { id } = await params;
  const curso = await getCursoDetalle(id);
  if (!curso) notFound();

  return (
    <div>
      <Link href="/admin/cursos" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4 transition-colors w-fit">
        <ArrowLeft size={15} /> Cursos
      </Link>
      <CursoEditor curso={curso} servicioEmail={cuentaServicioEmail()} />
    </div>
  );
}
