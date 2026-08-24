import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/auth-server";
import { getRendimiento } from "@/lib/erp-data";
import { RendimientoPanel } from "@/components/admin/RendimientoPanel";

export const dynamic = "force-dynamic";

export default async function RendimientoPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const { equipo, tareas, proyectos, horas, contenido } = await getRendimiento();
  const isAdmin = session.role === "admin";
  // "Mi ficha": casa el correo de la sesión con un miembro del equipo
  const yo = equipo.find((e) => e.email && e.email.toLowerCase() === session.email.toLowerCase());

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Rendimiento</h1>
        <p className="text-white/40 text-sm mt-1">
          {isAdmin ? "Productividad, cumplimiento y carga del equipo." : "Tu productividad y cumplimiento."}
        </p>
      </div>
      <RendimientoPanel
        equipo={equipo}
        tareas={tareas}
        proyectos={proyectos}
        horas={horas}
        contenido={contenido}
        isAdmin={isAdmin}
        myId={yo?.id ?? null}
      />
    </div>
  );
}
