"use client";
import { useState } from "react";
import { RenderOpciones } from "@/components/admin/RenderOpciones";
import type { OpcionesRender, Renderizable } from "@/lib/render-jobs";

const P: Renderizable = {
  key: "p1", proyectoId: "p1", tareaId: null, titulo: "Sangreloco", album: null, cliente: "Ando",
  folio: "P0066", estado: "produccion", puedeAvisar: true, ultimoPrevio: 2, tonalidad: "Bbm", bpm: 127, jobs: [],
  inventario: {
    carpeta: "X:\REAPER Media\LATINOGANG\ANDO\SANGRELOCO", error: null, escaneadoEn: new Date().toISOString(),
    proyectos: [{
      archivo: "SANGRELOCO_001.rpp", mtime: Date.now(), bytes: 1, items: 40, bpm: 127, tonalidad: "Bbm",
      marcadores: [], seleccion: null, error: null,
      pistas: ["GTR PE", "BAJO-TOLO", "TROMBON", "CHARCHETAS"].map((nombre) => ({ nombre, esStem: true, silenciada: false, profundidad: 0 })),
    }],
  },
};

/** Banco de pruebas del cuadro de opciones de un render de stems. */
export function RenderOpcionesHarness() {
  const [ultimo, setUltimo] = useState<OpcionesRender | null>(null);
  return (
    <div className="min-h-screen bg-lgb-black p-4 text-white">
      <pre id="ultimo" className="text-xs text-white/60">{JSON.stringify(ultimo)}</pre>
      <RenderOpciones p={P} tipo="stems" musicos={[]} enviando={false} onCerrar={() => {}} onConfirmar={setUltimo} />
    </div>
  );
}
