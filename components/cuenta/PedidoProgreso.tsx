"use client";
import { useEffect, useState } from "react";
import { Check, CalendarCheck, CalendarClock } from "lucide-react";
import type { PedidoTarea } from "@/lib/cuenta-cliente";

interface Props {
  concepto: string;
  tareas: PedidoTarea[];
  hechas: number;
  total: number;
  pct: number;
  entregado: boolean;
  /** Ronda de revisión en curso (0 = sin revisiones). */
  revisionActual: number;
  /** EP o Álbum: cada tarea es una canción, no una etapa del proceso. */
  esAlbum: boolean;
  /** Entrega estimada (YYYY-MM-DD) o null si el equipo no la ha fijado. */
  fechaEntrega: string | null;
  /** Entrega real, si ya se entregó. Manda sobre la estimada. */
  fechaEntregaReal: string | null;
}

/**
 * Timeline vertical hipnótico: una línea que se "llena" con un gradiente en
 * movimiento; la tarea ACTUAL resalta y late, las demás fases quedan nítidas y
 * legibles con una leve atenuación. Respeta prefers-reduced-motion.
 */
export function PedidoProgreso({ concepto, tareas, hechas, total, pct, entregado, revisionActual, esAlbum, fechaEntrega, fechaEntregaReal }: Props) {
  const unidad = esAlbum ? (total === 1 ? "canción" : "canciones") : "etapas";
  // Índice de la tarea "actual" = la primera no completada (o ninguna si ya acabó).
  const currentIndex = tareas.findIndex((t) => !t.hecho);
  const [fill, setFill] = useState(0);

  // Rellena la línea desde 0 al montar (reveal animado).
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="pp">
      <style>{CSS}</style>

      {/* Encabezado con % grande */}
      <div className="pp-head">
        <div>
          <p className="pp-kicker">{entregado ? "Producción entregada" : "Avance de tu producción"}</p>
          <h2 className="pp-title">{concepto}</h2>
          <div className="pp-chips">
            <EntregaChip entregado={entregado} fechaEntrega={fechaEntrega} fechaEntregaReal={fechaEntregaReal} />
            {revisionActual > 0 && (
              <span className="pp-round">🔄 Ronda de revisión {revisionActual}</span>
            )}
          </div>
        </div>
        <div className="pp-pct" aria-label={`${pct} por ciento`}>
          <span>{pct}</span><small>%</small>
        </div>
      </div>

      {/* Barra superior fina animada */}
      <div className="pp-bar">
        <div className="pp-bar-fill" style={{ width: `${fill}%` }} />
      </div>
      <p className="pp-count">{hechas} de {total} {unidad} completadas</p>

      {/* Timeline */}
      <div className="pp-track">
        <div className="pp-line" />
        <div className="pp-line-fill" style={{ height: `${fill}%` }} />
        <ul className="pp-list">
          {tareas.map((t, i) => {
            const estado = t.hecho ? "done" : i === currentIndex ? "current" : "future";
            // Sin desenfoque: todas las fases nítidas y legibles. Solo una leve
            // atenuación de opacidad para que la etapa actual resalte.
            const dist = currentIndex < 0 ? 0 : Math.abs(i - currentIndex);
            const opacity = estado === "current" ? 1 : Math.max(0.55, 0.8 - dist * 0.08);
            const esRev = t.revision > 0;
            return (
              <li key={t.id} className={`pp-item pp-${estado}${esRev ? " pp-rev" : ""}`} style={{ opacity }}>
                <span className="pp-node">
                  {t.hecho ? <Check size={13} strokeWidth={3} /> : <span className="pp-dot" />}
                </span>
                <span className="pp-label">
                  {t.titulo}
                  {esRev && <span className="pp-rev-badge">R{t.revision}</span>}
                  {/* Desglose de pasos: solo el conteo y la barra. Los títulos
                      internos de las subtareas NO se le muestran al cliente. */}
                  {!t.hecho && t.subTotal > 0 && (
                    <span className="pp-sub">
                      <span className="pp-sub-bar">
                        <span
                          className="pp-sub-fill"
                          style={{ width: `${Math.round((t.subHechas / t.subTotal) * 100)}%` }}
                        />
                      </span>
                      <span className="pp-sub-txt">{t.subHechas} de {t.subTotal} pasos</span>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-09-15" → "15 de septiembre". Sin año: la entrega siempre está cerca. */
function fechaLarga(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${Number(m[3])} de ${mes}` : null;
}

/** Días entre hoy y una fecha YYYY-MM-DD, en la zona horaria de QUIEN MIRA. */
function diasHasta(iso: string): number | null {
  const destino = Date.parse(`${iso}T12:00:00`);
  if (Number.isNaN(destino)) return null;
  const h = new Date();
  const hoy = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 12).getTime();
  return Math.round((destino - hoy) / 86400000);
}

/**
 * Fecha de entrega del pedido, tal como la ve el cliente.
 *
 * Dos reglas de negocio metidas aquí a propósito:
 *  1. La cuenta regresiva ("faltan 5 días") se calcula DESPUÉS de montar. En el
 *     servidor "hoy" es UTC y en el navegador es la hora de México: pintarla en
 *     el render inicial descuadraría la hidratación cerca de medianoche.
 *  2. Si la fecha ya pasó y no hemos entregado, se muestra la fecha SIN conteo.
 *     Nunca un "faltan -3 días": el atraso se atiende por WhatsApp, no con un
 *     número rojo en la cara del cliente.
 */
export function EntregaChip({
  entregado, fechaEntrega, fechaEntregaReal,
}: { entregado: boolean; fechaEntrega: string | null; fechaEntregaReal: string | null }) {
  const yaEntregado = entregado || Boolean(fechaEntregaReal);
  const iso = (yaEntregado ? fechaEntregaReal ?? fechaEntrega : fechaEntrega) ?? null;
  const [relativo, setRelativo] = useState<string | null>(null);

  useEffect(() => {
    if (!iso || yaEntregado) { setRelativo(null); return; }
    const dias = diasHasta(iso);
    if (dias === null || dias < 0) { setRelativo(null); return; }
    setRelativo(dias === 0 ? "es hoy" : dias === 1 ? "es mañana" : `faltan ${dias} días`);
  }, [iso, yaEntregado]);

  if (!iso) return null;
  const texto = fechaLarga(iso);
  if (!texto) return null;

  return (
    <span className={`pp-fecha${yaEntregado ? " pp-fecha-ok" : ""}`}>
      {/* Estilos propios: el chip también se usa fuera del timeline (pedido aún
          sin etapas), donde el <style> de PedidoProgreso no llega a montarse. */}
      <style>{CHIP_CSS}</style>
      {yaEntregado ? <CalendarCheck size={13} strokeWidth={2.4} /> : <CalendarClock size={13} strokeWidth={2.4} />}
      <span>
        {yaEntregado ? "Entregado el " : "Entrega estimada: "}
        <b>{texto}</b>
        {relativo && <span className="pp-fecha-rel"> · {relativo}</span>}
      </span>
    </span>
  );
}

const CHIP_CSS = `
.pp-chips { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:9px; }
.pp-chips:empty { display:none; }
.pp-fecha { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; line-height:1.2;
  color:rgba(255,255,255,.72); border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05);
  border-radius:99px; padding:4px 11px 4px 9px; }
.pp-fecha svg { color:#c42f42; flex-shrink:0; }
.pp-fecha b { color:#fff; font-weight:700; }
.pp-fecha-rel { color:rgba(255,255,255,.45); }
.pp-fecha-ok { color:#8fe0b0; border-color:rgba(52,199,123,.35); background:rgba(52,199,123,.1); }
.pp-fecha-ok svg { color:#34c77b; }
.pp-fecha-ok b { color:#c9f5dc; }
`;

const CSS = `
.pp { color:#fff; }
.pp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:16px; }
.pp-kicker { color:#c42f42; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0 0 4px; font-weight:700; }
.pp-title { font-size:22px; margin:0; line-height:1.15; }
.pp-chips { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:9px; }
.pp-chips:empty { display:none; }
.pp-pct { font-weight:800; line-height:1; color:#fff; white-space:nowrap; }
.pp-pct span { font-size:44px; }
.pp-pct small { font-size:18px; color:#c42f42; margin-left:2px; }
.pp-bar { height:8px; background:rgba(255,255,255,.08); border-radius:99px; overflow:hidden; }
.pp-bar-fill { height:100%; border-radius:99px; width:0; transition:width 1.1s cubic-bezier(.16,1,.3,1);
  background:linear-gradient(90deg,#7a1420,#c42f42,#ff5a6e,#c42f42,#7a1420); background-size:200% 100%; animation:pp-slide 2.6s linear infinite; }
.pp-count { color:rgba(255,255,255,.4); font-size:12px; margin:8px 0 22px; }

.pp-track { position:relative; padding-left:8px; }
.pp-line, .pp-line-fill { position:absolute; left:19px; top:8px; bottom:8px; width:3px; border-radius:99px; }
.pp-line { background:rgba(255,255,255,.09); }
.pp-line-fill { bottom:auto; height:0; transition:height 1.2s cubic-bezier(.16,1,.3,1);
  background:linear-gradient(180deg,#7a1420,#c42f42,#ff5a6e,#c42f42,#7a1420); background-size:100% 200%; animation:pp-slidev 2.6s linear infinite;
  box-shadow:0 0 14px rgba(196,47,66,.6); }

.pp-list { list-style:none; margin:0; padding:0; position:relative; z-index:1; display:flex; flex-direction:column; gap:20px; }
.pp-item { display:flex; align-items:center; gap:14px; transition:filter .5s ease, opacity .5s ease; }
.pp-node { width:26px; height:26px; border-radius:99px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  background:#141414; border:2px solid rgba(255,255,255,.15); color:#fff; }
.pp-done .pp-node { background:#c42f42; border-color:#c42f42; }
.pp-current .pp-node { border-color:#c42f42; background:#1a0e10; animation:pp-pulse 1.8s ease-in-out infinite; }
.pp-dot { width:8px; height:8px; border-radius:99px; background:#c42f42; }
.pp-current .pp-dot { animation:pp-blink 1.8s ease-in-out infinite; }
.pp-label { font-size:14.5px; line-height:1.25; }

/* Avance interno de una etapa/canción: barra + conteo, sin nombres de pasos. */
.pp-sub { display:block; margin-top:7px; }
.pp-sub-bar { display:block; height:4px; width:132px; max-width:100%; border-radius:99px;
  background:rgba(255,255,255,.1); overflow:hidden; }
.pp-sub-fill { display:block; height:100%; border-radius:99px; background:#c42f42;
  transition:width .9s cubic-bezier(.16,1,.3,1); }
.pp-sub-txt { display:block; margin-top:4px; font-size:11.5px; color:rgba(255,255,255,.5); }
.pp-rev .pp-sub-fill { background:#f59e0b; }
@media (prefers-reduced-motion: reduce) { .pp-sub-fill { transition:none; } }
.pp-done .pp-label { color:rgba(255,255,255,.55); }
.pp-current .pp-label { color:#fff; font-weight:600; }
.pp-future .pp-label { color:rgba(255,255,255,.6); }

/* Chip de ronda de revisión + tareas de revisión (tonalidad ámbar). */
.pp-round { display:inline-block; font-size:11px; font-weight:700; color:#f59e0b;
  border:1px solid rgba(245,158,11,.4); background:rgba(245,158,11,.12); border-radius:99px; padding:3px 10px; }
.pp-rev .pp-node { border-color:#f59e0b; }
.pp-rev.pp-done .pp-node { background:#f59e0b; border-color:#f59e0b; }
.pp-rev.pp-current .pp-node { border-color:#f59e0b; background:#1a1206; }
.pp-rev .pp-dot { background:#f59e0b; }
.pp-rev .pp-label { color:#fcd9a1; }
.pp-rev-badge { font-size:10px; font-weight:800; color:#f59e0b; border:1px solid rgba(245,158,11,.4);
  background:rgba(245,158,11,.12); border-radius:99px; padding:1px 6px; margin-left:7px; letter-spacing:.5px; vertical-align:middle; }

@keyframes pp-slide { to { background-position:-200% 0; } }
@keyframes pp-slidev { to { background-position:0 -200%; } }
@keyframes pp-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(196,47,66,.55); } 50% { box-shadow:0 0 0 8px rgba(196,47,66,0); } }
@keyframes pp-blink { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(.7); } }

@media (prefers-reduced-motion: reduce) {
  .pp-bar-fill, .pp-line-fill { animation:none; }
  .pp-current .pp-node, .pp-current .pp-dot { animation:none; }
}
`;
