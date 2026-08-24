import { redirect } from "next/navigation";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { getVentas, getInventario } from "@/lib/erp-data";
import { VentasList } from "@/components/admin/VentasList";
import { NuevaVentaForm } from "@/components/admin/NuevaVentaForm";
import { tipoCambioSugerido } from "@/lib/tipo-cambio-server";

export const dynamic = "force-dynamic";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

export default async function VentasPage() {
  if (!(await getFullAdminEmail())) redirect("/admin"); // solo admins totales
  const [ventas, inventario, tcSugerido] = await Promise.all([
    getVentas(), getInventario(), tipoCambioSugerido(),
  ]);
  const beats = inventario.map((b) => ({ id: b.id, nombre: b.nombre }));
  const total = ventas.reduce((a, v) => a + v.total_mxn, 0);
  const ticket = ventas.length ? total / ventas.length : 0;
  const porCobrar = ventas.reduce((a, v) => a + v.saldo, 0);

  const kpis = [
    { label: "Ventas", value: String(ventas.length) },
    { label: "Total (MXN)", value: peso(total) },
    { label: "Ticket promedio", value: peso(ticket) },
    { label: "Por cobrar", value: peso(porCobrar), amber: porCobrar > 0 },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Ventas</h1>
        <p className="text-white/40 text-sm mt-1">Histórico de ventas de todos los canales.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <p className={`text-xl sm:text-2xl font-coolvetica ${k.amber ? "text-amber-300" : ""}`}>{k.value}</p>
            <p className="text-white/40 text-xs mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <NuevaVentaForm beats={beats} tcSugerido={tcSugerido} />
      <VentasList ventas={ventas} />
    </div>
  );
}
