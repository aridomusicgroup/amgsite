"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Wand2 } from "lucide-react";
import {
  formatearTiempo, leerTiempo, marcadoresVisibles, normalizarRango, pasoDeRegla, pegarAMarcador,
  reducirPicos, trazoOnda, type OndaDatos, type Rango,
} from "@/lib/onda-rango";

/** Puntos que se dibujan: en un cuadro de ~460 px más no se distinguen. */
const PUNTOS_DIBUJADOS = 500;
const ALTO = 96;
/** A cuántos píxeles de un marcador el arrastre se pega a él. */
const IMAN_PX = 6;
/** A cuántos píxeles de un asa un clic la agarra en vez de empezar un tramo nuevo. */
const AGARRE_PX = 16;
/** Sin onda no hay eje; este tope sólo evita escribir tiempos absurdos. */
export const TOPE_SIN_ONDA = 36000;

const redondear = (s: number) => Math.round(s * 100) / 100;
/** `3:10` para la regla (sin décimas). */
const corto = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Hasta dónde llega el eje: un poco más allá del último item, para poder elegir la cola. */
export function ejeDe(duracion: number, fin = 0): number {
  return Math.max(5, duracion * 1.03 + 2, fin);
}

/**
 * La forma de onda del proyecto con el tramo a renderizar encima.
 *
 * Es una vista de CONTROL: `rango` y `onElegir` viven en el cuadro de opciones,
 * que es quien manda. Aquí sólo se dibuja y se traducen arrastres, teclas y
 * campos de texto a un rango nuevo. Arrastrar en cualquier modo pasa a "a la
 * medida" (lo decide el cuadro, no este componente).
 *
 * La onda es aproximada —suma de los audios, sin efectos ni volúmenes— y la
 * pantalla lo dice. Sirve para ver dónde hay sonido, no cómo suena.
 */
