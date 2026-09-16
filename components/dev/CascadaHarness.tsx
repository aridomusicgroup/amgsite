"use client";
import { useState } from "react";
import { ConfirmCascadeDialog, type TipoCascada } from "@/components/admin/ui/ConfirmCascadeDialog";

/**
 * Sólo para desarrollo (ver app/dev/eliminar): la ventana de borrado con
 * dependencias de ejemplo, sin base ni sesión.
 */
const DEPS = {
  proyecto: {
    tareas: 36, subtareas: 12, recordatorios: 2, renderJobs: 3, renderInventario: 51,
    proyectos: 0, proyectosTitulos: [],
    ventas: 1, pagos: 2, montoTotalMxn: 24300, pagosMusico: 3, montoPagosMusicoMxn: 2200,
    contratos: 1, contratosFirmados: 1, pedidos: 1, driveArchivos: 14, driveCarpetaId: "abc",
  },
  venta: {
    tareas: 36, subtareas: 12, recordatorios: 2, renderJobs: 3, renderInventario: 51,
    proyectos: 1, proyectosTitulos: ["TRiP MX 🇲🇽"],
    ventas: 1, pagos: 2, montoTotalMxn: 24300, pagosMusico: 3, montoPagosMusicoMxn: 2200,
    contratos: 1, contratosFirmados: 0, pedidos: 1, driveArchivos: 14, driveCarpetaId: "abc",
  },
};

if (typeof window !== "undefined" && !(window as unknown as { __bancoCascada?: boolean }).__bancoCascada) {
  (window as unknown as { __bancoCascada?: boolean }).__bancoCascada = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/dependencias")) return json(url.includes("/ventas/") ? DEPS.venta : DEPS.proyecto);
    if (url.includes("/api/admin/")) return json({ ok: true });
    return real(input, init);
  };
}

export function CascadaHarness() {
  const [tipo, setTipo] = useState<TipoCascada | null>(null);
  return (
    <main className="min-h-screen bg-lgb-black text-white p-5 sm:p-8">
      <h1 className="font-coolvetica text-2xl mb-4">Banco de pruebas · eliminar con dependencias</h1>
      <div className="flex gap-2">
        <button onClick={() => setTipo("proyecto")} className="bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg text-sm cursor-pointer">
          Eliminar un proyecto
        </button>
        <button onClick={() => setTipo("venta")} className="bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg text-sm cursor-pointer">
          Eliminar una venta
        </button>
      </div>
      {tipo && (
        <ConfirmCascadeDialog
          open
          tipo={tipo}
          id={tipo === "venta" ? "v-1" : "p-1"}
          titulo={tipo === "venta" ? "I0086 · TRiP MX" : "TRiP MX 🇲🇽"}
          onClose={() => setTipo(null)}
          onConfirmed={() => setTipo(null)}
        />
      )}
    </main>
  );
}
