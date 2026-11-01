"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AudioWaveform, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { enlaceReaper, haceCuanto, type RppOpcion } from "@/lib/abrir-reaper";

interface Menu {
  left: number;
  ancho: number;
  /** Abajo del botón (`top`) o, si no cabe, arriba (`bottom`). */
  top?: number;
  bottom?: number;
  /** Dentro de `.panel-light` si el panel está en modo claro: en <body> perdería el tema. */
  destino: Element;
}

const ANCHO = 288;
/** Lo que mide más o menos el menú con 3 opciones: si abajo no cabe, abre hacia arriba. */
const ALTO_TIPICO = 220;

const sinExt = (archivo: string) => archivo.replace(/\.rpp$/i, "");
const fecha = (mtime: number) =>
  new Date(mtime).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Botón "Abrir en REAPER". Con un solo .rpp lo abre directo; con varios deja
 * elegir, con el modificado más reciente arriba como sugerencia.
 *
 * Sólo responde en la compu del estudio (ahí está registrado `arido-reaper://`,
 * ver reaper-sync/abrir-reaper.js), por eso no sale en el cel.
 *
 * `opciones`: la lista ya cargada (sección REAPER). `proyectoId`: se pide al
 * acercar el mouse (tablero de Producción), para que al hacer clic ya esté.
 */
export function AbrirReaper({ opciones, proyectoId, variante = "icono" }: {
  opciones?: RppOpcion[];
  proyectoId?: string;
  variante?: "icono" | "boton";
}) {
  const [pedidas, setPedidas] = useState<RppOpcion[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const pedido = useRef<Promise<RppOpcion[]> | null>(null);
  const lista = opciones ?? pedidas;

  // Se pide de nuevo en cada vuelta (acercar → abrir): el script cambia el
  // inventario cada 2 min y una lista vieja ofrecería un .rpp que ya no está.
  const olvidar = () => { pedido.current = null; };

  const cargar = (): Promise<RppOpcion[]> => {
    if (opciones) return Promise.resolve(opciones);
    if (!proyectoId) return Promise.resolve([]);
    pedido.current ??= fetch(`/api/admin/reaper-archivos?proyecto=${proyectoId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudo leer el inventario de REAPER.");
        const ops = (d.opciones ?? []) as RppOpcion[];
        setPedidas(ops);
        return ops;
      })
      .catch((e: unknown) => { olvidar(); throw e; });
    return pedido.current;
  };

  const cerrar = () => { setMenu(null); olvidar(); };

  const alClic = async (e: React.MouseEvent) => {
    // La tarjeta del tablero se arrastra y se despliega: el clic es sólo del botón.
    e.preventDefault();
    e.stopPropagation();
    if (menu) { cerrar(); return; }
    if (!pedido.current && !opciones) setCargando(true);
    let ops: RppOpcion[];
    try {
      ops = await cargar();
    } catch (err) {
      toast(`⚠️ ${err instanceof Error ? err.message : "No se pudo leer el inventario de REAPER."}`);
      return;
    } finally {
      setCargando(false);
    }
    if (!ops.length) {
      toast("No encuentro el .rpp de este proyecto. El script del estudio revisa cada 2 minutos.");
      olvidar();
      return;
    }
    if (ops.length === 1) {
      // Mismo enlace que un <a>: el clic de hace un instante sigue contando
      // como gesto del usuario, así que el navegador lo deja pasar a Windows.
      window.location.href = enlaceReaper(ops[0].ruta);
      olvidar();
      return;
    }
    const b = boton.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const ancho = Math.min(ANCHO, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8));
    const abajo = window.innerHeight - r.bottom;
    const haciaArriba = abajo < ALTO_TIPICO && r.top > abajo;
    setMenu({
      left, ancho,
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      destino: b.closest(".panel-light") ?? document.body,
    });
  };

  useEffect(() => {
    if (!menu) return;
    const items = () => [...(caja.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!caja.current?.contains(t) && !boton.current?.contains(t)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cerrar(); boton.current?.focus(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const xs = items();
      const i = xs.indexOf(document.activeElement as HTMLAnchorElement);
      xs[(i + (e.key === "ArrowDown" ? 1 : -1) + xs.length) % xs.length]?.focus();
    };
    // Fijo en pantalla: si la página se mueve, el menú quedaría flotando lejos del botón.
    const scroll = (e: Event) => { if (!caja.current?.contains(e.target as Node)) cerrar(); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", cerrar);
    items()[0]?.focus();
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", cerrar);
    };
    // `cerrar` sólo toca estado y un ref: volver a suscribir por él no aporta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  const varios = lista && lista.length > 1 ? ` (hay ${lista.length} .rpp)` : "";
  const icono = cargando ? <Loader2 size={14} className="animate-spin" /> : <AudioWaveform size={14} />;

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={alClic}
        onPointerEnter={() => { void cargar().catch(() => {}); }}
        aria-label="Abrir en REAPER"
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        title={`Abrir en REAPER${varios} · sólo en la compu del estudio`}
        className={variante === "icono"
          ? "hidden sm:flex items-center justify-center w-6 h-6 rounded-md text-white/35 hover:text-white hover:bg-white/8 aria-expanded:text-white aria-expanded:bg-white/8 transition-colors shrink-0 cursor-pointer"
          : "hidden sm:flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"}
      >
        {icono}
        {variante === "boton" && "Abrir"}
      </button>

      {menu && lista && createPortal(
        <div
          ref={caja}
          role="menu"
          aria-label="Elegir proyecto de REAPER"
          style={{ position: "fixed", left: menu.left, width: menu.ancho, top: menu.top, bottom: menu.bottom }}
          className="z-[90] rounded-xl border border-white/10 bg-lgb-surface shadow-2xl p-1.5 max-h-[60vh] overflow-y-auto scroll-sutil"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[11px] text-white/45 leading-snug">
            Hay {lista.length} proyectos {lista.some((o) => o.tema) ? "entre sus temas" : "en la carpeta"}.
            {" "}Te sugiero el que se guardó más recientemente.
          </p>
          {lista.map((o, i) => (
            <a
              key={o.ruta}
              role="menuitem"
              href={enlaceReaper(o.ruta)}
              title={o.ruta}
              onClick={cerrar}
              className={`block rounded-lg px-2.5 py-2 outline-none transition-colors hover:bg-white/8 focus-visible:bg-white/8 ${i === 0 ? "bg-white/[0.04]" : ""}`}
            >
              <span className="flex items-center gap-2">
                <span className="text-[13px] text-white/90 truncate">
                  {/* En un EP el .rpp suele llamarse igual que su tema: "EFÍMERO · EFÍMERO" sobra. */}
                  {o.tema && o.tema.toUpperCase() !== sinExt(o.archivo).toUpperCase() && (
                    <span className="text-white/45">{o.tema} · </span>
                  )}
                  {sinExt(o.archivo)}
                </span>
                {i === 0 && (
                  <span className="ml-auto shrink-0 text-[11px] px-1.5 py-0.5 rounded-full bg-green-400/15 text-green-300">
                    Sugerido
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-white/40 mt-0.5">
                {fecha(o.mtime)} · {haceCuanto(o.mtime)}
              </span>
            </a>
          ))}
        </div>,
        menu.destino,
      )}
    </>
  );
}
