import { requireModule } from "@/lib/supabase/auth-server";
import { getContactos, crmResumen, getRecompraMarcas } from "@/lib/erp-data";
import { candidatosRecompra } from "@/lib/recompra";
import { CrmList } from "@/components/admin/CrmList";
import { SeguimientosSugeridos } from "@/components/admin/SeguimientosSugeridos";
import { RecompraPanel } from "@/components/admin/RecompraPanel";
import { ActividadFeed } from "@/components/admin/ActividadFeed";

export const dynamic = "force-dynamic";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * Los atajos del panel de Marketing llegan aquí con `?foco=` / `?contacto=`
 * (ej. "9 clientes listos para recomprar" → `?foco=recompra`). Se leen en el
 * servidor y se pasan como props: así la lista ya nace filtrada, sin parpadeo.
 */
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const [contactos, marcas, session, sp] = await Promise.all([
    getContactos(),
    getRecompraMarcas(),
    requireModule("/admin/clientes"),
    searchParams,
  ]);
  const isAdmin = session.role === "admin";
  const r = crmResumen(contactos);
  const recompra = candidatosRecompra(contactos, marcas);

  const foco = typeof sp.foco === "string" ? sp.foco : null;
  const contactabilidad = typeof sp.contacto === "string" ? sp.contacto : null;

  const kpis = [
    { label: "Contactos", value: String(r.total) },
    { label: "Clientes", value: String(r.clientes) },
    { label: "En negociación", value: String(r.porEtapa["negociacion"] ?? 0) },
    { label: "Valor de clientes", value: peso(r.ltvTotal) },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-coolvetica text-3xl">Clientes / CRM</h1>
          <p className="text-white/40 text-sm mt-1">
            Todos los contactos de todos los canales, con su etapa y cuánto han comprado.
          </p>
        </div>
        {/* Campanita propia del módulo: los movimientos del CRM ya no se pierden
            en la de Producción. */}
        <ActividadFeed modulo="clientes" titulo="Actividad de Clientes" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-coolvetica">{k.value}</p>
            <p className="text-white/40 text-xs mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <RecompraPanel candidatos={recompra} abiertoInicial={foco === "recompra"} />
      <SeguimientosSugeridos />
      <CrmList
        contactos={contactos}
        isAdmin={isAdmin}
        focoInicial={foco === "toca" || foco === "sin" ? foco : undefined}
        contactoInicial={contactabilidad ?? undefined}
      />
    </div>
  );
}
