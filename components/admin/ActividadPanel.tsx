"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, RefreshCw } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

interface Item {
  id: string;
  tipo: string;
  titulo: string;
  entidad: string | null;
  entidad_nombre: string | null;
  actor: string | null;
  created_at: string;
}

// Módulos para filtrar (los sensibles solo se muestran al admin).
const MODULOS: { id: string; label: string; sensible?: boolean }[] = [
  { id: "", label: "Todo" },
  { id: "proyecto", label: "Proyectos" },
  { id: "tarea", label: "Tareas" },
  { id: "venta", label: "Ventas", sensible: true },
  { id: "pago", label: "Pagos", sensible: true },
  { id: "cotizacion", label: "Cotizaciones", sensible: true },
  { id: "contrato", label: "Contratos", sensible: true },
  { id: "contacto", label: "Clientes" },
  { id: "usuario", label: "Accesos", sensible: true },
];

const RANGOS = [
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
  { id: "", label: "Todo" },
];

const ENTIDAD_COLOR: Record<string, string> = {
  proyecto: "bg-lgb-red/15 text-lgb-red",
  tarea: "bg-blue-500/15 text-blue-300",
  venta: "bg-green-500/15 text-green-300",
  pago: "bg-green-500/15 text-green-300",
  cotizacion: "bg-amber-500/15 text-amber-300",
  contrato: "bg-purple-500/15 text-purple-300",
  contacto: "bg-cyan-500/15 text-cyan-300",
  usuario: "bg-white/10 text-white/60",
};

const fechaLegible = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return mismoDia ? `Hoy ${hora}` : `${d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} ${hora}`;
};

export function ActividadPanel({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modulo, setModulo] = useState("");
  const [rango, setRango] = useState("30");
  const [q, setQ] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ limit: "200" });
      if (modulo) p.set("entidad", modulo);
      if (q.trim()) p.set("q", q.trim());
      if (rango) p.set("desde", new Date(Date.now() - Number(rango) * 864e5).toISOString());
      const r = await fetch(`/api/admin/actividad?${p}`, { cache: "no-store" });
      const d = await r.json();
      setItems(Array.isArray(d.actividad) ? d.actividad : []);
    } catch {
      setItems([]);
    } finally {
      setCargando(false);
    }
  }, [modulo, rango, q]);

  // Recarga al cambiar filtros (con pequeño debounce para el buscador).
  useEffect(() => {
    const t = setTimeout(() => { void cargar(); }, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  // Tiempo real: si alguien hace algo, aparece solo.
  useRealtimeRefresh("rt-actividad", ["actividad"]);

  const modulos = MODULOS.filter((m) => isAdmin || !m.sensible);
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la bitácora…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red" />
        </div>
        <button onClick={() => void cargar()} title="Actualizar" className="p-2 rounded-lg bg-white/5 text-white/50 hover:text-white cursor-pointer">
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {modulos.map((m) => (
          <button key={m.id} onClick={() => setModulo(m.id)} className={chip(modulo === m.id)}>{m.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        <span className="text-white/25 text-[11px] mr-1">Periodo:</span>
        {RANGOS.map((r) => (
          <button key={r.id} onClick={() => setRango(r.id)} className={chip(rango === r.id)}>{r.label}</button>
        ))}
      </div>

      {/* Timeline */}
      {cargando && items.length === 0 ? (
        <p className="text-white/40 text-sm flex items-center gap-2 py-8"><Loader2 size={15} className="animate-spin" /> Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-12">Sin movimientos con estos filtros.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
              <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] ${ENTIDAD_COLOR[a.entidad ?? ""] ?? "bg-white/5 text-white/40"}`}>
                {MODULOS.find((m) => m.id === a.entidad)?.label ?? "Panel"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/85 leading-snug">{a.titulo}</p>
                <p className="text-white/30 text-[11px] mt-0.5">
                  {fechaLegible(a.created_at)}
                  {a.entidad_nombre ? ` · ${a.entidad_nombre}` : ""}
                  {a.actor ? ` · ${a.actor}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-white/25 text-[11px] mt-5">
        La bitácora conserva los últimos 6 meses. {isAdmin ? "Como admin ves todos los módulos, incluido dinero y accesos." : "Los movimientos de dinero y accesos solo los ve un admin."}
      </p>
    </div>
  );
}
