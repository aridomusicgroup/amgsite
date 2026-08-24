import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/auth-server";
import { getProyectos, getEquipoActivo, getContactos, getVentas } from "@/lib/erp-data";
import { misRecordatorios } from "@/lib/recordatorios-server";
import { ProduccionBoard } from "@/components/admin/ProduccionBoard";
import { ActividadFeed } from "@/components/admin/ActividadFeed";
import { PushToggle } from "@/components/admin/PushToggle";

export const dynamic = "force-dynamic";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

export default async function ProduccionPage() {
  // Acceso a todo el equipo de producción (admin, crm/Tozi, producción/Diego·Leo).
  const session = await getSession();
  if (!session) redirect("/admin/login");

  // Los recordatorios se piden aparte porque dependen de QUIÉN abre el tablero:
  // cada quien ve los suyos, no los del equipo.
  const [proyectos, equipo, contactos, ventas, recordatorios] = await Promise.all([
    getProyectos(), getEquipoActivo(), getContactos(), getVentas(), misRecordatorios(session.email),
  ]);
  // Lista ligera para autocompletar el cliente al crear una producción
  const clientes = contactos
    .filter((c) => c.nombre)
    .map((c) => ({ nombre: c.nombre as string, email: c.email, telefono: c.telefono }));
  // Ventas para ligar una existente a un proyecto (solo admins lo usan).
  // Sin el folio/id en el texto: beat · cliente · monto (legible y único en la práctica).
  const ventasLite = session.role === "admin"
    ? ventas.map((v) => ({
        id: v.id,
        label: `${v.beat_nombre || v.tipo || "Venta"}${v.cliente ? " · " + v.cliente : ""} · ${peso(v.total_mxn)}`,
      }))
    : [];

  // "Mi ficha": casa el correo de sesión con el equipo → al entrar ve lo suyo
  const yo = equipo.find((e) => e.email && e.email.toLowerCase() === session.email.toLowerCase());
  const defaultResp = yo?.id ?? "todos";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-coolvetica text-3xl">Producción</h1>
          <p className="text-white/40 text-sm mt-1">
            Producciones y tareas del equipo · muévelas por etapa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PushToggle />
          <ActividadFeed modulo="produccion" titulo="Actividad de Producción" />
        </div>
      </div>
      <ProduccionBoard proyectos={proyectos} equipo={equipo} clientes={clientes} ventas={ventasLite} isAdmin={session.role === "admin"} defaultResp={defaultResp} recordatorios={recordatorios} miId={yo?.id ?? null} />
    </div>
  );
}
