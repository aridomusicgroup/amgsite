import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CotizacionesPanel } from "@/components/admin/CotizacionesPanel";
import { CONTRACT_TIPOS } from "@/lib/pdf/contracts";
import { catalogoDiseno, PROVEEDOR_DISENO } from "@/lib/diseno-catalogo";
import type { Cotizacion } from "@/lib/cotizaciones-data";

/**
 * Banco de pruebas de las cotizaciones de DISEÑO VISUAL: el grupo "Diseño" del
 * catálogo, el tema de origen y el pago a Julio con el margen en vivo. Datos de
 * ejemplo, sin sesión; guardar pega contra la API real y da 401 (a propósito).
 * `?claro=1` lo pinta en el modo claro del panel. En producción no existe.
 */

const CLIENTE = "00000000-0000-0000-0000-0000000000c1";
const TEMA = "00000000-0000-0000-0000-0000000000a1";

const base: Cotizacion = {
  id: "00000000-0000-0000-0000-0000000000b1", folio: "COT-0099", tipo: "diseno", esquema_pago: "contado",
  num_canciones: null, ep_album_formato: null, contacto_id: CLIENTE, contacto_origen: "instagram",
  cliente_nombre: "Alto Nivel", cliente_email: "altonivel@correo.com", cliente_telefono: "4881234567", cliente_direccion: null,
  moneda: "MXN", tipo_cambio: null,
  items: [{ label: "Paquete Lanzamiento Básico", qty: 1, unitPrice: 1050 }, { label: "Entrega urgente en 48 h", qty: 1, unitPrice: 150 }],
  descuento: 0, descuento_fidelidad: 0, credito_aplicado: 0, sin_descuento_fidelidad: false, musicos: [], temas: null,
  proyecto_origen_id: TEMA, costo_proveedor: 800,
  comision_pct: 0, total: 1200, total_mxn: 1200, notas: null, vigencia_dias: 15, estado: "enviada",
  creado_por: "dev", created_at: "2026-09-18T12:00:00.000Z",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ claro?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { claro } = await searchParams;
  return (
    <main className={`min-h-screen bg-lgb-black text-white p-4 sm:p-8 max-w-4xl mx-auto ${claro ? "panel-light" : ""}`}>
      <Suspense>
        <CotizacionesPanel
          cotizaciones={[base, { ...base, id: "00000000-0000-0000-0000-0000000000b2", folio: "COT-0098", tipo: "beat_personalizado", proyecto_origen_id: null, costo_proveedor: null, items: [{ label: "Paquete Tumbes", qty: 1, unitPrice: 6000 }], total: 6000, total_mxn: 6000 }]}
          contratos={[]}
          clientes={[{ id: CLIENTE, nombre: "Alto Nivel", email: "altonivel@correo.com", telefono: "4881234567", direccion: null }]}
          tipos={CONTRACT_TIPOS}
          rastro={{}}
          isAdmin
          plantillas={[]}
          tcSugerido={16.8}
          equipo={[{ id: "e1", nombre: "Eliud", rol: "socio" }, { id: "e2", nombre: "Luis", rol: "socio" }]}
          catalogoDiseno={catalogoDiseno()}
          proveedorDiseno={PROVEEDOR_DISENO}
          proyectosTema={[
            { id: TEMA, folio: "P0062", titulo: "Alto Nivel", contacto_id: CLIENTE, cliente: "Alto Nivel", estado: "entregado" },
            { id: "00000000-0000-0000-0000-0000000000a2", folio: "P0061", titulo: "Sin Ti Muero", contacto_id: "otro", cliente: "Rocha", estado: "cerrado" },
          ]}
        />
      </Suspense>
    </main>
  );
}
