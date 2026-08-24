import { requireModule } from "@/lib/supabase/auth-server";
import { getCotizaciones, getContratos, getRastroCotizaciones } from "@/lib/cotizaciones-data";
import { tipoCambioSugerido } from "@/lib/tipo-cambio-server";
import { getContactos } from "@/lib/erp-data";
import { CONTRACT_TIPOS } from "@/lib/pdf/contracts";
import { getPlantillasEditor } from "@/lib/plantillas-data";
import { CotizacionesPanel } from "@/components/admin/CotizacionesPanel";

export const dynamic = "force-dynamic";

export default async function CotizacionesAdminPage() {
  const session = await requireModule("/admin/cotizaciones");

  const [cotizaciones, contratos, contactos, rastro, tcSugerido] = await Promise.all([
    getCotizaciones(),
    getContratos(),
    getContactos(),
    getRastroCotizaciones(),
    // Promedio de las últimas ventas en dólares: se propone al cotizar en USD.
    tipoCambioSugerido(),
  ]);

  const clientes = contactos
    .filter((c) => c.nombre)
    .map((c) => ({ id: c.id, nombre: c.nombre as string, email: c.email, telefono: c.telefono, direccion: c.direccion }));

  // Las plantillas editables sólo las usa el admin (pestaña Plantillas).
  const plantillas = session.role === "admin" ? await getPlantillasEditor() : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Cotizaciones y Contratos</h1>
        <p className="text-white/40 text-sm mt-1">
          Una producción nace aquí: cotización → venta → proyecto → contrato, todo conectado
        </p>
      </div>
      <CotizacionesPanel
        cotizaciones={cotizaciones}
        contratos={contratos}
        clientes={clientes}
        tipos={CONTRACT_TIPOS}
        rastro={rastro}
        isAdmin={session.role === "admin"}
        plantillas={plantillas}
        tcSugerido={tcSugerido}
      />
    </div>
  );
}
