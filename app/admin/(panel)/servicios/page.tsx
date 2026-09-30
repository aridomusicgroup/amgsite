import { requireModule } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCatalogoFresco } from "@/lib/servicios-catalogo";
import { catalogoDisenoFresco } from "@/lib/diseno-catalogo";
import { ServiciosPanel } from "@/components/admin/ServiciosPanel";

export const dynamic = "force-dynamic";

const clave = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * Ids de instrumentos que nadie del catálogo de músicos toca.
 *
 * Un instrumento sin músico se vende y genera su tarea "Grabar X", pero la
 * venta nace sin nadie a quien mandarle el previo: mejor saberlo al darlo de
 * alta que cuando ya hay un cliente esperando.
 */
async function extrasSinMusico(extras: { id: string; label: { es: string } }[]): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin().from("musicos").select("instrumentos, activo");
    const tocados = new Set(
      (data ?? [])
        .filter((m) => m.activo !== false)
        .flatMap((m) => (Array.isArray(m.instrumentos) ? (m.instrumentos as string[]) : []))
        .map(clave),
    );
    return extras.filter((e) => !tocados.has(clave(e.label.es))).map((e) => e.id);
  } catch {
    return [];
  }
}

export default async function ServiciosAdminPage() {
  const session = await requireModule("/admin/servicios");
  // Diseño trae el costo del diseñador (margen): sólo se le carga a un admin.
  const diseno = session.role === "admin" ? await catalogoDisenoFresco() : null;
  const { catalogo, enBase } = await getCatalogoFresco();
  const sinMusico = await extrasSinMusico(catalogo.extras);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Servicios del cotizador</h1>
        <p className="text-white/40 text-sm mt-1">
          Lo que se vende en aridomusicgroup.com/cotizador y lo que se puede elegir al cotizar aquí en el panel.
          Los cambios se ven en el sitio al guardar.
        </p>
      </div>
      <ServiciosPanel catalogo={catalogo} enBase={enBase} sinMusico={sinMusico} diseno={diseno} />
    </div>
  );
}
