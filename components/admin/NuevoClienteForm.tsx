"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { ETAPA_LABEL } from "@/lib/erp-data";
import { toast } from "@/lib/toast";

const ETAPAS = ["lead", "negociacion", "cliente", "recurrente"];
const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
const lbl = "block text-[10px] text-white/40 mb-1";
const VACIO = { nombre: "", email: "", telefono: "", direccion: "", etapa: "lead" };

/** Alta manual de un cliente desde Clientes / CRM (antes sólo nacían solos al cotizar o vender). */
export function NuevoClienteForm() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(VACIO);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const cerrar = () => { setAbierto(false); setF(VACIO); setErr(null); };

  const guardar = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/admin/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "No se pudo crear."); return; }
      cerrar();
      router.refresh();
      toast("✓ Cliente creado");
    } catch { setErr("Error de conexión."); }
    finally { setSaving(false); }
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
        className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 bg-lgb-red text-white hover:bg-red-700 transition-colors cursor-pointer">
        <UserPlus size={13} /> Nuevo cliente
      </button>
    );
  }

  return (
    <div className="w-full mb-3 rounded-xl bg-white/[0.03] border border-white/10 p-4">
      <p className="text-sm font-medium mb-3">Nuevo cliente</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Nombre completo</label>
          <input value={f.nombre} onChange={set("nombre")} className={inp} autoFocus />
        </div>
        <div>
          <label className={lbl}>Correo</label>
          <input type="email" value={f.email} onChange={set("email")} className={inp} placeholder="correo@…" />
        </div>
        <div>
          <label className={lbl}>Teléfono</label>
          <input value={f.telefono} onChange={set("telefono")} className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className={lbl}>Dirección (para contratos)</label>
          <input value={f.direccion} onChange={set("direccion")} className={inp} />
        </div>
        <div>
          <label className={lbl}>Etapa</label>
          <select value={f.etapa} onChange={set("etapa")} className={inp}>
            {ETAPAS.map((s) => <option key={s} value={s} className="bg-lgb-dark">{ETAPA_LABEL[s] ?? s}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={guardar} disabled={saving || !f.nombre.trim()}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
          {saving ? <Loader2 size={13} className="animate-spin" /> : null}
          Crear cliente
        </button>
        <button onClick={cerrar} className="text-white/40 hover:text-white text-xs px-2 py-1.5 cursor-pointer">Cancelar</button>
        {err && <p className="text-red-400 text-xs">{err}</p>}
      </div>
    </div>
  );
}
