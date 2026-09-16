"use client";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import type { ResumenOrigenes } from "@/lib/origenes-data";
import { CANALES_ENLACE, ORIGEN_LABEL } from "@/lib/origenes";
import { TIPOS_REEL, TIPO_REEL_LABEL } from "@/lib/tipo-reel";
import { toast } from "@/lib/toast";

const nf = new Intl.NumberFormat("es-MX");
const mxn = (n: number) => `$${nf.format(Math.round(n))}`;
const nombreMes = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
const etiqueta = (o: string) => (o === "sin_origen" ? "Sin origen" : ORIGEN_LABEL[o] ?? o);

interface ReelTipo { id: string; caption: string; publicado_at: string | null; reproducciones: number; tipo: string | null; tipoManual: boolean }

/**
 * De dónde llegan los clientes. Tres números arriba (lo que se revisa cada mes),
 * luego el detalle por canal, qué tipo de reel rinde y los enlaces de las bios.
 */
export function OrigenesPanel({ data, isAdmin }: { data: ResumenOrigenes; isAdmin: boolean }) {
  const [idxMes, setIdxMes] = useState(data.meses.length - 1);
  const mes = data.meses[idxMes];
  const previo = data.meses[idxMes - 1];
  const nuevosIg = mes.filas.find((f) => f.origen === "instagram")?.nuevos ?? 0;
  const nuevosIgPrevio = previo?.filas.find((f) => f.origen === "instagram")?.nuevos ?? null;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-coolvetica text-2xl">De dónde llegan los clientes</h2>
          <p className="text-white/40 text-sm mt-0.5">Cómo llegó cada cliente, no por dónde se cerró la venta.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white/[0.04] p-1" role="tablist" aria-label="Mes">
          {data.meses.map((m, i) => (
            <button key={m.mes} role="tab" aria-selected={i === idxMes} onClick={() => setIdxMes(i)}
              className={`px-3 py-1 rounded-full text-xs capitalize ${i === idxMes ? "bg-white/15 text-white" : "text-white/45 hover:text-white/80"}`}>
              {nombreMes(m.mes)}
            </button>
          ))}
        </div>
      </div>

      {!data.completo && (
        <p className="text-xs text-amber-300/80 bg-amber-400/5 border border-amber-400/15 rounded-xl px-3 py-2">
          Falta correr <code>supabase-origen-clientes.sql</code>: sin él no se ven los reels que trajeron clientes ni los clics de las bios.
        </p>
      )}

      {/* Los 3 números */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Numero titulo="Reproducciones del reel típico" valor={nf.format(mes.medianaReel)}
          nota={mes.reels ? `mediana de ${mes.reels} publicaciones del mes` : "sin publicaciones este mes"}
          delta={previo && previo.reels ? mes.medianaReel - previo.medianaReel : null} />
        <Numero titulo="Clientes nuevos desde Instagram" valor={nf.format(nuevosIg)}
          nota="contactos que entraron este mes"
          delta={nuevosIgPrevio != null ? nuevosIg - nuevosIgPrevio : null} />
        <Numero titulo="De Instagram, cuántos compran" valor={`${data.conversionIg.pct}%`}
          nota={`${data.conversionIg.compradores} de ${data.conversionIg.contactos} · últimos 90 días`} delta={null} />
      </div>

      {/* Por origen */}
      <div className="rounded-2xl border border-white/8 overflow-x-auto">
        <table className="w-full text-sm tabular-nums min-w-[520px]">
          <thead>
            <tr className="text-[11px] text-white/45 text-left">
              <th className="font-medium px-4 py-2.5">Origen</th>
              <th className="font-medium px-3 py-2.5 text-right">Nuevos</th>
              <th className="font-medium px-3 py-2.5 text-right">Ya compraron</th>
              <th className="font-medium px-3 py-2.5 text-right">Ventas del mes</th>
              {isAdmin && <th className="font-medium px-3 py-2.5 text-right">Monto</th>}
              <th className="font-medium px-4 py-2.5 text-right" title="Clics en el enlace de la bio">Clics bio</th>
            </tr>
          </thead>
          <tbody>
            {mes.filas.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-white/35">Sin movimiento este mes.</td></tr>
            )}
            {mes.filas.map((f) => (
              <tr key={f.origen} className={`border-t border-white/5 ${f.origen === "sin_origen" ? "text-amber-200/80" : ""}`}>
                <td className="px-4 py-2">{etiqueta(f.origen)}</td>
                <td className="px-3 py-2 text-right">{f.nuevos || "—"}</td>
                <td className="px-3 py-2 text-right">
                  {f.nuevos ? <>{f.compradores} <span className="text-white/35 text-xs">({Math.round((f.compradores / f.nuevos) * 100)}%)</span></> : "—"}
                </td>
                <td className="px-3 py-2 text-right">{f.ventas || "—"}</td>
                {isAdmin && <td className="px-3 py-2 text-right">{f.ventasMxn ? mxn(f.ventasMxn) : "—"}</td>}
                <td className="px-4 py-2 text-right">{f.clics || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.sinOrigen.clientes > 0 && (
        <p className="flex items-start gap-2 text-sm text-amber-200/80">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            {data.sinOrigen.clientes} clientes que ya compraron no tienen origen
            {isAdmin && <> ({mxn(data.sinOrigen.ventasMxn)} en ventas)</>}. Llénalo en Clientes → editar
            (filtro &quot;Sin origen&quot;); mientras más se llene, más confiable es esta tabla.
          </span>
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <TiposReel tipos={data.tipos} />
        <ReelsConClientes reels={data.reelsConClientes} isAdmin={isAdmin} />
      </div>

      <EnlacesBio />
    </section>
  );
}

function Numero({ titulo, valor, nota, delta }: { titulo: string; valor: string; nota: string; delta: number | null }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
      <p className="text-[11px] text-white/50">{titulo}</p>
      <p className="font-coolvetica text-3xl mt-1 tabular-nums">
        {valor}
        {delta != null && delta !== 0 && (
          <span className={`ml-2 text-sm font-sans ${delta > 0 ? "text-emerald-400" : "text-white/45"}`}>
            {delta > 0 ? "▲" : "▼"} {nf.format(Math.abs(delta))}
          </span>
        )}
      </p>
      <p className="text-xs text-white/35 mt-0.5">{nota}</p>
    </div>
  );
}

function TiposReel({ tipos }: { tipos: ResumenOrigenes["tipos"] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="rounded-2xl border border-white/8 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Qué tipo de reel rinde</h3>
        <button onClick={() => setAbierto((v) => !v)} className="text-xs text-white/50 hover:text-white underline-offset-2 hover:underline">
          {abierto ? "Cerrar" : "Corregir tipos"}
        </button>
      </div>
      <p className="text-xs text-white/35 mt-0.5">Últimos 90 días · el tipo sale de la descripción; corrígelo si se equivoca.</p>
      <ul className="mt-3 space-y-1.5">
        {tipos.length === 0 && <li className="text-sm text-white/35">Sin reels en 90 días.</li>}
        {tipos.map((t) => {
          const max = Math.max(...tipos.map((x) => x.mediana), 1);
          return (
            <li key={t.tipo ?? "sin"} className="grid grid-cols-[6.5rem_1fr_auto] sm:grid-cols-[9.5rem_1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
              <span className={t.tipo ? "" : "text-white/40"}>{t.tipo ? TIPO_REEL_LABEL[t.tipo] : "Sin clasificar"}</span>
              <span className="h-2 rounded-full bg-white/5 overflow-hidden">
                <span className="block h-full rounded-full bg-lgb-red/70" style={{ width: `${(t.mediana / max) * 100}%` }} />
              </span>
              <span className="tabular-nums text-white/70 text-right">
                {nf.format(t.mediana)} <span className="text-white/35 text-xs">· {t.reels} reels</span>
              </span>
            </li>
          );
        })}
      </ul>
      {abierto && <CorregirTipos />}
    </div>
  );
}

function CorregirTipos() {
  const [reels, setReels] = useState<ReelTipo[] | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/admin/social-posts?limite=40", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reels: [] }))
      .then((d) => { if (vivo) setReels(d.reels ?? []); })
      .catch(() => { if (vivo) setReels([]); });
    return () => { vivo = false; };
  }, []);

  const cambiar = async (id: string, tipo: string) => {
    setGuardando(id);
    try {
      const r = await fetch("/api/admin/social-posts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tipo: tipo || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast("⚠️ " + (j.error ?? "No se pudo guardar")); return; }
      setReels((prev) => (prev ?? []).map((x) => (x.id === id ? { ...x, tipo: tipo || x.tipo, tipoManual: Boolean(tipo) } : x)));
      toast("✓ Tipo guardado (se ve al recargar)");
    } finally {
      setGuardando(null);
    }
  };

  if (reels === null) return <p className="mt-3 text-sm text-white/40 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando reels…</p>;
  return (
    <ul className="mt-4 max-h-80 overflow-y-auto scroll-sutil divide-y divide-white/5 border-t border-white/8">
      {reels.map((r) => (
        <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
          <span className="flex-1 min-w-0 truncate text-white/70" title={r.caption}>{r.caption || "sin descripción"}</span>
          <span className="text-xs text-white/35 tabular-nums shrink-0">{nf.format(r.reproducciones)}</span>
          <select
            value={r.tipoManual ? r.tipo ?? "" : ""}
            onChange={(e) => cambiar(r.id, e.target.value)}
            disabled={guardando === r.id}
            aria-label="Tipo de reel"
            className="shrink-0 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs"
          >
            <option value="" className="bg-lgb-dark">Auto: {r.tipo && !r.tipoManual ? TIPO_REEL_LABEL[r.tipo] : "—"}</option>
            {TIPOS_REEL.map((t) => <option key={t.id} value={t.id} className="bg-lgb-dark">{t.label}</option>)}
          </select>
        </li>
      ))}
    </ul>
  );
}

function ReelsConClientes({ reels, isAdmin }: { reels: ResumenOrigenes["reelsConClientes"]; isAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 p-4">
      <h3 className="font-medium">Reels que trajeron clientes</h3>
      <p className="text-xs text-white/35 mt-0.5">Sale del reel que se elige al registrar al cliente, o del comentario con palabra clave.</p>
      {reels.length === 0 ? (
        <p className="mt-3 text-sm text-white/35">Todavía ninguno. Al registrar una venta de Instagram, elige de qué reel llegó.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {reels.map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 min-w-0 truncate" title={r.caption}>{r.caption || "sin descripción"}</span>
              <span className="shrink-0 text-white/60 tabular-nums">
                {r.clientes} {r.clientes === 1 ? "cliente" : "clientes"}{isAdmin && r.ventasMxn > 0 && <> · {mxn(r.ventasMxn)}</>}
              </span>
              {r.permalink && (
                <a href={r.permalink} target="_blank" rel="noopener noreferrer" aria-label="Ver reel" className="shrink-0 text-white/40 hover:text-white">
                  <ExternalLink size={14} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnlacesBio() {
  const base = "https://aridomusicgroup.com/ir/";
  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast("✓ Enlace copiado"); }
    catch { toast("⚠️ No se pudo copiar"); }
  };
  return (
    <div className="rounded-2xl border border-white/8 p-4">
      <h3 className="font-medium">Enlaces para las bios</h3>
      <p className="text-xs text-white/35 mt-0.5 max-w-2xl">
        Pon cada uno en la bio de su perfil. Cada clic se cuenta arriba en &quot;Clics bio&quot; y abre WhatsApp con un
        mensaje que ya dice de dónde viene (&quot;los vi en TikTok&quot;), así sabes qué origen ponerle.
      </p>
      <ul className="mt-3 grid sm:grid-cols-2 gap-2">
        {CANALES_ENLACE.map((c) => (
          <li key={c} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <span className="w-20 shrink-0 text-white/55">{ORIGEN_LABEL[c]}</span>
            <code className="flex-1 min-w-0 truncate text-white/80">{base}{c}</code>
            <button onClick={() => copiar(base + c)} aria-label={`Copiar enlace de ${ORIGEN_LABEL[c]}`} className="shrink-0 text-white/45 hover:text-white">
              <Copy size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
