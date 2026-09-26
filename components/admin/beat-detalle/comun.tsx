"use client";
import type { ReactNode } from "react";

export { inp, lblS } from "@/components/admin/tareas/estilos";

/**
 * Guarda cambios de la ficha. Devuelve el mensaje de error, o null si salió bien.
 * Quien llama decide si refresca la página (router.refresh) y qué toast mostrar.
 */
export async function guardarFicha(id: string, cambios: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch(`/api/admin/beats/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return d.error || "No se pudo guardar.";
  } catch {
    return "Error de conexión.";
  }
}

/** Bloque con título y explicación corta: cada pestaña se arma con estos. */
export function Seccion({ titulo, nota, children, derecha }: {
  titulo: string; nota?: ReactNode; children: ReactNode; derecha?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-white/85">{titulo}</h2>
          {nota && <p className="text-white/40 text-[12px] leading-relaxed mt-0.5">{nota}</p>}
        </div>
        {derecha}
      </div>
      {children}
    </section>
  );
}

export type Tono = "ok" | "alerta" | "grave" | "neutro" | "info";

const TONO: Record<Tono, string> = {
  ok: "bg-green-500/12 text-green-300 border-green-500/25",
  alerta: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  grave: "bg-red-500/12 text-red-300 border-red-500/25",
  neutro: "bg-white/5 text-white/55 border-white/10",
  info: "bg-blue-500/12 text-blue-300 border-blue-500/25",
};

/** Estado como píldora con fondo (nunca texto suelto de 10px). */
export function Pastilla({ tono = "neutro", children, title }: { tono?: Tono; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${TONO[tono]}`}>
      {children}
    </span>
  );
}

/** Interruptor accesible (role=switch) para Visible / Destacado. */
export function Interruptor({ activo, onCambio, etiqueta, detalle, deshabilitado }: {
  activo: boolean; onCambio: (v: boolean) => void; etiqueta: string; detalle?: string; deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => onCambio(!activo)}
      className="w-full flex items-center gap-3 text-left py-2 disabled:opacity-50 cursor-pointer group focus-visible:outline-none"
    >
      <span className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${activo ? "bg-green-500/70" : "bg-white/12"}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-4" : ""}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-white/85 group-focus-visible:underline">{etiqueta}</span>
        {detalle && <span className="block text-[12px] text-white/40 leading-snug">{detalle}</span>}
      </span>
    </button>
  );
}

/** "hace 3 días" / fecha corta, para no poner timestamps crudos. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
