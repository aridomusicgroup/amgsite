"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { money } from "@/components/admin/ui";
import type { EquipoRow, NominaRow } from "@/lib/erp-data";

const hoy = () => new Date().toISOString().slice(0, 10);
const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });

export function NominaPanel({ equipo, nomina }: { equipo: EquipoRow[]; nomina: NominaRow[] }) {
  const router = useRouter();
  const activos = equipo.filter((e) => e.activo);
  const [personaId, setPersonaId] = useState(activos[0]?.id ?? "");
  const [semana, setSemana] = useState(hoy());
  const [monto, setMonto] = useState(String(activos[0]?.pago_base ?? ""));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPersona = (id: string) => {
    setPersonaId(id);
    const p = equipo.find((e) => e.id === id);
    if (p) setMonto(String(p.pago_base || ""));
  };

  const registrar = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/nomina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: personaId, periodo_inicio: semana, monto: Number(monto) }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo registrar.");
      else router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Borrar este pago de nómina?")) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/admin/nomina?id=${id}`, { method: "DELETE" });
      if (r.ok) router.refresh();
    } finally {
      setDeleting(null);
    }
  };

  const input = "bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h2 className="font-coolvetica text-xl mb-1">Nómina</h2>
      <p className="text-white/40 text-xs mb-4">Registra los pagos de sueldo de cada semana.</p>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end mb-2">
        <div>
          <label className="block text-xs text-white/50 mb-1">Persona</label>
          <select value={personaId} onChange={(e) => onPersona(e.target.value)} className={`${input} w-full`}>
            {activos.map((e) => (
              <option key={e.id} value={e.id} className="bg-lgb-dark">
                {e.nombre} {e.rol === "socio" ? "(socio)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Semana</label>
          <input type="date" value={semana} onChange={(e) => setSemana(e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Monto</label>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="1800" className={`${input} w-28`} />
        </div>
        <button
          onClick={registrar}
          disabled={saving || !personaId || !(Number(monto) > 0)}
          className="flex items-center justify-center gap-2 bg-lgb-red text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Registrar
        </button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

      {nomina.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {nomina.slice(0, 12).map((n) => (
            <li key={n.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{n.persona}</p>
                <p className="text-white/40 text-xs">Semana {fecha(n.periodo_inicio)} · {n.tipo}</p>
              </div>
              <span className="text-sm font-medium">{money(n.monto)}</span>
              <button
                onClick={() => eliminar(n.id)}
                disabled={deleting === n.id}
                className="text-white/30 hover:text-red-400 disabled:opacity-40"
                title="Borrar"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
