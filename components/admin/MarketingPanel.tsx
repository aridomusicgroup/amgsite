"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Mail, Phone, Star, Clock, UserPlus, ArrowRight, Repeat, CalendarClock,
  Play, Heart, Grid3x3, ExternalLink,
} from "lucide-react";
import type { Contacto, Venta } from "@/lib/erp-data";
import { ETAPA_LABEL } from "@/lib/erp-data";

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok", beatstars: "BeatStars", facebook: "Facebook", sitio: "Sitio web",
};
const PERIODOS = [
  { k: "30", label: "30 días" }, { k: "90", label: "90 días" },
  { k: "365", label: "12 meses" }, { k: "todo", label: "Todo" },
] as const;
const VIP_MIN = 10000;
/** Etapas que siguen vivas: son las que deberían tener una próxima acción. */
const ABIERTAS = ["lead", "negociacion"];

const num = (n: number) => n.toLocaleString("es-MX");
const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const compacto = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const dias = (f: string | null) => (f ? Math.floor((Date.now() - new Date(f + "T12:00:00").getTime()) / 86400000) : null);
const hoyISO = new Date().toISOString().slice(0, 10);

export interface ResumenRecompra {
  total: number;
  tibios: number;
  ltv: number;
  primero: string | null;
}

export interface ResumenSocial {
  cuenta: string;
  seguidores: number | null;
  serie: { fecha: string; valor: number }[];
  publicaciones: number;
  reproducciones: number;
  interacciones: number;
  ultimaSync: string | null;
  top: {
    id: string;
    permalink: string | null;
    thumbnail: string | null;
    caption: string | null;
    reproducciones: number;
    interacciones: number;
    publicado: string | null;
  }[];
}

function HBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <p className="text-white/30 text-sm">Sin datos en este periodo.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/70 truncate">{r.label}</span>
            <span className="text-white/90 font-medium ml-2">{num(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-lgb-red" style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Mini gráfica de seguidores. Escala al RANGO real de la serie (no a cero):
 * pasar de 2,329 a 2,366 se vería como una raya plana si el eje arrancara en 0.
 */
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const rango = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${((max - v) / rango) * 100}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-10 mt-2">
      <polyline points={pts} fill="none" stroke="#E11D2E" strokeWidth="2.5" vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="mb-4">
        <h2 className="font-coolvetica text-lg">{title}</h2>
        {hint && <p className="text-white/30 text-xs mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className="text-white font-coolvetica text-3xl leading-none tabular-nums">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-2">{sub}</p>}
    </div>
  );
}

