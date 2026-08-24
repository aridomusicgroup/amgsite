import { requireModule } from "@/lib/supabase/auth-server";
import { getCursosAdmin } from "@/lib/cursos-admin";
import { CursosPanel } from "@/components/admin/CursosPanel";

export const dynamic = "force-dynamic";

export default async function CursosAdminPage() {
  await requireModule("/admin/cursos");
  const cursos = await getCursosAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Cursos</h1>
        <p className="text-white/40 text-sm mt-1">
          El material vive en Drive — aquí armas los módulos y lecciones, y das el acceso
        </p>
      </div>
      <CursosPanel cursos={cursos} />
    </div>
  );
}
