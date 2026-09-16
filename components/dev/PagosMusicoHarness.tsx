"use client";
import { useEffect } from "react";
import { PagosMusicoResumen } from "@/components/admin/PagosMusicoResumen";
import type { PagoMusicoRow, VentaParaPago } from "@/lib/erp-data";

const VENTAS: VentaParaPago[] = [
  { id: "v1", folio: "I0086", fecha: "2026-09-14", concepto: "TRiP MX", cliente: "Juan José Pemberthy", extras: "Tololoche, Trombón, Charchetas" },
  { id: "v2", folio: "I0085", fecha: "2026-09-10", concepto: "Beat personalizado", cliente: "El Chapo de Sinaloa", extras: "Requinto" },
  { id: "v3", folio: "I0084", fecha: "2026-09-02", concepto: "CHANEL", cliente: "Rocha", extras: null },
];
const PAGOS: PagoMusicoRow[] = [
  { id: "p0", venta: "I0086", beat: "TRiP MX", cliente: "Juan José Pemberthy", proyecto: "TRiP MX", musico: "Rodrigo", monto: 2000, fecha: null, medio_pago: null, pagado: false, nota: null, abonos: [{ monto: 1000, fecha: "2026-09-15", medio_pago: "Efectivo" }] },
  { id: "p1", venta: "I0086", beat: "TRiP MX", cliente: "Juan José Pemberthy", proyecto: "TRiP MX", musico: "Adal", monto: 1500, fecha: null, medio_pago: null, pagado: false, nota: "Auto: tololoche", abonos: [] },
  { id: "p2", venta: "I0085", beat: "Beat personalizado", cliente: "El Chapo", proyecto: null, musico: "Martín", monto: 800, fecha: "2026-09-11", medio_pago: "Transferencia", pagado: true, nota: null, abonos: [] },
];

export function PagosMusicoHarness() {
  useEffect(() => {
    const real = window.fetch;
    window.fetch = async (input, init) => {
      const u = String(input);
      if (u.includes("/api/admin/musicos")) return new Response(JSON.stringify({ musicos: [
        { id: "m1", nombre: "Adal", instrumentos: ["Tololoche"], tarifa: 1500, activo: true },
        { id: "m2", nombre: "Jorge", instrumentos: ["Trombón"], tarifa: 1200, activo: true },
        { id: "m3", nombre: "Martín", instrumentos: ["Charchetas", "Requinto"], tarifa: 800, activo: true },
      ] }));
      if (u.includes("/api/admin/pagos-musico")) { console.log("API", init?.method, init?.body); return new Response(JSON.stringify({ ok: true })); }
      return real(input, init);
    };
    return () => { window.fetch = real; };
  }, []);
  return (
    <main className="min-h-screen bg-lgb-dark text-white p-4 sm:p-8 max-w-3xl mx-auto">
      <PagosMusicoResumen pagos={PAGOS} ventas={VENTAS} total={2300} pendiente={1500} pendientes={1} />
    </main>
  );
}
