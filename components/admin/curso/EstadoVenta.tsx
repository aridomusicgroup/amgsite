"use client";
import { useState } from "react";
import { Rocket, Loader2 } from "lucide-react";
import type { CursoDetalle } from "@/lib/cursos-admin";
import { pesos } from "@/lib/cursos-tipos";
import { toast } from "@/lib/toast";
import { api, errorDe } from "./api";

type Estado = "oculto" | "preventa" | "venta";

const OPCIONES: { id: Estado; label: string; activo: string }[] = [
  { id: "oculto", label: "Oculto", activo: "bg-white/15 text-white" },
  { id: "preventa", label: "Preventa", activo: "bg-amber-500/20 text-amber-300" },
  { id: "venta", label: "A la venta", activo: "bg-green-500/15 text-green-400" },
];

/**
 * Oculto · Preventa · A la venta. Pasar de preventa a la venta es el
 * lanzamiento: abre las lecciones a los fundadores, el precio vuelve al
 * normal y (si se elige) les llega el correo de “ya abrió”.
 */
export function EstadoVenta({ curso, onSaved }: { curso: CursoDetalle; onSaved: () => void }) {
  const actual: Estado = !curso.activo ? "oculto" : curso.config.preventa.activa ? "preventa" : "venta";
  const [lanzando, setLanzando] = useState(false);
  const [busy, setBusy] = useState(false);
  const publicadas = curso.modulos.flatMap((m) => m.lecciones).filter((l) => l.publicada).length;
  const listaSinComprar = curso.avisame.filter((e) => !curso.accesos.some((a) => a.email.toLowerCase() === e)).length;

  const cambiar = async (estado: Estado, avisar = false) => {
    setBusy(true);
    try {
      const r = await api<{ avisados: { fundadores: number; lista: number } | null }>("/api/admin/cursos", "PATCH", { id: curso.id, estado, avisar });
      if (r.avisados) toast(`Lanzado · correo a ${r.avisados.fundadores} alumnos y ${r.avisados.lista} de la lista`);
      setLanzando(false);
      onSaved();
    } catch (e) {
      toast(errorDe(e));
    } finally {
      setBusy(false);
    }
  };

  const elegir = (estado: Estado) => {
    if (estado === actual || busy) return;
    // Lanzar (desde preventa, aunque esté oculto) pide confirmación con aviso.
    if (estado === "venta" && curso.config.preventa.activa) return setLanzando(true);
    if (estado === "preventa" && !curso.config.preventa.activa && curso.accesos.length > 0
      && !confirm("Los alumnos que ya tienen acceso dejarán de ver las lecciones hasta que lo vuelvas a lanzar. ¿Seguro?")) return;
    cambiar(estado);
  };

  return (
    <>
      <div role="radiogroup" aria-label="Estado de venta" className="inline-flex rounded-full bg-white/8 p-0.5">
        {OPCIONES.map((o) => (
          <button key={o.id} role="radio" aria-checked={actual === o.id} onClick={() => elegir(o.id)} disabled={busy}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:cursor-wait ${actual === o.id ? o.activo : "text-white/50 hover:text-white"}`}>
            {o.label}
          </button>
        ))}
      </div>

      {lanzando && (
        <div className="basis-full rounded-xl border border-white/10 bg-white/[0.03] p-4 mt-1">
          <p className="flex items-center gap-2 text-sm font-medium"><Rocket size={15} /> Lanzar el curso</p>
          <ul className="mt-2 text-xs text-white/60 flex flex-col gap-1 list-disc pl-4">
            <li>Se abren las {publicadas} lecciones publicadas a los {curso.fundadores} fundadores{curso.accesos.length > curso.fundadores ? ` y ${curso.accesos.length - curso.fundadores} accesos dados a mano` : ""}.</li>
            <li>{curso.precioMxn ? `El precio pasa a ${pesos(curso.precioMxn)} MXN.` : "No tiene precio regular: la página va a mandar a WhatsApp."}</li>
            {publicadas === 0 && <li className="text-amber-300">Todavía no hay ninguna lección publicada.</li>}
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => cambiar("venta", true)} disabled={busy}
              className="inline-flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50 cursor-pointer">
              {busy && <Loader2 size={13} className="animate-spin" />} Lanzar y avisar ({curso.accesos.length} alumnos + {listaSinComprar} de la lista)
            </button>
            <button onClick={() => cambiar("venta", false)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs bg-white/8 text-white/70 hover:text-white disabled:opacity-50 cursor-pointer">
              Lanzar sin avisar
            </button>
            <button onClick={() => setLanzando(false)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
