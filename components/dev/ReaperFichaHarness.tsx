"use client";
import { useState } from "react";
import { ReaperFicha } from "@/components/admin/reaper/ReaperFicha";
import type { FichaReaper } from "@/lib/reaper-ficha";
import type { RenderJob, MusicoLite } from "@/lib/render-jobs";

const ahora = Date.now();
const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();

const job = (id: string, tipo: RenderJob["tipo"], min: number, extra: Partial<RenderJob> = {}): RenderJob => ({
  id, proyectoId: "p-trip", tareaId: "t-kh", tipo, estado: "listo", previoNum: null, error: null,
  createdAt: hace(min), driveUrls: [{ archivo: `${id}.mp3`, id: `d-${id}`, url: "https://drive.google.com" }],
  enlacePublico: null, compartir: false, avisadoEn: null, musicoId: null, origen: "reaper", opciones: null,
  ...extra,
});

// Un tema de TRiP MX a medio camino: dos músicos con previo, uno sin nada.
const FICHA: FichaReaper = {
  item: {
    key: "t-kh", proyectoId: "p-trip", tareaId: "t-kh", titulo: "LA KHABALAH", album: "TRiP MX 🇲🇽",
    cliente: "Juan José Pemberthy", folio: "P0065", estado: "produccion", puedeAvisar: true,
    ultimoPrevio: 2, tonalidad: "Em", bpm: 124,
    jobs: [
      job("j6", "stems", 30, { driveUrls: [{ archivo: "a", id: "1", url: "https://drive.google.com" }, { archivo: "b", id: "2", url: "https://drive.google.com" }] }),
      job("j5", "previo", 1440, { previoNum: 2, compartir: true, avisadoEn: hace(1430) }),
      job("j4", "musico", 2000, { musicoId: "m-martin", avisadoEn: hace(1990), enlacePublico: "https://drive.google.com", opciones: { instrumento: "Charchetas", bpm: 124, tonalidad: "Em" } }),
      job("j3", "musico", 2100, { musicoId: "m-adal", avisadoEn: hace(2090), origen: "reenvio", opciones: { instrumento: "Tololoche" } }),
      job("j2", "previo", 4000, { previoNum: 1 }),
      job("j1", "cuantizar", 5000, { driveUrls: null }),
      job("j0", "previo", 4200, { musicoId: "m-martin", origen: "musico", compartir: true }),
    ],
    inventario: {
      carpeta: "D:\\PROYECTOS\\TRiP MX\\LA KHABALAH", error: null, escaneadoEn: hace(1),
      proyectos: [{ archivo: "LA KHABALAH.rpp", mtime: 0, bytes: 0, items: 120, bpm: 124, tonalidad: "Em", marcadores: [], seleccion: null, pistas: [], error: null }],
    },
  },
  musicos: [
    { musicoId: "m-jorge", nombre: "Jorge Orlando", instrumento: "Trombón", contratado: true, portalActivo: true, previos: [], asignacion: { estado: "pendiente" },
      subidas: { previos: 0, stems: 0, importados: 0, conError: 0, ultima: null } },
    { musicoId: "m-adal", nombre: "Adal Oche", instrumento: "Tololoche", contratado: true, portalActivo: false,
      previos: [{ jobId: "j3", fecha: hace(2100), estado: "listo", avisadoEn: hace(2090), url: "https://drive.google.com", reenvio: true }],
      asignacion: null, subidas: { previos: 0, stems: 0, importados: 0, conError: 0, ultima: null } },
    { musicoId: "m-martin", nombre: "Martín Montijo", instrumento: "Charchetas", contratado: true, portalActivo: true,
      previos: [{ jobId: "j4", fecha: hace(2000), estado: "listo", avisadoEn: hace(1990), url: "https://drive.google.com", reenvio: false }],
      asignacion: { estado: "entregado" }, subidas: { previos: 1, stems: 3, importados: 2, conError: 0, ultima: hace(300) } },
  ],
  nombres: { "m-martin": "Martín Montijo", "m-adal": "Adal Oche", "m-jorge": "Jorge Orlando" },
};

const CATALOGO: MusicoLite[] = [
  { id: "m-martin", nombre: "Martín Montijo", email: "m@example.com", instrumentos: ["Charchetas"], portalActivo: true },
  { id: "m-adal", nombre: "Adal Oche", email: "a@example.com", instrumentos: ["Tololoche"], portalActivo: false },
  { id: "m-jorge", nombre: "Jorge Orlando", email: "j@example.com", instrumentos: ["Trombón"], portalActivo: true },
];

const EDICION = {
  sinTabla: false, album: true,
  temas: [{
    tareaId: "t-kh", titulo: "LA KHABALAH", falta: [], editado: false,
    envios: [{ id: "e1", num: 1, estado: "listo", nota: "ya con las charchetas de Martín", notificar_a: "eq-diego",
      notificar_email: "diego@example.com", compartido_con: "diego@example.com", creado_at: hace(3000),
      cerrado_at: hace(2950), updated_at: hace(2950), avisado_en: hace(2950), error: null }],
    revisiones: [], total: 254, subidos: 250, fallados: 0, pendientes: 4, bytesPendientes: 38e6,
  }],
};

// Las llamadas al panel se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __bancoReaper?: boolean }).__bancoReaper) {
  (window as unknown as { __bancoReaper?: boolean }).__bancoReaper = true;
  const real = window.fetch.bind(window);
  const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/admin/edicion")) return json(EDICION);
    if (url.includes("/api/admin/musicos-de-venta")) return json({ musicos: [] });
    if (url.includes("/api/admin/")) return json({ ok: true });
    return real(input, init);
  };
}

/**
 * Banco de pruebas visual de la ficha de REAPER de un proyecto, con datos de
 * ejemplo. Para revisar el diseño sin iniciar sesión y sin tocar la base.
 */
export function ReaperFichaHarness() {
  const [claro, setClaro] = useState(false);
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-4 sm:p-8`}>
      <button onClick={() => setClaro((c) => !c)} className="mb-4 text-xs text-white/50 underline cursor-pointer">
        Banco de pruebas · cambiar a modo {claro ? "oscuro" : "claro"}
      </button>
      <div className="max-w-5xl">
        <ReaperFicha ficha={FICHA} musicos={CATALOGO} miId={null} />
      </div>
    </div>
  );
}
