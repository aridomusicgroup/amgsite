import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/supabase/auth-server";
import { getCursosAdmin, getEntregasAdmin } from "@/lib/cursos-admin";
import { EntregasBandeja } from "@/components/admin/curso/EntregasBandeja";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ curso?: string; estado?: string }> };

export default async function EntregasPage({ searchParams }: Props) {
  await requireModule("/admin/cursos");
  const { curso, estado } = await searchParams;
  const filtroEstado = estado === "revisada" || estado === "enviada" ? estado : undefined;
  const [entregas, cursos] = await Promise.all([
    getEntregasAdmin({ cursoId: curso || undefined, estado: filtroEstado }),
    getCursosAdmin(),
  ]);

  return (
    <div>
      <Link href={curso ? `/admin/cursos/${curso}` : "/admin/cursos"} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-4 transition-colors w-fit">
        <ArrowLeft size={15} /> Cursos
      </Link>
      <div className="mb-5">
        <h1 className="font-coolvetica text-3xl">Entregas</h1>
        <p className="text-white/50 text-sm mt-1">Videos de evaluaciones y retos. Las pendientes van primero.</p>
      </div>
      <EntregasBandeja entregas={entregas} cursos={cursos.map((c) => ({ id: c.id, titulo: c.titulo }))} cursoId={curso ?? ""} estado={filtroEstado ?? ""} />
    </div>
  );
}
