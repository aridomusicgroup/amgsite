"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, TriangleAlert, X } from "lucide-react";
import { toast } from "@/lib/toast";
import type { ServicioDiseno } from "@/lib/diseno";

const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;
const GRUPO: Record<string, string> = { paquete: "Paquetes", servicio: "Servicios", adicional: "Adicionales" };

/** Cuánto le queda a ARIDO, en % del precio. */
const margen = (s: ServicioDiseno) => (s.precio > 0 ? Math.round(((s.precio - s.costo) / s.precio) * 100) : 0);

const lineas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

interface Estado {
  nombreEs: string; nombreEn: string; precio: string; costo: string;
  incluyeEs: string; incluyeEn: string; desde: boolean; destacado: boolean; activo: boolean;
}

function Editar({ item, onClose, onSaved }: { item: ServicioDiseno; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Estado>({
    nombreEs: item.nombre.es, nombreEn: item.nombre.en, precio: String(item.precio), costo: String(item.costo),
    incluyeEs: item.incluye.es.join("\n"), incluyeEn: item.incluye.en.join("\n"),
    desde: !!item.desde, destacado: !!item.destacado, activo: item.activo !== false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<Estado>) => setF((x) => ({ ...x, ...p }));

  const precio = Number(f.precio) || 0;
  const costo = Number(f.costo) || 0;
  const queda = precio - costo;

  const guardar = async () => {
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/servicios/diseno", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id, precio: Number(f.precio), costo: Number(f.costo), activo: f.activo,
          nombre: { es: f.nombreEs, en: f.nombreEn },
          incluye: { es: lineas(f.incluyeEs), en: lineas(f.incluyeEn) },
          desde: f.desde, destacado: f.destacado,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "No se pudo guardar."); return; }
      toast("✓ Guardado — ya se ve en /diseno");
      onSaved();
    } catch {
      setErr("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const num = (k: "precio" | "costo", label: string) => (
    <label className="block">
      <span className="text-white/60 text-xs">{label}</span>
      <input inputMode="numeric" value={f[k]} onChange={(e) => set({ [k]: e.target.value.replace(/[^\d]/g, "") })} className="input mt-1" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-lgb-dark border border-white/10 rounded-2xl p-5 w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-coolvetica text-xl">Editar diseño</h2>
          <button aria-label="Cerrar" onClick={onClose} className="text-white/40 hover:text-white cursor-pointer"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {num("precio", "Precio al cliente (MXN)")}
          {num("costo", "Costo del diseñador (MXN)")}
        </div>
        <p className={`text-xs mt-2 ${queda < 0 ? "text-red-400" : "text-white/50"}`}>
          {queda < 0
            ? "El costo es mayor que el precio: no se puede guardar."
            : `Le queda a ARIDO ${pesos(queda)} (${precio ? Math.round((queda / precio) * 100) : 0}% del precio).`}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <label className="block"><span className="text-white/60 text-xs">Nombre (español)</span><input value={f.nombreEs} onChange={(e) => set({ nombreEs: e.target.value })} className="input mt-1" /></label>
          <label className="block"><span className="text-white/60 text-xs">Nombre (inglés)</span><input value={f.nombreEn} onChange={(e) => set({ nombreEn: e.target.value })} className="input mt-1" /></label>
          <label className="block"><span className="text-white/60 text-xs">Qué incluye, español (uno por línea)</span><textarea rows={5} value={f.incluyeEs} onChange={(e) => set({ incluyeEs: e.target.value })} className="input mt-1" /></label>
          <label className="block"><span className="text-white/60 text-xs">Qué incluye, inglés (mismo orden)</span><textarea rows={5} value={f.incluyeEn} onChange={(e) => set({ incluyeEn: e.target.value })} className="input mt-1" /></label>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.desde} onChange={(e) => set({ desde: e.target.checked })} />Precio “desde”</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.destacado} onChange={(e) => set({ destacado: e.target.checked })} />Destacado en la landing</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.activo} onChange={(e) => set({ activo: e.target.checked })} />Visible</label>
        </div>

        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={guardar} disabled={saving || queda < 0} className="flex-1 bg-lgb-red text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white bg-white/5 cursor-pointer">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/** Pestaña "Diseño" de /admin/servicios. Sólo la ve un admin: trae el costo del diseñador. */
export function DisenoAdmin({ catalogo, enBase }: { catalogo: ServicioDiseno[]; enBase: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<ServicioDiseno | null>(null);
  const [busy, setBusy] = useState(false);

  const llamar = async (method: string, body: unknown, ok: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/servicios/diseno", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return; }
      toast(ok);
      router.refresh();
    } catch {
      toast("Error de red");
    } finally {
      setBusy(false);
    }
  };

  const alternar = (s: ServicioDiseno) =>
    llamar("PUT", {
      id: s.id, precio: s.precio, costo: s.costo, nombre: s.nombre, incluye: s.incluye,
      desde: !!s.desde, destacado: !!s.destacado, activo: s.activo === false,
    }, s.activo === false ? "✓ Visible otra vez" : "✓ Oculto de la landing y de las cotizaciones");

  return (
    <div>
      {!enBase && (
        <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
          <p className="flex items-center gap-2 text-amber-300 font-medium"><TriangleAlert size={16} /> El catálogo de diseño todavía se lee del archivo</p>
          <p className="text-white/60 text-xs mt-1">
            Corre <b className="text-white/80">supabase-diseno-catalogo.sql</b> en Supabase para poder editarlo aquí. Si ya lo corriste y la tabla quedó vacía:
          </p>
          <button disabled={busy} onClick={() => llamar("POST", { accion: "sembrar" }, "✓ Catálogo cargado")} className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 cursor-pointer disabled:opacity-50">
            Cargar el catálogo actual
          </button>
        </div>
      )}

      <p className="text-white/40 text-xs mb-4">
        Precio al cliente y lo que se le paga al diseñador (de ahí sale el margen). El costo sólo lo ves tú: nunca aparece en el sitio.
      </p>

      {(["paquete", "servicio", "adicional"] as const).map((g) => {
        const filas = catalogo.filter((s) => s.grupo === g);
        if (!filas.length) return null;
        return (
          <div key={g} className="mb-5">
            <p className="text-white/50 text-[11px] uppercase tracking-wider mb-2">{GRUPO[g]}</p>
            <div className="flex flex-col gap-2">
              {filas.map((s) => (
                <div key={s.id} className={`flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 sm:p-4 ${s.activo === false ? "opacity-55" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      {s.nombre.es}
                      {s.activo === false && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">Oculto</span>}
                      {s.destacado && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">Destacado</span>}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">Costo {pesos(s.costo)} · margen {margen(s)}%</p>
                  </div>
                  <p className="font-coolvetica text-lg shrink-0">{s.desde ? "desde " : ""}{pesos(s.precio)}</p>
                  <div className="flex shrink-0">
                    <button title={s.activo === false ? "Mostrar" : "Ocultar"} disabled={busy} onClick={() => alternar(s)} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40">
                      {s.activo === false ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button title="Editar" disabled={!enBase} onClick={() => setEditando(s)} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40">
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {editando && <Editar item={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); router.refresh(); }} />}
    </div>
  );
}