export function OndaRango({
  cargando, datos, picos, vieja, marcadores, sonido, rango, onElegir, onTodo,
}: {
  cargando: boolean;
  datos: OndaDatos | null;
  picos: Uint8Array;
  /** La onda se calculó con otra versión del .rpp (cambió desde entonces). */
  vieja: boolean;
  marcadores: { nombre: string; seg: number }[];
  /** Dónde se detectó el inicio y el fin del sonido, si se pudo. */
  sonido: Rango | null;
  /** El tramo que va a renderizarse, o null si es todo el proyecto. */
  rango: Rango | null;
  onElegir: (r: Rango) => void;
  onTodo: () => void;
}) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(460);
  // Qué se está arrastrando. `fijo` es el extremo que no se mueve.
  const arrastre = useRef<{ que: "ini" | "fin" | "nuevo"; fijo: number } | null>(null);

  const eje = datos ? ejeDe(datos.duracion, rango?.fin ?? 0) : TOPE_SIN_ONDA;
  const tope = eje;

  useEffect(() => {
    const el = cajaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setAncho(el.getBoundingClientRect().width || 460));
    ro.observe(el);
    return () => ro.disconnect();
  }, [datos, cargando]);

  const trazo = useMemo(() => {
    if (!datos) return "";
    // La onda ocupa de 0 a `duracion`; el resto del eje (la cola) queda vacío.
    return trazoOnda(reducirPicos(picos, PUNTOS_DIBUJADOS), 1000 * (datos.duracion / eje), ALTO);
  }, [datos, picos, eje]);

  const pct = (seg: number) => `${Math.min(100, Math.max(0, (seg / eje) * 100))}%`;
  const segDe = (clientX: number) => {
    const r = cajaRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(eje, Math.max(0, ((clientX - r.left) / r.width) * eje));
  };
  const pegar = (s: number) => pegarAMarcador(s, marcadores, (IMAN_PX / ancho) * eje);

  const fijarInicio = (v: number) => {
    if (rango) onElegir(normalizarRango({ inicio: Math.min(redondear(v), rango.fin - 1), fin: rango.fin }, tope));
  };
  const fijarFin = (v: number) => {
    if (rango) onElegir(normalizarRango({ inicio: rango.inicio, fin: Math.max(redondear(v), rango.inicio + 1) }, tope));
  };

  // ── Arrastre ────────────────────────────────────────────────────────────
  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!datos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = segDe(e.clientX);
    if (rango) {
      const px = (seg: number) => (seg / eje) * ancho;
      const dIni = Math.abs(px(rango.inicio) - px(s));
      const dFin = Math.abs(px(rango.fin) - px(s));
      if (Math.min(dIni, dFin) <= AGARRE_PX) {
        arrastre.current = dIni <= dFin ? { que: "ini", fijo: rango.fin } : { que: "fin", fijo: rango.inicio };
        return;
      }
    }
    arrastre.current = { que: "nuevo", fijo: pegar(s) };
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastre.current;
    if (!a) return;
    const s = pegar(segDe(e.clientX));
    if (a.que === "ini") onElegir(normalizarRango({ inicio: Math.min(s, a.fijo - 1), fin: a.fijo }, tope));
    else if (a.que === "fin") onElegir(normalizarRango({ inicio: a.fijo, fin: Math.max(s, a.fijo + 1) }, tope));
    // Un clic suelto no debe crear un tramo: hace falta arrastrar un poco.
    else if (Math.abs(s - a.fijo) >= 0.3) onElegir(normalizarRango({ inicio: Math.min(s, a.fijo), fin: Math.max(s, a.fijo) }, tope));
  };

  const alSoltar = () => { arrastre.current = null; };

  const teclas = (e: React.KeyboardEvent, que: "ini" | "fin") => {
    if (!rango) return;
    const paso = e.shiftKey ? 1 : 0.1;
    let d = 0;
    if (e.key === "ArrowLeft") d = -paso;
    else if (e.key === "ArrowRight") d = paso;
    else return;
    e.preventDefault();
    if (que === "ini") fijarInicio(rango.inicio + d);
    else fijarFin(rango.fin + d);
  };

  // ── Regla y etiquetas ───────────────────────────────────────────────────
  const paso = pasoDeRegla(eje, ancho);
  const marcas: number[] = [];
  for (let t = 0; t < eje; t += paso) marcas.push(t);
  const etiquetados = marcadoresVisibles(marcadores.filter((m) => m.seg <= eje), eje, ancho);

  return (
    <div className="mt-3 flex flex-col gap-2">
      {cargando ? (
        <div className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" aria-label="Cargando la forma de onda" />
      ) : !datos ? (
        <p className="text-[11px] text-white/40 leading-relaxed">
          Todavía no hay forma de onda de esta versión: el script local la calcula en su siguiente
          corrida (cada 2 minutos). Mientras tanto puedes elegir el tramo escribiendo los tiempos.
        </p>
      ) : (
        <>
          <div
            ref={cajaRef}
            role="group"
            aria-label="Forma de onda del proyecto: arrastra para elegir el tramo a renderizar"
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            className="relative rounded-xl bg-black/30 border border-white/10 overflow-hidden select-none touch-none cursor-crosshair"
            style={{ height: ALTO }}
          >
            <svg viewBox={`0 0 1000 ${ALTO}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
              <path d={trazo} className="fill-white/35" />
            </svg>

            {marcadores.filter((m) => m.seg <= eje).map((m, i) => (
              <div key={`l-${i}`} className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none" style={{ left: pct(m.seg) }} />
            ))}
            {etiquetados.map((m, i) => (
              <span
                key={`e-${i}`}
                className="absolute top-0.5 ml-1 max-w-[84px] truncate text-[11px] leading-none text-white/55 pointer-events-none"
                style={{ left: pct(m.seg) }}
              >
                {m.nombre || "·"}
              </span>
            ))}

            {rango && (
              <>
                {/* Lo que queda fuera del tramo se oscurece. */}
                <div className="absolute top-0 bottom-0 left-0 bg-black/55 pointer-events-none" style={{ width: pct(rango.inicio) }} />
                <div className="absolute top-0 bottom-0 right-0 bg-black/55 pointer-events-none" style={{ left: pct(rango.fin) }} />
                <div
                  className="absolute top-0 bottom-0 bg-lgb-red/10 border-x border-lgb-red/60 pointer-events-none"
                  style={{ left: pct(rango.inicio), width: `${((rango.fin - rango.inicio) / eje) * 100}%` }}
                />
                {(["ini", "fin"] as const).map((que) => {
                  const seg = que === "ini" ? rango.inicio : rango.fin;
                  return (
                    <div
                      key={que}
                      role="slider"
                      tabIndex={0}
                      aria-label={que === "ini" ? "Inicio del tramo" : "Fin del tramo"}
                      aria-valuemin={0}
                      aria-valuemax={Math.round(eje)}
                      aria-valuenow={redondear(seg)}
                      aria-valuetext={formatearTiempo(seg)}
                      onKeyDown={(e) => teclas(e, que)}
                      className="absolute top-0 bottom-0 w-7 -ml-3.5 flex items-center justify-center cursor-ew-resize focus:outline-none group"
                      style={{ left: pct(seg) }}
                    >
                      <span className="h-8 w-2 rounded-full bg-lgb-red shadow group-focus-visible:ring-2 group-focus-visible:ring-white/70" />
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="relative h-4 text-[11px] text-white/35 select-none" aria-hidden>
            {marcas.map((t) => (
              <span key={t} className="absolute top-0" style={{ left: pct(t), transform: t === 0 ? "none" : "translateX(-50%)" }}>
                {corto(t)}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Los campos funcionan aunque no haya onda: es el respaldo exacto del arrastre. */}
      {rango ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CampoTiempo etiqueta="Inicio" valor={rango.inicio} onCommit={fijarInicio} />
          <CampoTiempo etiqueta="Fin" valor={rango.fin} onCommit={fijarFin} />
          <span className="text-[11px] text-white/40 tabular-nums">dura {formatearTiempo(rango.fin - rango.inicio)}</span>
        </div>
      ) : (
        datos && <p className="text-[11px] text-white/40">Arrastra sobre la onda para elegir un tramo.</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {datos && sonido && (
          <button
            type="button" onClick={() => onElegir(normalizarRango(sonido, tope))}
            className="inline-flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white cursor-pointer"
          >
            <Wand2 size={12} /> Ajustar a donde hay sonido
          </button>
        )}
        {rango && (
          <button type="button" onClick={onTodo} className="text-[11px] text-white/60 hover:text-white underline underline-offset-2 cursor-pointer">
            Todo el proyecto
          </button>
        )}
      </div>

      {datos && (
        <p className="text-[11px] text-white/30 leading-relaxed">
          Onda aproximada: suma de los audios del proyecto, sin efectos ni volúmenes (no incluye
          colas de reverb).
          {datos.omitidos > 0 && ` ${datos.omitidos} item${datos.omitidos === 1 ? "" : "s"} no se pudieron leer y no aparecen.`}
          {vieja && <span className="text-amber-300"> El proyecto cambió después de calcularla; se actualiza sola en unos minutos.</span>}
        </p>
      )}
    </div>
  );
}

/** `m:ss.d` editable, con ±0.1 s. Escribe con libertad y se aplica al salir (Enter) o se cancela (Esc). */
function CampoTiempo({ etiqueta, valor, onCommit }: { etiqueta: string; valor: number; onCommit: (seg: number) => void }) {
  // null = no se está editando: se muestra el valor de afuera.
  const [texto, setTexto] = useState<string | null>(null);
  const cancelado = useRef(false);

  const aplicar = () => {
    if (cancelado.current) { cancelado.current = false; setTexto(null); return; }
    if (texto === null) return;
    const v = leerTiempo(texto);
    setTexto(null);
    // Sólo si se EDITÓ. Enfocar y salir sin escribir no debe reescribir el tramo:
    // el campo muestra décimas, y un marcador en 168.4375 pasaría a 168.4 y, de
    // paso, el cuadro cambiaría a "A la medida" sin que nadie lo pidiera.
    if (v !== null && texto.trim() !== formatearTiempo(valor)) onCommit(v);
  };

  const boton = "w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/70 cursor-pointer";
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-white/40 w-9">{etiqueta}</span>
      <button type="button" aria-label={`${etiqueta}: 0.1 segundos antes`} onClick={() => onCommit(valor - 0.1)} className={boton}>
        <Minus size={12} />
      </button>
      <input
        type="text" inputMode="decimal" aria-label={etiqueta}
        value={texto ?? formatearTiempo(valor)}
        onFocus={(e) => { setTexto(formatearTiempo(valor)); e.currentTarget.select(); }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={aplicar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") { cancelado.current = true; e.currentTarget.blur(); }
        }}
        className="w-[4.75rem] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-center tabular-nums text-white focus:outline-none focus:border-lgb-red"
      />
      <button type="button" aria-label={`${etiqueta}: 0.1 segundos después`} onClick={() => onCommit(valor + 0.1)} className={boton}>
        <Plus size={12} />
      </button>
    </div>
  );
}
