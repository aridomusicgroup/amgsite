"use client";
import { useState } from "react";
import { ProduccionBoard } from "@/components/admin/ProduccionBoard";
import { DevLogsPanel } from "@/components/admin/DevLogsPanel";
import type { Proyecto } from "@/lib/erp-data";
import type { ArchivoRpp, Renderizable } from "@/lib/render-jobs";

/**
 * Sólo para desarrollo (ver app/dev/abrir-reaper). El botón "Abrir en REAPER"
 * en el tablero de Producción y en la sección REAPER, con un proyecto de un
 * solo .rpp, uno con tres y un EP de dos temas.
 */

const RAIZ = "X:\\REAPER Media\\LATINOGANG";
const ahora = Date.now();
const hace = (min: number) => ahora - min * 60_000;
const rpp = (archivo: string, mtime: number) =>
  ({ archivo, mtime, bytes: 600_000, marcadores: [], seleccion: null, pistas: [], error: null }) as ArchivoRpp;

const INVENTARIO: Record<string, { titulo: string; album: string | null; carpeta: string; archivos: ArchivoRpp[] }[]> = {
  "p-uno": [{ titulo: "DE NEGRO", album: null, carpeta: `${RAIZ}\\JUAN JOSE HUERTA GARCIA\\DE NEGRO`, archivos: [rpp("DE NEGRO.rpp", hace(95))] }],
  "p-varios": [{
    titulo: "PALACIO PRIVADO", album: null, carpeta: `${RAIZ}\\ANDO\\PALACIO PRIVADO`,
    archivos: [rpp("PALACIO PRIVADO v2.rpp", hace(40)), rpp("PALACIO PRIVADO.rpp", hace(60 * 26)), rpp("PALACIO PRIVADO REV01.rpp", hace(60 * 24 * 5))],
  }],
  "p-ep": [
    { titulo: "LA KHABALAH", album: "TRiP MX", carpeta: `${RAIZ}\\JUANJO PEMBERTHY\\TRIP MX\\LA KHABALAH`, archivos: [rpp("LA KHABALAH.rpp", hace(60 * 3))] },
    { titulo: "EFÍMERO", album: "TRiP MX", carpeta: `${RAIZ}\\JUANJO PEMBERTHY\\TRIP MX\\EFÍMERO`, archivos: [rpp("EFÍMERO.rpp", hace(12))] },
  ],
};

const proyecto = (id: string, titulo: string, contacto: string, estado: string, tipo: string): Proyecto => ({
  id, folio: id.toUpperCase(), titulo, clase: "produccion", tipo, estado, prioridad: "media", contacto,
  responsable: null, responsable_id: null, responsables: [], responsablesNombres: ["Luis Rocha"],
  tareas: [], progreso: 0, revisionActual: 0, ventaSaldo: 0, ventaTotal: 0, venta_id: "v",
  fecha_entrega: null, fechaVenta: null, creado: new Date(hace(60 * 24 * 3)).toISOString().slice(0, 10),
}) as unknown as Proyecto;

const PROYECTOS = [
  proyecto("p-uno", "DE NEGRO", "Juan Jose Huerta Garcia", "produccion", "beat_personalizado"),
  proyecto("p-varios", "PALACIO PRIVADO", "Ando", "produccion", "beat_personalizado"),
  proyecto("p-ep", "TRiP MX", "Juanjo Pemberthy", "revision", "ep"),
  proyecto("p-sin", "SIN CARPETA TODAVÍA", "Cliente nuevo", "cola", "beat_personalizado"),
];

const RENDERIZABLES: Renderizable[] = Object.entries(INVENTARIO).flatMap(([proyectoId, temas]) =>
  temas.map((t) => ({
    key: `${proyectoId}-${t.titulo}`, proyectoId, tareaId: t.album ? t.titulo : null, titulo: t.titulo, album: t.album,
    cliente: PROYECTOS.find((p) => p.id === proyectoId)?.contacto ?? "—", folio: proyectoId.toUpperCase(),
    estado: "produccion", puedeAvisar: true, ultimoPrevio: 0, tonalidad: null, bpm: null, jobs: [],
    inventario: { carpeta: t.carpeta, proyectos: t.archivos, error: null, escaneadoEn: new Date().toISOString() },
  })));

// Las llamadas al panel se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __bancoAbrir?: boolean }).__bancoAbrir) {
  (window as unknown as { __bancoAbrir?: boolean }).__bancoAbrir = true;
  const real = window.fetch.bind(window);
  const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/admin/reaper-archivos")) {
      const id = new URL(url, window.location.origin).searchParams.get("proyecto") ?? "";
      const { opcionesRpp } = await import("@/lib/abrir-reaper");
      await new Promise((r) => setTimeout(r, 350)); // que se vea el giro de carga
      const temas = (INVENTARIO[id] ?? []).map((t) => ({ titulo: t.titulo, album: t.album, inventario: { carpeta: t.carpeta, proyectos: t.archivos } }));
      return json({ opciones: opcionesRpp(temas) });
    }
    if (url.includes("/api/admin/")) return json({ ok: true });
    return real(input, init);
  };
}

export function AbrirReaperHarness() {
  const [claro, setClaro] = useState(false);
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-4 sm:p-8`}>
      <button onClick={() => setClaro((c) => !c)} className="mb-4 text-xs text-white/50 underline cursor-pointer">
        Banco de pruebas · cambiar a modo {claro ? "oscuro" : "claro"}
      </button>
      <h2 className="font-coolvetica text-2xl mb-3">Producción</h2>
      <ProduccionBoard proyectos={PROYECTOS} equipo={[]} clientes={[]} ventas={[]} isAdmin conReaper={["p-uno", "p-varios", "p-ep"]} />
      <h2 className="font-coolvetica text-2xl mt-10 mb-3">REAPER</h2>
      <DevLogsPanel logs={[]} proyectos={RENDERIZABLES} musicos={[]} />
    </div>
  );
}
