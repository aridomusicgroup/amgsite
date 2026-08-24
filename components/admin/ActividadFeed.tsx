"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { destinoDe, DOT_ACTIVIDAD, type ItemActividad, type Modulo } from "@/lib/actividad-modulos";
import { avisarDestacar } from "@/lib/useDestacar";

/**
 * Campanita de un módulo.
 *
 * Cada módulo lleva la SUYA: Producción cuenta proyectos y tareas, Clientes
 * cuenta CRM. Antes había una sola en Producción y los movimientos del CRM
 * llegaban por push pero no aparecían en ninguna campanita — se veía como si el
 * aviso se hubiera perdido.
 *
 * El "visto" también es por módulo (`arido-actividad-visto:<modulo>`): abrir la
 * de Producción no debe apagar el contador de Clientes.
 */
export function ActividadFeed({ modulo, titulo }: { modulo: Modulo; titulo: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemActividad[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visto, setVisto] = useState<string>("");

  const vistoKey = `arido-actividad-visto:${modulo}`;

  useEffect(() => {
    try {
      setVisto(localStorage.getItem(vistoKey) || "");
    } catch { /* */ }
  }, [vistoKey]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/actividad?limit=60&modulo=${modulo}`, { cache: "no-store" });
      const d = await r.json();
      setItems(Array.isArray(d.actividad) ? d.actividad : []);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [modulo]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60_000); // refresca el contador cada minuto
    return () => clearInterval(t);
  }, [cargar]);

  const nuevos = items.filter((i) => !visto || i.created_at > visto).length;

  const abrir = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      cargar();
      // Marca todo como visto (al más nuevo de la lista)
      const top = items[0]?.created_at;
      if (top) {
        try { localStorage.setItem(vistoKey, top); } catch { /* */ }
        setVisto(top);
        // Avisa al menú (AdminNav) para que quite su puntito al instante.
        try { window.dispatchEvent(new CustomEvent("arido-actividad-visto")); } catch { /* */ }
      }
    }
  };

  /** Tocar un aviso abre EXACTAMENTE aquello de lo que habla, con resplandor. */
  const ir = (it: ItemActividad) => {
    setOpen(false);
    const href = destinoDe(it);
    router.push(href);
    // Si ya estabas en esa pantalla, Next no la vuelve a montar y el efecto que
    // lee `?destacar=` de la URL nunca correría: se avisa a mano.
    const id = new URLSearchParams(href.split("?")[1] ?? "").get("destacar");
    if (id) avisarDestacar(id);
  };

  return (
    <div className="relative">
      <button
        onClick={abrir}
        className="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
        title={titulo}
        aria-label={titulo}
      >
        <Bell size={17} className="text-white/70" />
        {nuevos > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-lgb-red text-white text-[10px] font-bold flex items-center justify-center">
            {nuevos > 9 ? "9+" : nuevos}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* backdrop para cerrar al hacer clic afuera */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(92vw,22rem)] max-h-[70vh] overflow-y-auto z-50 rounded-2xl border border-white/10 bg-lgb-surface backdrop-blur shadow-2xl">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between sticky top-0 bg-lgb-surface">
              <span className="text-sm font-medium text-white/80">{titulo}</span>
              {loading && <span className="text-[11px] text-white/30">actualizando…</span>}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-white/30 text-sm">
                {loading ? "Cargando…" : "Sin actividad todavía."}
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((it) => (
                  <li key={it.id}>
                    <button onClick={() => ir(it)}
                      className="w-full text-left px-4 py-2.5 flex gap-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer">
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${DOT_ACTIVIDAD[it.tipo] || "bg-white/40"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-white/80 leading-snug break-words">{it.titulo}</p>
                        <p className="text-[11px] text-white/35 mt-0.5">{hace(it.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function hace(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
