"use client";
import { useMemo, useState } from "react";
import { RenderOpciones } from "@/components/admin/RenderOpciones";
import type { OndaDatos } from "@/lib/onda-rango";
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

const MTIME = 1_730_000_000_000;

const P: Renderizable = {
  key: "p1", proyectoId: "p1", tareaId: null, titulo: "Sangreloco", album: null, cliente: "Ando",
  folio: "P0066", estado: "produccion", puedeAvisar: true, ultimoPrevio: 2, tonalidad: "Bbm", bpm: 127, jobs: [],
  inventario: {
    carpeta: "X:\\REAPER Media\\LATINOGANG\\ANDO\\SANGRELOCO", error: null, escaneadoEn: new Date().toISOString(),
    proyectos: [{
      archivo: "SANGRELOCO_001.rpp", mtime: MTIME, bytes: 1, items: 40, bpm: 127, tonalidad: "Bbm",
      marcadores: [
        { nombre: "INTRO", seg: 4 }, { nombre: "VERSO", seg: 20 }, { nombre: "CORO", seg: 60 },
        { nombre: "VERSO 2", seg: 90 }, { nombre: "CORO 2", seg: 120 }, { nombre: "FINAL", seg: 168 },
      ],
      seleccion: { inicio: 20, fin: 150, valida: true },
      error: null, pistas: PISTAS,
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

/** Un "tema" de 190 s: intro baja, versos, coros fuertes y un final que se apaga. */
function ondaSintetica(): OndaDatos {
  const duracion = 190;
  const n = 1520;
  const bytes = new Uint8Array(n);
  const nivel = (t: number) => {
    if (t < 3.5) return 0;                 // silencio antes de que entre algo
    if (t < 20) return 0.28;               // intro
    if (t < 60) return 0.55;               // verso
    if (t < 90) return 0.9;                // coro
    if (t < 120) return 0.55;
    if (t < 168) return 0.9;
    if (t < 188) return 0.9 * (1 - (t - 168) / 20);   // se apaga
    return 0;
  };
  for (let i = 0; i < n; i++) {
    const t = (i / n) * duracion;
    const base = nivel(t);
    const ruido = base ? 0.82 + 0.18 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31)) : 0;
    bytes[i] = Math.round(255 * Math.sqrt(Math.min(1, base * ruido)));
  }
  return { duracion, picos: btoa(String.fromCharCode(...bytes)), items: 40, omitidos: 0, mtime: MTIME };
}

export type EstadoOnda = "sintetica" | "sin" | "vieja" | "lenta" | "omitidos";

/**
 * Banco de pruebas del cuadro de opciones de un render.
 *  - `?tipo=previo|entregables|musico|stems` y `?viejo=1` (inventario sin ids).
 *  - `?onda=sintetica|sin|vieja|lenta|omitidos`: cómo responde la onda.
 *  - `?picos=<base64>&dur=<segundos>`: una onda REAL (la que calcula reaper-sync).
 */
export function RenderOpcionesHarness({
  tipo = "stems", viejo = false, onda = "sintetica", picos, dur,
}: { tipo?: TipoRender; viejo?: boolean; onda?: EstadoOnda; picos?: string; dur?: number }) {
  const [ultimo, setUltimo] = useState<OpcionesRender | null>(null);

  const cargarOnda = useMemo(() => {
    const datos: OndaDatos | null =
      picos && dur ? { duracion: dur, picos, items: 474, omitidos: 0, mtime: MTIME }
        : onda === "sin" ? null
          : onda === "vieja" ? { ...ondaSintetica(), mtime: MTIME - 5000 }
            : onda === "omitidos" ? { ...ondaSintetica(), omitidos: 3 }
              : ondaSintetica();
    return async () => {
      if (onda === "lenta") await new Promise((r) => setTimeout(r, 4000));
      return datos;
    };
  }, [onda, picos, dur]);

  return (
    <div className="min-h-screen bg-lgb-black p-4 text-white">
      <pre id="ultimo" className="text-xs text-white/60 whitespace-pre-wrap break-all">{JSON.stringify(ultimo)}</pre>
      <RenderOpciones
        p={viejo ? P_VIEJO : P} tipo={tipo} cargarOnda={cargarOnda}
        musicos={[{ id: "m1", nombre: "Martín Montijo", email: "m@x.mx", instrumentos: ["Charchetas"], portalActivo: true }]}
        enviando={false} onCerrar={() => {}} onConfirmar={setUltimo}
      />
    </div>
  );
}
