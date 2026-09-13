"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, CalendarCheck, X } from "lucide-react";
import { money } from "@/components/admin/ui";
import type { EquipoRow, NominaRow } from "@/lib/erp-data";

/** Sueldo que les toca a los socios esta semana, según las bolsas. */
export interface SueldoSocio { semanal: number; promedio: number; meses: string[] }

const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => local(new Date());
const lunes = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return local(d); };
const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
const mesCorto = (m: string) => new Date(m + "-15T12:00:00").toLocaleDateString("es-MX", { month: "short" });

interface Renglon { id: string; nombre: string; socio: boolean; monto: string; incluir: boolean; yaRegistrado: boolean }

export function NominaPanel({ equipo, nomina, sueldoSocio }: { equipo: EquipoRow[]; nomina: NominaRow[]; sueldoSocio: SueldoSocio }) {
  const router = useRouter();
  const activos = equipo.filter((e) => e.activo);
  const montoDe = (e: EquipoRow) => (e.rol === "socio" ? sueldoSocio.semanal : e.pago_base);
  const [personaId, setPersonaId] = useState(activos[0]?.id ?? "");
  const [semana, setSemana] = useState(hoy());
  const [monto, setMonto] = useState(String(activos[0] ? montoDe(activos[0]) : ""));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lote, setLote] = useState<Renglon[] | null>(null);
  const [semanaLote, setSemanaLote] = useState(lunes());

  const onPersona = (id: string) => {
    setPersonaId(id);
    const p = equipo.find((e) => e.id === id);
    if (p) setMonto(String(montoDe(p) || ""));
  };

  const armarLote = (sem: string) =>
    activos.map((e) => {
      const m = montoDe(e);
      const ya = nomina.some((n) => n.persona === e.nombre && n.periodo_inicio === sem);
      return { id: e.id, nombre: e.nombre, socio: e.rol === "socio", monto: String(m || ""), incluir: m > 0 && !ya, yaRegistrado: ya };
    });

  const abrirLote = () => { setError(null); setLote(armarLote(semanaLote)); };
  const cambiarSemanaLote = (sem: string) => { setSemanaLote(sem); setLote(armarLote(sem)); };

  const post = (persona_id: string, periodo_inicio: string, m: number) =>
    fetch("/api/admin/nomina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id, periodo_inicio, monto: m }),
    });

  const registrar = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await post(personaId, semana, Number(monto));
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo registrar.");
      else router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const registrarLote = async () => {
    if (!lote) return;
    const elegidos = lote.filter((r) => r.incluir && Number(r.monto) > 0);
    setSaving(true);
    setError(null);
    const fallidos: string[] = [];
    for (const r of elegidos) {
      try {
        const res = await post(r.id, semanaLote, Number(r.monto));
        if (!res.ok) fallidos.push(r.nombre);
      } catch {
        fallidos.push(r.nombre);
      }
    }
    setSaving(false);
    if (fallidos.length) setError(`No se registró: ${fallidos.join(", ")}.`);
    else setLote(null);
    router.refresh();
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
  const elegidos = lote?.filter((r) => r.incluir && Number(r.monto) > 0) ?? [];
  const totalLote = elegidos.reduce((a, r) => a + Number(r.monto), 0);
  const razon = sueldoSocio.meses.length
    ? `el promedio cobrado de ${mesCorto(sueldoSocio.meses[0])}–${mesCorto(sueldoSocio.meses[sueldoSocio.meses.length - 1])} fue ${money(sueldoSocio.promedio)}`
    : "todavía no hay 3 meses cobrados";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-coolvetica text-xl mb-1">Nómina</h2>
          <p className="text-white/40 text-xs">Registra los pagos de sueldo de cada semana.</p>
        </div>
        {!lote && (
          <button onClick={abrirLote} className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white border border-white/10 hover:border-white/25 rounded-xl px-3 py-2 shrink-0">
            <CalendarCheck size={14} /> Registrar la semana
          </button>
        )}
      </div>

      {lote && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-white/60">
              Semana del
              <input type="date" value={semanaLote} onChange={(e) => cambiarSemanaLote(e.target.value)} className={`${input} py-1.5`} />
            </label>
            <button onClick={() => setLote(null)} className="text-white/40 hover:text-white p-1" aria-label="Cerrar"><X size={16} /></button>
          </div>
          <p className="text-white/50 text-xs mb-3">
            Socios: {money(sueldoSocio.semanal)} por semana cada uno, porque {razon}.
          </p>
          <ul className="space-y-1.5">
            {lote.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={r.incluir}
                  onChange={(e) => setLote((l) => l && l.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))}
                  className="accent-lgb-red"
                  aria-label={`Incluir a ${r.nombre}`}
                />
                <span className="flex-1 min-w-0 text-sm truncate">
                  {r.nombre} {r.socio && <span className="text-white/40">(socio)</span>}
                  {r.yaRegistrado && <span className="text-amber-300/80 text-xs"> · ya registrado esa semana</span>}
                </span>
                <input
                  type="number"
                  value={r.monto}
                  onChange={(e) => setLote((l) => l && l.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
                  className={`${input} w-28 py-1.5`}
                />
              </li>
            ))}
          </ul>
          <button
            onClick={registrarLote}
            disabled={saving || elegidos.length === 0}
            className="mt-3 flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Registrar {elegidos.length} pago{elegidos.length === 1 ? "" : "s"} · {money(totalLote)}
          </button>
        </div>
      )}

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
