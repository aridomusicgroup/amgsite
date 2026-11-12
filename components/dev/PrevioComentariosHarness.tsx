"use client";
import { useState } from "react";
import { RendersPedido } from "@/components/cuenta/RendersPedido";
import { PrevioClienteLanzador } from "@/components/admin/PrevioClienteLanzador";
import { ComentariosCliente } from "@/components/admin/proyecto-detalle/ComentariosCliente";
import { preguntarPrevioCliente } from "@/lib/entrega-cliente";
import type { RenderDelPedido } from "@/lib/cuenta-cliente";
import type { ComentarioDelCliente, ComentarioPrevio } from "@/lib/previo-comentarios";
import type { Renderizable } from "@/lib/render-jobs";

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const RENDERS: RenderDelPedido[] = [
  { jobId: "j2", tipo: "previo", previoNum: 2, fecha: hace(90), tareaId: null, tema: null,
    archivos: [{ idx: 0, nombre: "EL NECIO previo 2.wav", audio: true }] },
  { jobId: "j1", tipo: "previo", previoNum: 1, fecha: hace(60 * 30), tareaId: null, tema: null,
    archivos: [{ idx: 0, nombre: "EL NECIO previo 1.wav", audio: true }] },
];

const YA: ComentarioDelCliente[] = [
  { id: "c1", jobId: "j1", texto: "El bajo se come la voz en el verso 2.\nY el coro final se corta muy rápido.", segundo: 83, creadoAt: hace(60 * 28), atendido: true },
  { id: "c2", jobId: "j2", texto: "Ahora sí, solo sube un poquito la guitarra del puente", segundo: null, creadoAt: hace(40), atendido: false },
];

const EQUIPO: ComentarioPrevio[] = YA.map((c, i) => ({
  ...c, proyectoId: "p1", previoNum: i === 0 ? 1 : 2, tema: null, tareaId: `t${i}`,
}));

const P: Renderizable = {
  key: "p1", proyectoId: "p1", tareaId: null, titulo: "EL NECIO", album: null, cliente: "Ando",
  folio: "P0066", estado: "produccion", puedeAvisar: true, ultimoPrevio: 2, tonalidad: "Bbm", bpm: 127, jobs: [],
  inventario: {
    carpeta: "X:\\REAPER Media\\LATINOGANG\\ANDO\\EL NECIO", error: null, escaneadoEn: new Date().toISOString(),
    proyectos: [{
      archivo: "EL NECIO_001.rpp", mtime: 1_730_000_000_000, bytes: 1, items: 40, bpm: 127, tonalidad: "Bbm",
      marcadores: [{ nombre: "INTRO", seg: 4 }, { nombre: "CORO", seg: 60 }, { nombre: "FINAL", seg: 168 }],
      seleccion: null, error: null, pistas: [],
    }],
  },
};

// Las llamadas al sitio se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __bancoPrevioCom?: boolean }).__bancoPrevioCom) {
  (window as unknown as { __bancoPrevioCom?: boolean }).__bancoPrevioCom = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
    if (url.includes("/comentarios")) {
      const b = JSON.parse(String(init?.body ?? "{}"));
      await new Promise((r) => setTimeout(r, 500));
      if (String(b.texto).includes("error")) return json({ error: "Muchos comentarios seguidos. Espera unos minutos." }, 429);
      return json({ ok: true, comentario: { id: `n${Date.now()}`, jobId: b.jobId, texto: b.texto, segundo: b.segundo ?? null, creadoAt: new Date().toISOString(), atendido: false } });
    }
    if (url.includes("/api/admin/render/previo-datos")) return json({ p: P, musicos: [] });
    if (url.includes("/api/admin/")) return json({ ok: true });
    return real(input, init);
  };
}

/**
 * Banco de pruebas visual de los comentarios sobre un previo (panel del cliente
 * y del equipo) y de la pregunta "¿le mandas un previo al cliente?". En
 * producción no existe. Escribe "error" en un comentario para ver el error.
 */
export function PrevioComentariosHarness() {
  const [claro, setClaro] = useState(false);
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-4 sm:p-8`}>
      <button onClick={() => setClaro((c) => !c)} className="mb-6 text-xs text-white/50 underline cursor-pointer">
        Banco de pruebas · cambiar a modo {claro ? "oscuro" : "claro"}
      </button>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Panel del cliente</h2>
        <RendersPedido pedidoId="o1" renders={RENDERS} concepto="EL NECIO" comentarios={YA} />

        <h2 className="text-white/40 text-xs uppercase tracking-wide mt-10 mb-3">Panel del equipo · Resumen del proyecto</h2>
        <ComentariosCliente comentarios={EQUIPO} onVerTareas={() => {}} />

        <h2 className="text-white/40 text-xs uppercase tracking-wide mt-10 mb-3">Al palomear Mezclar / Masterizar</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => preguntarPrevioCliente({ proyectoId: "p1", temaId: null, donde: "EL NECIO", paso: "Mezclar", cliente: "Ando Reyes" })}
            className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm cursor-pointer">Mezclar (proyecto)</button>
          <button
            onClick={() => preguntarPrevioCliente({ proyectoId: "p1", temaId: "t1", donde: "TRiP MX 🇲🇽 · LA KHABALAH", paso: "Masterizar", cliente: null })}
            className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm cursor-pointer">Masterizar (tema de EP, sin nombre)</button>
        </div>
      </div>
      <PrevioClienteLanzador />
    </div>
  );
}
