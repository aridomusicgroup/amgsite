import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/auth-server";
import { getDashboardData } from "@/lib/erp-data";
import { Dashboard } from "@/components/admin/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Solo admin ve el Dashboard; los demás caen en Producción (módulo base de todos).
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "admin") redirect("/admin/produccion");

  const { ventas, ingresos, egresos, contactos, proyectos } = await getDashboardData();
  return <Dashboard ventas={ventas} ingresos={ingresos} egresos={egresos} contactos={contactos} proyectos={proyectos} />;
}
