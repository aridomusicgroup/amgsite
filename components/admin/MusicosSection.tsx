"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "@/lib/toast";

interface Musico {
  id: string;
  nombre: string;
  instrumentos: string[];
  tarifa: number;
  telefono: string | null;
  activo: boolean;
  nota: string | null;
}

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * Catálogo de músicos de sesión (proveedores): quién toca qué. Alimenta la
 * sugerencia automática de "Pagos a músicos" por los instrumentos de cada venta.
 * Solo admin.
 */
export function MusicosSection() {
  const [musicos, setMusicos] = useState<Musico[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", instrumentos: "", tarifa: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [ef, setEf] = useState({ nombre: "", instrumentos: "", tarifa: "" });

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

  const cargar = async () => {
    try {
      const r = await fetch("/api/admin/musicos");
      const d = await r.json();
      setMusicos(r.ok ? (d.musicos ?? []) : []);
    } catch { setMusicos([]); }
  };
  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!nuevo.nombre.trim()) { toast("Pon el nombre"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/musicos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudo guardar"); return; }
      setNuevo({ nombre: "", instrumentos: "", tarifa: "" });
      await cargar();
      toast("✓ Músico agregado");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const abrirEdit = (m: Musico) => {
    setEditId(m.id);
    setEf({ nombre: m.nombre, instrumentos: m.instrumentos.join(", "), tarifa: String(m.tarifa || "") });
  };
  const guardarEdit = async (id: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/musicos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...ef }),
      });
      if (r.ok) { setEditId(null); await cargar(); toast("✓ Guardado"); }
      else { const d = await r.json(); toast(d.error || "No se pudo guardar"); }
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const borrar = async (id: string) => {
    try {
      const r = await fetch("/api/admin/musicos", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) { await cargar(); toast("✓ Eliminado"); }
    } catch { toast("Error de red"); }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h2 className="font-coolvetica text-lg">Músicos (proveedores)</h2>
      <p className="text-white/40 text-xs mt-0.5 mb-3">
        Quién toca qué instrumento. Se usa para sugerir a quién pagar según los instrumentos de cada venta.
      </p>

      {musicos === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {musicos.map((m) => (
            <li key={m.id} className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
              {editId === m.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <input value={ef.nombre} onChange={(e) => setEf((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nombre" className={`${inp} w-32`} />
                  <input value={ef.instrumentos} onChange={(e) => setEf((s) => ({ ...s, instrumentos: e.target.value }))} placeholder="tololoche, bajo" className={`${inp} flex-1 min-w-[140px]`} />
                  <input type="number" step="any" value={ef.tarifa} onChange={(e) => setEf((s) => ({ ...s, tarifa: e.target.value }))} placeholder="Tarifa" className={`${inp} w-24`} />
                  <button onClick={() => guardarEdit(m.id)} disabled={busy} className="flex items-center gap-1 bg-lgb-red text-white px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
                  </button>
                  <button onClick={() => setEditId(null)} className="text-white/40 hover:text-white p-1"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{m.nombre}</span>
                  <span className="flex gap-1 flex-wrap">
                    {m.instrumentos.length ? m.instrumentos.map((i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-lgb-red/15 text-red-200">{i}</span>
                    )) : <span className="text-white/30 text-xs">sin instrumentos</span>}
                  </span>
                  {m.tarifa > 0 && <span className="text-white/40 text-xs">· {peso(m.tarifa)}</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => abrirEdit(m)} className="text-white/30 hover:text-white p-1" title="Editar"><Pencil size={13} /></button>
                    <button onClick={() => borrar(m.id)} className="text-white/25 hover:text-red-300 p-1" title="Eliminar"><Trash2 size={13} /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {musicos.length === 0 && <li className="text-white/30 text-xs">Aún no hay músicos. Agrega el primero abajo. 🎸</li>}
        </ul>
      )}

      {/* Alta */}
      <div className="flex flex-wrap items-end gap-2 border-t border-white/8 pt-3">
        <input value={nuevo.nombre} onChange={(e) => setNuevo((s) => ({ ...s, nombre: e.target.value }))} placeholder="Nombre (ej. Anel Rocha)" className={`${inp} w-40`} />
        <input value={nuevo.instrumentos} onChange={(e) => setNuevo((s) => ({ ...s, instrumentos: e.target.value }))} placeholder="Instrumentos: tololoche, bajo" className={`${inp} flex-1 min-w-[160px]`} />
        <input type="number" step="any" value={nuevo.tarifa} onChange={(e) => setNuevo((s) => ({ ...s, tarifa: e.target.value }))} placeholder="Tarifa (opcional)" className={`${inp} w-32`} />
        <button onClick={agregar} disabled={busy} className="flex items-center gap-1 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
        </button>
      </div>
      <p className="text-white/25 text-[10px] mt-1.5">Separa varios instrumentos con coma. Ej. Anel Rocha → tololoche, bajo.</p>
    </div>
  );
}