/** Tarjeta de trabajo pendiente: número grande + a dónde ir a resolverlo. */
function Accion({ icon, n, titulo, detalle, href, tono }: {
  icon: React.ReactNode; n: number; titulo: string; detalle: string; href: string;
  tono: "verde" | "ambar" | "neutro";
}) {
  const estilo = {
    verde: "border-green-400/25 bg-green-500/[0.06] hover:bg-green-500/[0.1] text-green-300",
    ambar: "border-amber-400/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.1] text-amber-300",
    neutro: "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/50",
  }[tono];
  return (
    <Link href={href} className={`group rounded-2xl border p-4 flex items-start gap-3 transition-colors ${estilo}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-coolvetica text-2xl leading-none text-white tabular-nums">{num(n)}</p>
        <p className="text-white/80 text-xs mt-1.5">{titulo}</p>
        <p className="text-white/35 text-[11px] mt-0.5 leading-snug">{detalle}</p>
      </div>
      <ArrowRight size={14} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity mt-1" />
    </Link>
  );
}

export function MarketingPanel({ contactos, ventas, recompra, social }: {
  contactos: Contacto[];
  ventas: Venta[];
  recompra: ResumenRecompra;
  social: ResumenSocial | null;
}) {
  const [periodo, setPeriodo] = useState("todo");

  const cutoff = useMemo(() => {
    if (periodo === "todo") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(periodo));
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const fv = useMemo(() => ventas.filter((v) => !cutoff || (v.fecha ?? "") >= cutoff), [ventas, cutoff]);
  const nuevos = useMemo(
    () => contactos.filter((c) => !cutoff || (c.created_at || "").slice(0, 10) >= cutoff),
    [contactos, cutoff],
  );

  const total = contactos.length;
  const clientes = contactos.filter((c) => c.etapa === "cliente" || c.etapa === "recurrente").length;
  const leads = contactos.filter((c) => ABIERTAS.includes(c.etapa)).length;
  const conversion = total ? Math.round((clientes / total) * 100) : 0;

  // Trabajo pendiente del CRM (no depende del periodo: es lo que toca HOY).
  const toca = contactos.filter((c) => c.proximaFecha && c.proximaFecha <= hoyISO).length;
  const sinSeguimiento = contactos.filter((c) => !c.proximaAccion && ABIERTAS.includes(c.etapa)).length;

  // Audiencia para campañas
  const conEmail = contactos.filter((c) => c.email).length;
  const conWhats = contactos.filter((c) => c.telefono).length;
  const vip = contactos.filter((c) => c.ltv >= VIP_MIN).length;
  const inactivos = contactos.filter((c) => { const d = dias(c.ultimaCompra); return d !== null && d > 90; }).length;
  const prospectos = contactos.filter((c) => !c.ultimaCompra && ABIERTAS.includes(c.etapa)).length;

  const group = (arr: { k: string | null }[], label: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const x of arr) if (x.k) m.set(x.k, (m.get(x.k) ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => ({ label: label(k), value: v })).sort((a, b) => b.value - a.value);
  };

  // OJO: el origen se calcula sobre los contactos NUEVOS del periodo (antes
  // usaba todos e ignoraba el filtro — el chip mentía).
  const porOrigen = useMemo(() => group(nuevos.map((c) => ({ k: c.origen })), (k) => CANAL_LABEL[k] ?? k), [nuevos]);
  const porEtapa = useMemo(() => group(contactos.map((c) => ({ k: c.etapa })), (k) => ETAPA_LABEL[k] ?? k), [contactos]);
  const ventasCanal = useMemo(() => group(fv.map((v) => ({ k: v.canal })), (k) => CANAL_LABEL[k] ?? k), [fv]);
  const topBeats = useMemo(() => group(fv.map((v) => ({ k: v.beat_nombre })), (k) => k).slice(0, 8), [fv]);

  // Crecimiento de seguidores en la ventana que trae la serie.
  const serie = social?.serie ?? [];
  const crecimiento = serie.length > 1 ? serie[serie.length - 1].valor - serie[0].valor : null;

  const seg = [
    { icon: Mail, label: "Con email", value: conEmail, hint: "para campañas de correo", q: "email" },
    { icon: Phone, label: "Con WhatsApp", value: conWhats, hint: "para broadcast / DM", q: "whatsapp" },
    { icon: Star, label: "VIP (mejores clientes)", value: vip, hint: "ofertas exclusivas", q: "" },
    { icon: Clock, label: "Inactivos +90 días", value: inactivos, hint: "campaña de reactivación", q: "" },
    { icon: UserPlus, label: "Prospectos sin comprar", value: prospectos, hint: "secuencia de bienvenida", q: "" },
  ];

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs transition-colors ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

  const periodoLabel = periodo === "todo" ? "todo el tiempo" : `últimos ${periodo} días`;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="font-coolvetica text-3xl">Marketing</h1>
          <p className="text-white/40 text-sm mt-1">Lo que toca hacer, cómo va el contenido y a quién le puedes hablar</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODOS.map((p) => (
            <button key={p.k} onClick={() => setPeriodo(p.k)} className={chip(periodo === p.k)}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Lo que toca hacer — arriba de todo, porque marketing aquí es una lista
          de trabajo, no un reporte. No depende del filtro de periodo. */}
      <div className="mb-6">
        <p className="text-white/40 text-[11px] uppercase tracking-wider mb-2">Qué toca hacer hoy</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Accion
            icon={<Repeat size={16} />} n={recompra.total} tono="verde"
            titulo="clientes listos para recomprar"
            detalle={
              recompra.total === 0
                ? "Nadie por ahora — vuelve a checar en unos días"
                : `${peso(recompra.ltv)} ya comprados${recompra.primero ? ` · empieza por ${recompra.primero}` : ""}`
            }
            href="/admin/clientes?foco=recompra"
          />
          <Accion
            icon={<CalendarClock size={16} />} n={toca} tono={toca > 0 ? "ambar" : "neutro"}
            titulo="seguimientos que ya tocan"
            detalle={toca === 0 ? "Todo al corriente" : "Vencidos o programados para hoy"}
            href="/admin/clientes?foco=toca"
          />
          <Accion
            icon={<UserPlus size={16} />} n={sinSeguimiento} tono="neutro"
            titulo="leads sin próxima acción"
            detalle="Escribieron y nadie definió qué sigue"
            href="/admin/clientes?foco=sin"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Kpi label="Contactos" value={num(total)} />
        <Kpi label="Nuevos" value={num(nuevos.length)} sub={periodoLabel} />
        <Kpi label="Leads activos" value={num(leads)} />
        <Kpi label="Clientes" value={num(clientes)} />
        <Kpi label="Conversión" value={`${conversion}%`} sub="clientes / contactos · histórico" />
      </div>

      {/* Contenido en Instagram: lo que publica Tozi, con números reales. */}
      {social && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-coolvetica text-lg flex items-center gap-2">
                <Grid3x3 size={17} className="text-lgb-red" /> Contenido · {social.cuenta}
              </h2>
              <p className="text-white/30 text-xs mt-0.5">
                {social.ultimaSync ? `Datos al ${social.ultimaSync}` : "Sin sincronizar todavía"} · últimas {social.publicaciones} publicaciones
              </p>
            </div>
            <Link href="/admin/analitica" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-4 py-1.5 rounded-full text-xs font-medium transition-colors">
              Ver analítica completa <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wider">Seguidores</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-coolvetica text-2xl leading-none tabular-nums">
                  {social.seguidores != null ? num(social.seguidores) : "—"}
                </span>
                {crecimiento != null && crecimiento !== 0 && (
                  <span className={`text-xs ${crecimiento > 0 ? "text-green-400" : "text-red-400"}`}>
                    {crecimiento > 0 ? "+" : ""}{num(crecimiento)}
                  </span>
                )}
              </div>
              <Sparkline data={serie.map((s) => s.valor)} />
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wider flex items-center gap-1.5"><Play size={12} /> Reproducciones</p>
              <p className="font-coolvetica text-2xl leading-none mt-1 tabular-nums">{compacto(social.reproducciones)}</p>
              <p className="text-white/30 text-[11px] mt-2">suma de las publicaciones recientes</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-white/40 text-[11px] uppercase tracking-wider flex items-center gap-1.5"><Heart size={12} /> Interacciones</p>
              <p className="font-coolvetica text-2xl leading-none mt-1 tabular-nums">{compacto(social.interacciones)}</p>
              <p className="text-white/30 text-[11px] mt-2">likes + comentarios + guardados + compartidos</p>
            </div>
          </div>

          {social.top.length > 0 && (
            <>
              <p className="text-white/40 text-[11px] uppercase tracking-wider mt-5 mb-2">Lo que mejor funcionó</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {social.top.map((p) => (
                  <a key={p.id} href={p.permalink ?? "#"} target="_blank" rel="noopener noreferrer"
                    className="group rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/20 transition-colors">
                    {p.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail} alt="" className="w-full h-28 object-cover" loading="lazy" />
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-white/85"><Play size={11} /> {compacto(p.reproducciones)}</span>
                        <span className="flex items-center gap-1 text-white/50"><Heart size={11} /> {compacto(p.interacciones)}</span>
                        <ExternalLink size={11} className="ml-auto text-white/20 group-hover:text-white/50 transition-colors" />
                      </div>
                      {p.caption && <p className="text-white/35 text-[11px] mt-1.5 line-clamp-2 leading-snug">{p.caption}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Panel title="De dónde vienen" hint={`Canal de origen de los ${num(nuevos.length)} contactos nuevos · ${periodoLabel}`}>
          <HBars rows={porOrigen} />
        </Panel>
        <Panel title="Embudo de ventas" hint="Foto de hoy: en qué etapa está cada contacto">
          <HBars rows={porEtapa} />
        </Panel>
      </div>

      {/* Audiencias para campañas */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="font-coolvetica text-lg">Tu audiencia para campañas</h2>
          <Link href="/admin/clientes" className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-red-700 transition-all">
            Segmentar y exportar <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {seg.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.label} href={s.q ? `/admin/clientes?contacto=${s.q}` : "/admin/clientes"}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-white/20 transition-colors">
                <Icon size={16} className="text-lgb-red mb-2" />
                <p className="font-coolvetica text-2xl leading-none tabular-nums">{num(s.value)}</p>
                <p className="text-white/60 text-xs mt-1">{s.label}</p>
                <p className="text-white/30 text-[11px] mt-0.5">{s.hint}</p>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Beats más vendidos" hint={periodoLabel}><HBars rows={topBeats} /></Panel>
        <Panel title="Ventas por canal" hint={periodoLabel}><HBars rows={ventasCanal} /></Panel>
      </div>
    </div>
  );
}
