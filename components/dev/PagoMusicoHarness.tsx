"use client";
import { useState } from "react";
import { PagoMusicoLanzador } from "@/components/admin/PagoMusicoLanzador";
import { preguntarPagoMusico } from "@/lib/entrega-cliente";
import type { PreguntaPago } from "@/lib/pago-grabacion-tipos";

const base = { proyectoId: "p-1", ventaId: "v-1", abonado: 0, temasRestantes: null };

const CASOS: { nombre: string; p: PreguntaPago }[] = [
  {
    nombre: "Proyecto normal, pago pendiente",
    p: { ...base, temaId: null, donde: "EL NECIO", instrumento: "Charchetas", musico: "Martín Montijo",
      pagoId: "pm-1", monto: 1200, pendiente: 1200, sugerido: 1200 },
  },
  {
    nombre: "Tema de EP (le quedan 3), con anticipo",
    p: { ...base, temaId: "t-1", donde: "TRiP MX 🇲🇽 · LA KHABALAH", instrumento: "Trombón", musico: "Jorge Orlando",
      pagoId: "pm-2", monto: 2400, abonado: 600, pendiente: 1800, sugerido: 600, temasRestantes: 3 },
  },
  {
    nombre: "Sin pago en la venta (registrar)",
    p: { ...base, temaId: null, donde: "ALTO NIVEL", instrumento: "Tololoche", musico: "Adal Oche",
      pagoId: null, monto: 900, pendiente: 900, sugerido: 900 },
  },
];

// Las llamadas al panel se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __bancoPago?: boolean }).__bancoPago) {
  (window as unknown as { __bancoPago?: boolean }).__bancoPago = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/admin/")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return real(input, init);
  };
}

/** Banco de pruebas visual de "¿Le pagas al músico?". En producción no existe. */
export function PagoMusicoHarness() {
  const [claro, setClaro] = useState(false);
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-4 sm:p-8`}>
      <button onClick={() => setClaro((c) => !c)} className="mb-4 text-xs text-white/50 underline cursor-pointer">
        Banco de pruebas · cambiar a modo {claro ? "oscuro" : "claro"}
      </button>
      <div className="flex flex-col gap-2 max-w-sm">
        {CASOS.map((c) => (
          <button key={c.nombre} onClick={() => preguntarPagoMusico(c.p)}
            className="text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm cursor-pointer">
            {c.nombre}
          </button>
        ))}
      </div>
      <PagoMusicoLanzador />
    </div>
  );
}
