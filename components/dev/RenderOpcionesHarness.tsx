"use client";
import { useState } from "react";
import { RenderOpciones } from "@/components/admin/RenderOpciones";
import type { OpcionesRender, PistaRpp, Renderizable, TipoRender } from "@/lib/render-jobs";

const guid = (n: number) => `{AAAAAAAA-0000-0000-0000-${String(n).padStart(12, "0")}}`;
const pista = (n: number, nombre: string, profundidad: number, silenciada = false): PistaRpp =>
  ({ id: guid(n), nombre, esStem: profundidad === 0, silenciada, profundidad });

// La estructura real de la plantilla: carpetas, nombres que se repiten
// (C414/TLM103/LINE) y una pista que ya viene silenciada en el proyecto.
const PISTAS: PistaRpp[] = [
  pista(1, "MIXBUS", 0), pista(2, "VCA", 0),
  pista(3, "GTR GRP", 0), pista(4, "HI GTR", 1), pista(5, "C414", 2), pista(6, "TLM103", 2), pista(7, "LINE", 2),
  pista(8, "REQUINTO", 1), pista(9, "C414", 2), pista(10, "TLM103", 2), pista(11, "LINE", 2),
  pista(12, "BAJO-TOLO", 0), pista(13, "LO (C414)", 1), pista(14, "HI", 1),
  pista(15, "CHARCHETAS", 0), pista(16, "L", 1), pista(17, "R", 1),
  pista(18, "VOX GRP", 0), pista(19, "LEAD", 1), pista(20, "PC LEAD", 1), pista(21, "SEGUNDA", 1),
  pista(22, "FRAGMENTS", 0, true),
];

const P: Renderizable = {
  key: "p1", proyectoId: "p1", tareaId: null, titulo: "Sangreloco", album: null, cliente: "Ando",
  folio: "P0066", estado: "produccion", puedeAvisar: true, ultimoPrevio: 2, tonalidad: "Bbm", bpm: 127, jobs: [],
  inventario: {
    carpeta: "X:\\REAPER Media\\LATINOGANG\\ANDO\\SANGRELOCO", error: null, escaneadoEn: new Date().toISOString(),
    proyectos: [{
      archivo: "SANGRELOCO_001.rpp", mtime: Date.now(), bytes: 1, items: 40, bpm: 127, tonalidad: "Bbm",
      marcadores: [], seleccion: null, error: null, pistas: PISTAS,
    }],
  },
};

/** Inventario como lo publicaba el script antes de que existiera el `id`. */
const P_VIEJO: Renderizable = {
  ...P,
  inventario: P.inventario && {
    ...P.inventario,
    proyectos: P.inventario.proyectos.map((a) => ({ ...a, pistas: a.pistas.map((t) => ({ ...t, id: undefined })) })),
  },
};

/**
 * Banco de pruebas del cuadro de opciones de un render.
 * `?tipo=previo|entregables|musico|stems` y `?viejo=1` (inventario sin ids).
 */
export function RenderOpcionesHarness({ tipo = "stems", viejo = false }: { tipo?: TipoRender; viejo?: boolean }) {
  const [ultimo, setUltimo] = useState<OpcionesRender | null>(null);
  return (
    <div className="min-h-screen bg-lgb-black p-4 text-white">
      <pre id="ultimo" className="text-xs text-white/60">{JSON.stringify(ultimo)}</pre>
      <RenderOpciones
        p={viejo ? P_VIEJO : P} tipo={tipo}
        musicos={[{ id: "m1", nombre: "Martín Montijo", email: "m@x.mx", instrumentos: ["Charchetas"], portalActivo: true }]}
        enviando={false} onCerrar={() => {}} onConfirmar={setUltimo}
      />
    </div>
  );
}
