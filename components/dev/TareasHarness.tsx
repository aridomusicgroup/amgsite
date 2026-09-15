"use client";
import { useState } from "react";
import { TareasTab } from "@/components/admin/proyecto-detalle/TareasTab";
import type { ProyectoDetalle, ProyectoTarea, SubTarea } from "@/lib/erp-data";

/**
 * Sólo para desarrollo (ver app/dev/tareas). Datos de ejemplo con la forma real
 * de TRiP MX y respuestas falsas para lo que la ventana pide al servidor.
 */

const equipo = [
  { id: "e-eliud", nombre: "Eliud Rocha" },
  { id: "e-luis", nombre: "Luis Rocha" },
  { id: "e-diego", nombre: "Diego" },
];
const RESP: Record<string, string> = { "e-eliud": "Eliud Rocha", "e-luis": "Luis Rocha", "e-diego": "Diego" };

const PASOS: [string, string][] = [
  ["Maqueta recibida", "e-eliud"], ["Grabar Tololoche", "e-luis"], ["Grabar Bajo", "e-eliud"],
  ["Grabar Armonía de 6", "e-eliud"], ["Grabar Requinto", "e-eliud"], ["Grabar Trombón", "e-luis"],
  ["Grabar Voces", "e-luis"], ["Editar y cuantizar", "e-diego"], ["Mezclar", "e-luis"],
  ["Masterizar", "e-luis"], ["Aprobada", "e-luis"], ["Subir a Drive", "e-luis"],
];

function tema(id: string, titulo: string, orden: number, ficha: Partial<ProyectoTarea>, hechas = 1): ProyectoTarea {
  const subtareas: SubTarea[] = PASOS.map(([t, r], i) => ({
    id: `${id}-s${i}`, titulo: t, hecho: i < hechas, orden: i, responsable_id: r, responsable: RESP[r],
    paso: t === "Aprobada" ? "aprobacion" : t === "Subir a Drive" ? "entrega" : null,
  }));
  return {
    id, titulo, hecho: false, responsable: "Eliud Rocha", responsable_id: "e-eliud", orden,
    notas: null, fecha: null, link_post: null, metricas: null, visible_cliente: true, revision: 0,
    es_cancion: true, tonalidad: null, bpm: null, compas: null, paso: null, entrega: null, subtareas, ...ficha,
  };
}

const tareas = [
  tema("t-kh", "LA KHABALAH", 0, { tonalidad: "Em", bpm: 202, compas: "3/4" }),
  tema("t-ef", "EFÍMERO", 1, { notas: "Referencia en el Drive" }, 0),
  tema("t-pr", "PROFECÍA", 2, { fecha: "2026-09-20" }),
];

const proyecto = {
  id: "p-trip", clase: "produccion", tipo: "ep", progreso: 8, tareas,
} as unknown as ProyectoDetalle;

const musicos = [
  { id: "m-adal", nombre: "Adal Oche", instrumentos: ["Tololoche"] },
  { id: "m-jorge", nombre: "Jorge Orlando", instrumentos: ["Trombón"] },
  { id: "m-martin", nombre: "Martin Montijo", instrumentos: ["Charchetas"] },
];

const ASIGNACIONES = [
  { id: "a1", musico_id: "m-adal", tarea_id: "t-kh", instrumento: "Tololoche", nota: null, estado: "pendiente",
    musicos: { nombre: "Adal Oche", email: "adal@example.com", portal_activo: false } },
  { id: "a2", musico_id: "m-jorge", tarea_id: "t-kh", instrumento: "Trombón", nota: null, estado: "pendiente",
    musicos: { nombre: "Jorge Orlando", email: "jorge@example.com", portal_activo: true } },
  { id: "a3", musico_id: "m-martin", tarea_id: "t-kh", instrumento: "Charchetas", nota: null, estado: "entregado",
    musicos: { nombre: "Martin Montijo", email: null, portal_activo: true } },
];

// Las llamadas al panel se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __banco?: boolean }).__banco) {
  (window as unknown as { __banco?: boolean }).__banco = true;
  const real = window.fetch.bind(window);
  const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/admin/musico-asignaciones")) return json({ asignaciones: ASIGNACIONES });
    if (url.includes("/api/admin/musicos-de-venta")) {
      return json({ musicos: [{ id: "m-adal", nombre: "Adal Oche", instrumento: "Tololoche", tienePortal: false }] });
    }
    if (url.includes("/api/admin/")) return json({ ok: true });
    return real(input, init);
  };
}

export function TareasHarness() {
  const [claro, setClaro] = useState(false);
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-5 sm:p-8`}>
      <button onClick={() => setClaro((c) => !c)} className="mb-4 text-xs text-white/50 underline cursor-pointer">
        Banco de pruebas · cambiar a modo {claro ? "oscuro" : "claro"}
      </button>
      <h1 className="font-coolvetica text-3xl sm:text-4xl">TRiP MX 🇲🇽</h1>
      <p className="text-white/40 text-sm mb-6">P0065 · EP · Producción · Juanjo Pemberthy</p>
      <TareasTab proyecto={proyecto} equipo={equipo} recordatorios={{}} miId={null} musicos={musicos} />
    </div>
  );
}
