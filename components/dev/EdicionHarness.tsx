"use client";
import { useState } from "react";
import { EdicionProyecto } from "@/components/admin/proyecto-detalle/EdicionProyecto";

const ahora = Date.now();
const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();

const envio = (num: number, estado: string, min: number, extra: Record<string, unknown> = {}) => ({
  id: `e-${num}-${min}`, num, estado, nota: null, notificar_a: "eq-diego",
  notificar_email: "diego@example.com", compartido_con: "diego@example.com",
  creado_at: hace(min), cerrado_at: estado === "listo" ? hace(min - 30) : null,
  updated_at: hace(1), avisado_en: estado === "listo" ? hace(min - 30) : null, error: null, ...extra,
});

// Los tres temas reales de TRiP MX, con lo que de verdad les falta hoy.
const TEMAS = [
  {
    tareaId: "t-kh", titulo: "LA KHABALAH", falta: [], editado: false,
    envios: [envio(1, "subiendo", 12)], revisiones: [],
    total: 254, subidos: 158, fallados: 0, pendientes: 96, bytesPendientes: 480e6,
  },
  {
    tareaId: "t-ef", titulo: "EFÍMERO",
    falta: ["Extras trombon", "Extras Tololoche", "Grabar Charchetas", "Grabar Voces"], editado: false,
    envios: [], revisiones: [],
    total: 132, subidos: 0, fallados: 0, pendientes: 132, bytesPendientes: 610e6,
  },
  {
    tareaId: "t-pr", titulo: "PROFECÍA", falta: [], editado: false,
    envios: [envio(1, "listo", 2880)],
    revisiones: [{ id: "r1", num: 1, nombre: "PROFECÍA rev1.rpp", bytes: 1.2e6, nota: "cuantizadas guitarras",
      subido_por: "diego@example.com", subido_at: hace(600), bajado_at: hace(590), ruta_local: null, ultimo_error: null }],
    total: 170, subidos: 162, fallados: 0, pendientes: 8, bytesPendientes: 42e6,
  },
  {
    tareaId: "t-x", titulo: "Canción 4 con un nombre bastante largo para ver el corte", falta: [], editado: true,
    envios: [envio(1, "listo", 9000)], revisiones: [], total: 90, subidos: 90, fallados: 0, pendientes: 0, bytesPendientes: 0,
  },
];

// Las llamadas al panel se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __bancoEd?: boolean }).__bancoEd) {
  (window as unknown as { __bancoEd?: boolean }).__bancoEd = true;
  const real = window.fetch.bind(window);
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/admin/edicion")) {
      const metodo = init?.method ?? "GET";
      if (metodo === "GET") return json({ sinTabla: false, album: true, temas: TEMAS });
      if (metodo === "POST") {
        const b = JSON.parse(String(init?.body ?? "{}"));
        const n = Array.isArray(b.tarea_ids) ? b.tarea_ids.length : 1;
        return json({ ok: true, envio: 1, archivos: 132, temas: n, avisaraA: "diego@example.com" });
      }
      return json({ ok: true, revision: 2, palomeado: null });
    }
    return real(input, init);
  };
}

/**
 * Banco de pruebas visual del envío a edición por tema (EP/álbum), con datos
 * de TRiP MX. Para revisar el diseño sin iniciar sesión y sin tocar la base.
 */
export function EdicionHarness() {
  const [claro, setClaro] = useState(false);
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-4 sm:p-8`}>
      <button onClick={() => setClaro((c) => !c)} className="mb-4 text-xs text-white/50 underline cursor-pointer">
        Banco de pruebas · cambiar a modo {claro ? "oscuro" : "claro"}
      </button>
      <h1 className="font-coolvetica text-3xl sm:text-4xl">TRiP MX 🇲🇽</h1>
      <p className="text-white/40 text-sm mb-6">P0065 · EP · Producción · pestaña Producción</p>
      <div className="max-w-3xl">
        <EdicionProyecto proyectoId="p-trip" miId={null} />
      </div>
    </div>
  );
}
