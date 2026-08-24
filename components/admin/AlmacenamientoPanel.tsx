"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, HardDrive, Pencil, X } from "lucide-react";
import type { AlmacenamientoTipoRow, ProyectoAlmacenamientoRow } from "@/lib/almacenamiento-data";
import { formatoMb } from "@/lib/almacenamiento";
import { toast } from "@/lib/toast";

const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-24";

function TipoRow({ row }: { row: AlmacenamientoTipoRow }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(row.limiteMb));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const guardar = async () => {
    const n = Number(valor);
    if (!(n > 0)) { setErr("Debe ser mayor a 0."); return; }
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/admin/almacenamiento-tipos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: row.tipo, limite_mb: n }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "No se pudo guardar.");
      else { setEditando(false); router.refresh(); toast("✓ Guardado"); }
    } catch { setErr("Error de conexión."); }
    finally { setSaving(false); }
  };

  return (
    <li className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5">
      <span className="flex-1 text-sm">{row.label}</span>
      {editando ? (
        <>
          <input
            type="number" min={1} value={valor} autoFocus
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            className={inp}
          />
          <span className="text-white/40 text-xs">MB</span>
          <button onClick={guardar} disabled={saving} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Guardar"}
          </button>
          <button onClick={() => { setEditando(false); setValor(String(row.limiteMb)); setErr(null); }} className="text-white/40 hover:text-white p-1">
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-white/80">{formatoMb(row.limiteMb)}</span>
          <button onClick={() => setEditando(true)} className="text-white/30 hover:text-white p-1" title="Editar">
            <Pencil size={13} />
          </button>
        </>
      )}
      {err && <p className="text-red-400 text-xs w-full">{err}</p>}
    </li>
  );
}

function ProyectoRow({ row }: { row: ProyectoAlmacenamientoRow }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(row.overrideMb ? String(row.overrideMb) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const guardar = async (limpiar: boolean) => {
    const n = limpiar ? null : Number(valor);
    if (!limpiar && !(n! > 0)) { setErr("Debe ser mayor a 0."); return; }
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/admin/proyectos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, limite_almacenamiento_mb: n }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "No se pudo guardar.");
      else { setEditando(false); router.refresh(); toast(limpiar ? "✓ Se quitó el override" : "✓ Guardado"); }
    } catch { setErr("Error de conexión."); }
    finally { setSaving(false); }
  };

  return (
    <li className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-2.5 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{row.titulo}</p>
        <p className="text-white/40 text-xs mt-0.5">
          {row.folio ? `${row.folio} · ` : ""}{row.cliente || "sin cliente"}
        </p>
      </div>
      {editando ? (
        <>
          <input
            type="number" min={1} placeholder="MB" value={valor} autoFocus
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar(false)}
            className={inp}
          />
          <button onClick={() => guardar(false)} disabled={saving} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Guardar"}
          </button>
          {row.overrideMb != null && (
            <button onClick={() => guardar(true)} disabled={saving} className="text-white/40 hover:text-white text-xs px-2 py-1.5">
              Quitar override
            </button>
          )}
          <button onClick={() => { setEditando(false); setErr(null); }} className="text-white/40 hover:text-white p-1"><X size={14} /></button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-white/80">{formatoMb(row.limiteMb)}</span>
          {row.overrideMb != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">override</span>}
          <button onClick={() => setEditando(true)} className="text-white/30 hover:text-white p-1" title="Editar límite">
            <Pencil size={13} />
          </button>
        </>
      )}
      {err && <p className="text-red-400 text-xs w-full">{err}</p>}
    </li>
  );
}

export function AlmacenamientoPanel({ tipos, proyectos }: { tipos: AlmacenamientoTipoRow[]; proyectos: ProyectoAlmacenamientoRow[] }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="flex items-center gap-2 font-coolvetica text-lg mb-1">
          <HardDrive size={17} className="text-lgb-red" /> Límites por defecto
        </h2>
        <p className="text-white/40 text-sm mb-3">
          Cuánto puede subir cada cliente según el tipo de producción — un beat personalizado solo sube una maqueta, una grabación o mezcla necesita mucho más espacio.
        </p>
        <ul className="space-y-1.5">
          {tipos.map((t) => <TipoRow key={t.tipo} row={t} />)}
        </ul>
      </section>

      <section>
        <h2 className="font-coolvetica text-lg mb-1">Proyectos activos ({proyectos.length})</h2>
        <p className="text-white/40 text-sm mb-3">
          Cada uno usa el default de su tipo salvo que le pongas un límite manual (para el cliente que necesita más espacio).
        </p>
        {proyectos.length === 0 ? (
          <p className="text-white/30 text-sm">No hay proyectos activos ahora mismo.</p>
        ) : (
          <ul className="space-y-1.5">
            {proyectos.map((p) => <ProyectoRow key={p.id} row={p} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
