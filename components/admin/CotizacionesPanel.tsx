"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2, Send, Download, Pencil, FileSignature, X, Receipt, ArrowRight, Loader2, Link2, Copy, Check, CircleDollarSign } from "lucide-react";
import { toast } from "@/lib/toast";
import { MonedaYCambio } from "@/components/admin/MonedaYCambio";
import { validarTipoCambio, aMxn, esExtranjera, convertir } from "@/lib/tipo-cambio";
import { COMISION_PAYPAL, desglose } from "@/lib/comision";
import { esEmail, partirCorreos } from "@/lib/destinatarios";
import servicesRaw from "@/data/services.json";
import { InstrumentosPicker } from "@/components/admin/InstrumentosPicker";
import { PlantillasEditor, type PlantillaItem } from "@/components/admin/PlantillasEditor";
import { inferirInstrumentos, incluyeDePaquete } from "@/lib/servicios";
import type { Cotizacion, Contrato, RastroCot } from "@/lib/cotizaciones-data";
import type { QuoteItem } from "@/lib/pdf/quote";
import { familiaDeCotizacion } from "@/lib/acuerdos/familias";
import { aplicaDescuentoFidelidad } from "@/lib/fidelidad";
import { ESQUEMAS_PAGO, ESQUEMA_LABEL, tramosDe, type EsquemaPago } from "@/lib/esquema-pago";

// ── Tipos de props (datos ya serializados desde el server) ──
interface ClienteLite { id: string; nombre: string; email: string | null; telefono: string | null; direccion: string | null }
interface TipoLite { id: string; label: string }
interface Props {
  /** Promedio de las ultimas ventas en dolares (lo calcula el servidor). */
  tcSugerido: number;
  cotizaciones: Cotizacion[];
  contratos: Contrato[];
  clientes: ClienteLite[];
  tipos: TipoLite[];
  rastro: Record<string, RastroCot>;
  isAdmin: boolean;
  plantillas: PlantillaItem[];
  equipo: MiembroEquipo[];
}

/** Miembro del equipo, para elegir responsables al convertir en venta. */
export interface MiembroEquipo {
  id: string;
  nombre: string;
  rol: string | null;
}

// ── Catálogo de servicios para el selector rápido (desde services.json) ──
const services = servicesRaw as unknown as {
  bases: { name: { es: string }; price: number }[];
  extras: { label: { es: string }; price: number }[];
  studio: { label: { es: string }; price: number }[];
};
const CATALOGO: { group: string; label: string; price: number }[] = [
  ...services.bases.filter((b) => b.price > 0).map((b) => ({ group: "Paquetes", label: b.name.es, price: b.price })),
  ...services.extras.map((e) => ({ group: "Instrumentos", label: e.label.es, price: e.price })),
  ...services.studio.map((s) => ({ group: "Estudio", label: s.label.es, price: s.price })),
];

const COT_ESTADO: Record<string, { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-white/10 text-white/60" },
  enviada: { label: "Enviada", cls: "bg-blue-500/15 text-blue-300" },
  aceptada: { label: "Aceptada", cls: "bg-green-500/15 text-green-300" },
  rechazada: { label: "Rechazada", cls: "bg-red-500/15 text-red-300" },
  vencida: { label: "Vencida", cls: "bg-amber-500/15 text-amber-300" },
};
const CONTRATO_ESTADO: Record<string, { label: string; cls: string }> = {
  borrador: { label: "Borrador", cls: "bg-white/10 text-white/60" },
  enviado: { label: "Enviado", cls: "bg-blue-500/15 text-blue-300" },
  firmado: { label: "Firmado", cls: "bg-green-500/15 text-green-300" },
  cancelado: { label: "Cancelado", cls: "bg-red-500/15 text-red-300" },
};

const chip = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

const fmt = (n: number, cur = "MXN") => `$${(Number(n) || 0).toLocaleString("es-MX")} ${cur}`;
const subtotalDe = (items: QuoteItem[]) => items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

// ══════════════════════════════════════════════════════════════════════════
export function CotizacionesPanel({ cotizaciones, contratos, clientes, tipos, rastro, isAdmin, plantillas, tcSugerido, equipo }: Props) {
  const [tab, setTab] = useState<"cotizaciones" | "contratos" | "plantillas">("cotizaciones");
  const [cotOpen, setCotOpen] = useState<Cotizacion | "new" | null>(null);
  const [conOpen, setConOpen] = useState<Contrato | "new" | Partial<Contrato> | null>(null);
  const [ventaOpen, setVentaOpen] = useState<Cotizacion | null>(null);

  return (
    <div>
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setTab("cotizaciones")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === "cotizaciones" ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
        >
          Cotizaciones <span className="opacity-60">({cotizaciones.length})</span>
        </button>
        <button
          onClick={() => setTab("contratos")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === "contratos" ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
        >
          Contratos <span className="opacity-60">({contratos.length})</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("plantillas")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === "plantillas" ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
          >
            Plantillas
          </button>
        )}
        <div className="ml-auto">
          {tab === "cotizaciones" && (
            <button onClick={() => setCotOpen("new")} className="flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer">
              <Plus size={16} /> Nueva cotización
            </button>
          )}
          {tab === "contratos" && (
            <button onClick={() => setConOpen("new")} className="flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer">
              <Plus size={16} /> Nuevo contrato
            </button>
          )}
        </div>
      </div>

      {tab === "cotizaciones" && (
        <CotizacionesList
          items={cotizaciones}
          rastro={rastro}
          isAdmin={isAdmin}
          onEdit={(c) => setCotOpen(c)}
          onConvertVenta={(c) => setVentaOpen(c)}
          onContratos={() => setTab("contratos")}
          onConvert={(c) =>
            setConOpen({
              tipo: "produccion",
              cotizacion_id: c.id,
              contacto_id: c.contacto_id,
              cliente_nombre: c.cliente_nombre,
              cliente_email: c.cliente_email,
              cliente_telefono: c.cliente_telefono,
              cliente_direccion: c.cliente_direccion,
              moneda: c.moneda,
              monto: c.total,
              items: c.items,
            })
          }
        />
      )}
      {tab === "contratos" && (
        <ContratosList items={contratos} tipos={tipos} isAdmin={isAdmin} onEdit={(c) => setConOpen(c)} />
      )}
      {tab === "plantillas" && isAdmin && <PlantillasEditor plantillas={plantillas} />}

      {cotOpen && (
        <CotizacionModal tcSugerido={tcSugerido}
          initial={cotOpen === "new" ? null : cotOpen}
          clientes={clientes}
          tipos={tipos}
          onClose={() => setCotOpen(null)}
        />
      )}
      {conOpen && (
        <ContratoModal tcSugerido={tcSugerido}
          initial={conOpen === "new" ? null : conOpen}
          tipos={tipos}
          clientes={clientes}
          onClose={() => setConOpen(null)}
        />
      )}
      {ventaOpen && (
        <ConvertirVentaModal tcSugerido={tcSugerido} equipo={equipo} cotizacion={ventaOpen} onClose={() => setVentaOpen(null)} />
      )}
    </div>
  );
}

// ── Envío de un documento (cotización o contrato) a uno o varios correos ──

/**
 * Panel inline para elegir a quién se manda el documento. El correo del cliente
 * va fijo (es a quien se emite el PDF); los demás se agregan como copias.
 * Acepta pegar varios separados por coma, punto y coma o espacio.
 */
function EnviarDoc({ clienteEmail, enviando, onEnviar, onCancelar }: {
  clienteEmail: string | null;
  enviando: boolean;
  onEnviar: (extra: string[]) => void;
  onCancelar: () => void;
}) {
  const base = (clienteEmail ?? "").trim();
  const [extra, setExtra] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const yaEsta = (e: string) =>
    e.toLowerCase() === base.toLowerCase() || extra.some((x) => x.toLowerCase() === e.toLowerCase());

  const agregar = () => {
    const nuevos = partirCorreos(texto);
    if (nuevos.length === 0) return;
    const malos = nuevos.filter((e) => !esEmail(e));
    if (malos.length) { setError(`Correo inválido: ${malos.join(", ")}`); return; }
    setExtra((prev) => [...prev, ...nuevos.filter((e) => !yaEsta(e))]);
    setTexto("");
    setError(null);
  };

  const total = (base ? 1 : 0) + extra.length;

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] text-white/45 uppercase tracking-wider mb-2">Enviar a</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {base && (
          <span className="inline-flex items-center gap-1 text-xs bg-lgb-red/15 text-lgb-red border border-lgb-red/30 rounded-full px-2.5 py-1">
            {base}
            <span className="text-[10px] opacity-70">cliente</span>
          </span>
        )}
        {extra.map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5 text-xs bg-white/8 border border-white/10 rounded-full px-2.5 py-1">
            {e}
            <button
              onClick={() => setExtra((prev) => prev.filter((x) => x !== e))}
              className="text-white/40 hover:text-white cursor-pointer"
              aria-label={`Quitar ${e}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {total === 0 && <span className="text-xs text-white/35">Agrega al menos un correo.</span>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <input
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); agregar(); } }}
          onBlur={agregar}
          placeholder="Otro correo (manager, quien paga…)"
          type="email"
          className="flex-1 min-w-[180px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-lgb-red"
        />
        <button
          onClick={() => onEnviar(extra)}
          disabled={enviando || total === 0}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer"
        >
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Enviar{total > 1 ? ` a ${total}` : ""}
        </button>
        <button onClick={onCancelar} className="text-white/40 hover:text-white text-xs px-2 cursor-pointer">Cancelar</button>
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {total > 1 && (
        <p className="text-white/35 text-[11px] mt-2">
          Va un solo correo con todos en «Para»: se ven entre sí y pueden responder a todos.
        </p>
      )}
    </div>
  );
}

// ── Link de pago (Stripe) por tramo ──
interface TramoEstadoUI { index: number; label: string; monto: number; pagado: boolean; pagadoAt: string | null }

function LinkPagoPanel({ cotizacion: c, onCerrar }: { cotizacion: Cotizacion; onCerrar: () => void }) {
  const [tramos, setTramos] = useState<TramoEstadoUI[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await api(`/api/admin/cotizaciones/${c.id}/link-pago`, "GET") as { tramos: TramoEstadoUI[] };
        if (vivo) setTramos(r.tramos);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudo leer el estado de pago.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [c.id]);

  const generar = async () => {
    setGenerando(true);
    setError(null);
    try {
      const r = await api(`/api/admin/cotizaciones/${c.id}/link-pago`, "POST") as { url: string };
      setUrl(r.url);
      setCopiado(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el link.");
    } finally {
      setGenerando(false);
    }
  };

  const copiar = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  const pendiente = tramos?.find((t) => !t.pagado) ?? null;
  const todoPagado = tramos !== null && tramos.length > 0 && !pendiente;

  return (
    <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-white/45 uppercase tracking-wider">Cobro por Stripe</p>
        <button onClick={onCerrar} className="text-white/40 hover:text-white cursor-pointer"><X size={13} /></button>
      </div>

      {cargando && <p className="text-white/40 text-xs">Cargando tramos…</p>}

      {tramos && tramos.length > 0 && (
        <ul className="flex flex-col gap-1 mb-2.5">
          {tramos.map((t) => (
            <li key={t.index} className="flex items-center justify-between text-xs">
              <span className={t.pagado ? "text-green-300" : "text-white/60"}>
                {t.pagado ? <Check size={12} className="inline mr-1" /> : null}
                {t.label}
              </span>
              <span className={t.pagado ? "text-green-300" : "text-white/50"}>{fmt(t.monto, c.moneda)}</span>
            </li>
          ))}
        </ul>
      )}

      {todoPagado && <p className="text-green-300 text-xs">✓ Todos los tramos están pagados.</p>}

      {pendiente && !url && (
        <button
          onClick={generar}
          disabled={generando}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer"
        >
          {generando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          Generar link — {pendiente.label} ({fmt(pendiente.monto, c.moneda)})
        </button>
      )}

      {url && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <input readOnly value={url} className="flex-1 min-w-[180px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70" onFocus={(e) => e.target.select()} />
          <button onClick={copiar} className="flex items-center gap-1.5 bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/15 cursor-pointer">
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

// ── Lista de cotizaciones ──
function CotizacionesList({ items, rastro, isAdmin, onEdit, onConvert, onConvertVenta, onContratos }: {
  items: Cotizacion[]; rastro: Record<string, RastroCot>; isAdmin: boolean; onContratos: () => void;
  onEdit: (c: Cotizacion) => void; onConvert: (c: Cotizacion) => void; onConvertVenta: (c: Cotizacion) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  /** Cotización con el panel de envío abierto (null = ninguno). */
  const [enviando, setEnviando] = useState<string | null>(null);
  /** Cotización con el panel de cobro por Stripe abierto (null = ninguno). */
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [estadoF, setEstadoF] = useState("todos");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((c) => {
      if (estadoF !== "todos" && c.estado !== estadoF) return false;
      if (!term) return true;
      return (
        (c.folio ?? "").toLowerCase().includes(term) ||
        (c.cliente_nombre ?? "").toLowerCase().includes(term) ||
        (c.cliente_email ?? "").toLowerCase().includes(term) ||
        (c.cliente_telefono ?? "").toLowerCase().includes(term) ||
        (c.notas ?? "").toLowerCase().includes(term) ||
        c.items.some((i) => i.label.toLowerCase().includes(term))
      );
    });
  }, [items, q, estadoF]);

  const enviar = async (c: Cotizacion, extra: string[]) => {
    setBusy(c.id);
    try {
      const r = await api("/api/admin/cotizaciones/enviar", "POST", { id: c.id, emails: extra }) as { destinatarios?: string[] };
      const n = r?.destinatarios?.length ?? 0;
      toast(n > 1 ? `✓ Cotización enviada a ${n} correos` : "✓ Cotización enviada");
      setEnviando(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };
  const borrar = async (c: Cotizacion) => {
    if (!confirm(`¿Eliminar la cotización ${c.folio}? No se puede deshacer.`)) return;
    setBusy(c.id);
    try { await api(`/api/admin/cotizaciones?id=${c.id}`, "DELETE"); router.refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(null); }
  };

  if (items.length === 0) return <Empty label="Aún no hay cotizaciones. Crea la primera." />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por folio, cliente, correo, concepto…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red flex-1 min-w-[220px]"
        />
        <button onClick={() => setEstadoF("todos")} className={chip(estadoF === "todos")}>Todas</button>
        {Object.entries(COT_ESTADO).map(([k, v]) => (
          <button key={k} onClick={() => setEstadoF(k)} className={chip(estadoF === k)}>{v.label}</button>
        ))}
      </div>
      {(q.trim() || estadoF !== "todos") && (
        <p className="text-white/30 text-xs px-1">Mostrando {filtered.length} de {items.length}</p>
      )}
      {filtered.length === 0 && <Empty label="Sin cotizaciones con ese filtro." />}
      {filtered.map((c) => {
        const est = COT_ESTADO[c.estado] ?? COT_ESTADO.borrador;
        const r = rastro[c.id] ?? { venta: null, proyecto: null, contrato: null, acuerdo: null };
        return (
          <div key={c.id} className="bg-lgb-surface border border-white/5 rounded-2xl p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <FileText size={18} className="text-white/30 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">
                  {c.folio} · {c.cliente_nombre || c.cliente_email || "Sin cliente"}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("es-MX")} · {c.items.length} concepto(s)
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-coolvetica text-lg leading-none">{fmt(c.total, c.moneda)}</div>
                <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full ${est.cls}`}>{est.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <IconBtn title="Ver PDF" onClick={() => window.open(`/api/admin/cotizaciones/pdf?id=${c.id}`, "_blank")}><Download size={15} /></IconBtn>
              <IconBtn title="Enviar por correo" disabled={busy === c.id} onClick={() => setEnviando(enviando === c.id ? null : c.id)}><Send size={15} /></IconBtn>
              <IconBtn title="Cobrar por Stripe" onClick={() => setCobrando(cobrando === c.id ? null : c.id)}><CircleDollarSign size={15} /></IconBtn>
              {isAdmin && !r.venta && <IconBtn title="Convertir en venta (crea proyecto)" onClick={() => onConvertVenta(c)}><Receipt size={15} /></IconBtn>}
              <IconBtn title="Contrato manual" onClick={() => onConvert(c)}><FileSignature size={15} /></IconBtn>
              <IconBtn title="Editar" onClick={() => onEdit(c)}><Pencil size={15} /></IconBtn>
              {isAdmin && <IconBtn title="Eliminar" disabled={busy === c.id} onClick={() => borrar(c)}><Trash2 size={15} /></IconBtn>}
            </div>
            {enviando === c.id && (
              <EnviarDoc
                clienteEmail={c.cliente_email}
                enviando={busy === c.id}
                onCancelar={() => setEnviando(null)}
                onEnviar={(extra) => enviar(c, extra)}
              />
            )}
            {cobrando === c.id && <LinkPagoPanel cotizacion={c} onCerrar={() => setCobrando(null)} />}
            <RastroLinea c={c} r={r} onContratos={onContratos} />
          </div>
        );
      })}
    </div>
  );
}

// ── Lista de contratos ──
function ContratosList({ items, tipos, isAdmin, onEdit }: {
  items: Contrato[]; tipos: TipoLite[]; isAdmin: boolean; onEdit: (c: Contrato) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  /** Contrato con el panel de envío abierto (null = ninguno). */
  const [enviando, setEnviando] = useState<string | null>(null);
  const tipoLabel = (id: string) => tipos.find((t) => t.id === id)?.label ?? id;
  const [q, setQ] = useState("");
  const [estadoF, setEstadoF] = useState("todos");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((c) => {
      if (estadoF !== "todos" && c.estado !== estadoF) return false;
      if (!term) return true;
      return (
        (c.folio ?? "").toLowerCase().includes(term) ||
        (c.cliente_nombre ?? "").toLowerCase().includes(term) ||
        (c.cliente_email ?? "").toLowerCase().includes(term) ||
        (c.cliente_telefono ?? "").toLowerCase().includes(term) ||
        (c.concepto ?? "").toLowerCase().includes(term) ||
        (c.notas ?? "").toLowerCase().includes(term) ||
        c.items.some((i) => i.label.toLowerCase().includes(term))
      );
    });
  }, [items, q, estadoF]);

  const enviar = async (c: Contrato, extra: string[]) => {
    setBusy(c.id);
    try {
      const r = await api("/api/admin/contratos/enviar", "POST", { id: c.id, emails: extra }) as { destinatarios?: string[] };
      const n = r?.destinatarios?.length ?? 0;
      toast(n > 1 ? `✓ Contrato enviado a ${n} correos` : "✓ Contrato enviado");
      setEnviando(null);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };
  const borrar = async (c: Contrato) => {
    if (!confirm(`¿Eliminar el contrato ${c.folio}? No se puede deshacer.`)) return;
    setBusy(c.id);
    try { await api(`/api/admin/contratos?id=${c.id}`, "DELETE"); router.refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(null); }
  };

  if (items.length === 0) return <Empty label="Aún no hay contratos. Crea el primero." />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por folio, cliente, correo, concepto…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red flex-1 min-w-[220px]"
        />
        <button onClick={() => setEstadoF("todos")} className={chip(estadoF === "todos")}>Todos</button>
        {Object.entries(CONTRATO_ESTADO).map(([k, v]) => (
          <button key={k} onClick={() => setEstadoF(k)} className={chip(estadoF === k)}>{v.label}</button>
        ))}
      </div>
      {(q.trim() || estadoF !== "todos") && (
        <p className="text-white/30 text-xs px-1">Mostrando {filtered.length} de {items.length}</p>
      )}
      {filtered.length === 0 && <Empty label="Sin contratos con ese filtro." />}
      {filtered.map((c) => {
        const est = CONTRATO_ESTADO[c.estado] ?? CONTRATO_ESTADO.borrador;
        return (
          <div key={c.id} className="bg-lgb-surface border border-white/5 rounded-2xl p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <FileSignature size={18} className="text-white/30 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">
                  {c.folio} · {c.cliente_nombre || c.cliente_email || "Sin cliente"}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {tipoLabel(c.tipo)} · {new Date(c.created_at).toLocaleDateString("es-MX")}
                </p>
              </div>
              <div className="text-right shrink-0">
                {c.monto > 0 && <div className="font-coolvetica text-lg leading-none">{fmt(c.monto, c.moneda)}</div>}
                <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full ${est.cls}`}>{est.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <IconBtn title="Ver PDF" onClick={() => window.open(`/api/admin/contratos/pdf?id=${c.id}`, "_blank")}><Download size={15} /></IconBtn>
              <IconBtn title="Enviar por correo" disabled={busy === c.id} onClick={() => setEnviando(enviando === c.id ? null : c.id)}><Send size={15} /></IconBtn>
              <IconBtn title="Editar" onClick={() => onEdit(c)}><Pencil size={15} /></IconBtn>
              {isAdmin && <IconBtn title="Eliminar" disabled={busy === c.id} onClick={() => borrar(c)}><Trash2 size={15} /></IconBtn>}
            </div>
            {enviando === c.id && (
              <EnviarDoc
                clienteEmail={c.cliente_email}
                enviando={busy === c.id}
                onCancelar={() => setEnviando(null)}
                onEnviar={(extra) => enviar(c, extra)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Editor de line items (compartido por cotización y contrato) ──
function ItemsEditor({ items, onChange, moneda }: { items: QuoteItem[]; onChange: (v: QuoteItem[]) => void; moneda: string }) {
  const add = (label = "", price = 0) => onChange([...items, { label, qty: 1, unitPrice: price }]);
  const update = (i: number, patch: Partial<QuoteItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <select
          defaultValue=""
          onChange={(e) => {
            const opt = CATALOGO.find((c) => c.label === e.target.value);
            if (opt) add(opt.label, opt.price);
            e.target.value = "";
          }}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 cursor-pointer"
        >
          <option value="" disabled>+ Agregar del catálogo…</option>
          {["Paquetes", "Instrumentos", "Estudio"].map((g) => (
            <optgroup key={g} label={g}>
              {CATALOGO.filter((c) => c.group === g).map((c) => (
                <option key={c.label} value={c.label}>{c.label} — ${c.price.toLocaleString("es-MX")}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" onClick={() => add()} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-white/70 px-3 py-2 rounded-lg text-sm cursor-pointer">
          <Plus size={14} /> Libre
        </button>
      </div>

      {items.length === 0 && <p className="text-white/30 text-xs py-3 text-center">Agrega conceptos del catálogo o líneas libres.</p>}
      <div className="flex flex-col gap-2">
        {items.map((it, i) => {
          const inc = incluyeDePaquete(it.label);
          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <input
                  value={it.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Concepto"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm"
                />
                <input
                  type="number" min={1} value={it.qty}
                  onChange={(e) => update(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-center"
                  title="Cantidad"
                />
                <input
                  type="number" min={0} value={it.unitPrice}
                  onChange={(e) => update(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-right"
                  title="Precio unitario"
                />
                <button type="button" onClick={() => remove(i)} className="text-white/30 hover:text-red-400 cursor-pointer p-1"><Trash2 size={15} /></button>
              </div>
              {inc.length > 0 && (
                <p className="text-white/40 text-[11px] mt-1 ml-1">Incluye: {inc.join(" · ")}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-white/10">
        <span className="text-white/50 text-sm">Subtotal</span>
        <span className="font-coolvetica text-xl">{fmt(subtotalDe(items), moneda)}</span>
      </div>
    </div>
  );
}

// ── Modal de cotización ──
function CotizacionModal({ initial, clientes, tipos, onClose, tcSugerido }: { initial: Cotizacion | null; clientes: ClienteLite[]; tipos: TipoLite[]; onClose: () => void; tcSugerido: number }) {
  const router = useRouter();
  const [tipo, setTipo] = useState(initial?.tipo ?? "");
  const [esquemaPago, setEsquemaPago] = useState(initial?.esquema_pago ?? "estandar");
  const [numCanciones, setNumCanciones] = useState(initial?.num_canciones ?? 5);
  const [epAlbumFormato, setEpAlbumFormato] = useState<"ep" | "album" | "">(initial?.ep_album_formato ?? "");
  const [nombre, setNombre] = useState(initial?.cliente_nombre ?? "");
  const [email, setEmail] = useState(initial?.cliente_email ?? "");
  const [telefono, setTelefono] = useState(initial?.cliente_telefono ?? "");
  const [direccion, setDireccion] = useState(initial?.cliente_direccion ?? "");
  const [contactoId, setContactoId] = useState<string | null>(initial?.contacto_id ?? null);
  const [moneda, setMoneda] = useState(initial?.moneda ?? "MXN");
  const [tipoCambio, setTipoCambio] = useState(initial?.tipo_cambio ? String(initial.tipo_cambio) : "");
  const [items, setItems] = useState<QuoteItem[]>(initial?.items ?? []);
  const [descuento, setDescuento] = useState(initial?.descuento ?? 0);
  const [comisionPct, setComisionPct] = useState(initial?.comision_pct ?? 0);
  const [vigencia, setVigencia] = useState(initial?.vigencia_dias ?? 15);
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Nivel de fidelidad del cliente elegido: se consulta al servidor (nunca se
  // confía en un % calculado en el navegador). Solo importa cuando el esquema
  // es "de contado" en un servicio a la medida — es la única combinación que
  // lleva descuento por fidelidad.
  const [fidelidad, setFidelidad] = useState<{ descuentoPct: number; nivel: number; creditoDisponible: number } | null>(null);
  const [aplicarCreditoChk, setAplicarCreditoChk] = useState(false);
  // Interruptor manual del staff: aunque el cliente califique, esta cotización
  // en particular no lleva descuento (ej. VIP al que igual se le cobra el 100%).
  const [sinDescuentoFidelidad, setSinDescuentoFidelidad] = useState(initial?.sin_descuento_fidelidad ?? false);

  // El esquema de pago solo tiene sentido para un servicio a la medida — una
  // cotización "genérica" o sin tipo no tiene de qué hablar aquí.
  const esquemaAplica = !!tipo && tipo !== "generico";
  // "Elegible" = la combinación tipo/esquema calificaría para el descuento —
  // se usa para decidir si se muestra el panel de fidelidad (con su
  // interruptor). "Aplica" = además el staff no lo apagó a mano.
  const fidelidadElegible = esquemaAplica && esquemaPago === "contado" && aplicaDescuentoFidelidad(tipo);
  const fidelidadAplica = fidelidadElegible && !sinDescuentoFidelidad;

  useEffect(() => {
    if (!contactoId || !fidelidadElegible) { setFidelidad(null); setAplicarCreditoChk(false); return; }
    let vivo = true;
    fetch(`/api/admin/fidelidad?contacto_id=${encodeURIComponent(contactoId)}`)
      .then((r) => r.json())
      .then((d) => { if (vivo) setFidelidad(d); })
      .catch(() => { if (vivo) setFidelidad(null); });
    return () => { vivo = false; };
  }, [contactoId, fidelidadElegible]);

  const d = useMemo(
    () => desglose(items, Number(descuento) || 0, comisionPct, fidelidadAplica ? fidelidad?.descuentoPct ?? 0 : 0),
    [items, descuento, comisionPct, fidelidadAplica, fidelidad],
  );
  // Vista previa nada más — lo que de verdad se cobra lo vuelve a calcular el
  // servidor al guardar, con el crédito disponible releído en ese momento.
  const creditoPrevio = aplicarCreditoChk ? Math.min(fidelidad?.creditoDisponible ?? 0, d.total) : 0;
  const total = Math.max(0, Math.round((d.total - creditoPrevio) * 100) / 100);

  // Si el tipo tiene acuerdo (familiaDeCotizacion), al ENVIAR esta cotización
  // sale el enlace de firma antes del anticipo — se avisa en el formulario
  // para que no sea una sorpresa.
  const familia = familiaDeCotizacion(tipo || null);
  const tramos = esquemaAplica ? tramosDe(esquemaPago as EsquemaPago, total, numCanciones) : [];

  const pickCliente = (val: string) => {
    setNombre(val);
    const c = clientes.find((x) => x.nombre === val);
    if (c) { setEmail(c.email ?? ""); setTelefono(c.telefono ?? ""); setDireccion(c.direccion ?? ""); setContactoId(c.id); }
  };

  const save = async () => {
    if (items.length === 0) { setErr("Agrega al menos un concepto."); return; }
    const problema = validarTipoCambio(moneda, Number(tipoCambio) || 0);
    if (problema) { setErr(problema); return; }
    setSaving(true); setErr(null);
    const body = {
      id: initial?.id, contacto_id: contactoId,
      cliente_nombre: nombre, cliente_email: email, cliente_telefono: telefono, cliente_direccion: direccion,
      moneda, tipo_cambio: Number(tipoCambio) || null, comision_pct: comisionPct,
      items, descuento: Number(descuento) || 0, vigencia_dias: Number(vigencia) || 15, notas,
      tipo: tipo || null,
      esquema_pago: esquemaAplica ? esquemaPago : null,
      num_canciones: (esquemaAplica && esquemaPago === "por_cancion") || tipo === "ep_album" ? numCanciones : null,
      ep_album_formato: tipo === "ep_album" && epAlbumFormato ? epAlbumFormato : null,
      // El servidor vuelve a calcular el % de fidelidad y el crédito
      // disponible por su cuenta — aquí solo se manda la INTENCIÓN de
      // aplicarlo, nunca un monto (eso sería confiar en el navegador).
      aplicar_credito: fidelidadAplica && aplicarCreditoChk,
      sin_descuento_fidelidad: fidelidadElegible && sinDescuentoFidelidad,
    };
    try {
      await api("/api/admin/cotizaciones", initial ? "PATCH" : "POST", body);
      router.refresh();
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); setSaving(false); }
  };

  return (
    <Modal title={initial ? `Editar ${initial.folio}` : "Nueva cotización"} onClose={onClose}>
      <Field label="Tipo de servicio">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input cursor-pointer">
          <option value="">Sin clasificar</option>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>
      {familia && (
        <p className="text-[11px] text-amber-300/70 -mt-1 mb-2">
          Al mandarla, si {nombre || "el cliente"} no ha firmado el acuerdo de {familia}, le llega el enlace para
          firmarlo antes del anticipo.
        </p>
      )}
      {tipo === "ep_album" && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Field label="¿Es EP o Álbum?">
            <select value={epAlbumFormato} onChange={(e) => setEpAlbumFormato(e.target.value as "ep" | "album" | "")} className="input cursor-pointer">
              <option value="">Sin especificar</option>
              <option value="ep">EP</option>
              <option value="album">Álbum</option>
            </select>
          </Field>
          <Field label="Número de canciones">
            <input type="number" min={1} value={numCanciones} onChange={(e) => setNumCanciones(Math.max(1, Number(e.target.value) || 1))} className="input" />
          </Field>
        </div>
      )}
      <ClienteFields {...{ nombre, email, telefono, direccion, clientes, pickCliente, setEmail, setTelefono, setDireccion }} />
      <MonedaYCambio moneda={moneda} setMoneda={setMoneda} tipoCambio={tipoCambio}
        setTipoCambio={setTipoCambio} monto={total} sugerido={tcSugerido}
        onReexpresar={(factor) => {
          // Cotizaste 6,000 pesos y elegiste USD: los conceptos y el descuento
          // se vuelven a escribir en dólares. El trabajo vale lo mismo.
          setItems((prev) => prev.map((i) => ({ ...i, unitPrice: convertir(i.unitPrice, factor) })));
          setDescuento((d) => convertir(Number(d) || 0, factor));
        }} />
      <div className="mt-2"><label className="text-white/60 text-xs">Conceptos</label>
        <div className="mt-1"><ItemsEditor items={items} onChange={setItems} moneda={moneda} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Field label="Descuento"><input type="number" min={0} value={descuento} onChange={(e) => setDescuento(Number(e.target.value) || 0)} className="input" /></Field>
        <Field label="Vigencia (días)"><input type="number" min={1} value={vigencia} onChange={(e) => setVigencia(Number(e.target.value) || 15)} className="input" /></Field>
      </div>

      {esquemaAplica && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <Field label="Forma de pago">
            <select value={esquemaPago} onChange={(e) => setEsquemaPago(e.target.value)} className="input cursor-pointer">
              {ESQUEMAS_PAGO.map((e) => <option key={e} value={e}>{ESQUEMA_LABEL[e]}</option>)}
            </select>
          </Field>
          {esquemaPago === "por_cancion" && tipo !== "ep_album" && (
            <Field label="Número de canciones">
              <input type="number" min={1} value={numCanciones} onChange={(e) => setNumCanciones(Math.max(1, Number(e.target.value) || 1))} className="input" />
            </Field>
          )}
          {total > 0 && (
            <div className="mt-2 space-y-0.5">
              {tramos.map((t, i) => (
                <div key={i} className="flex justify-between text-[11px] text-white/45">
                  <span>{t.label}</span><span>{fmt(t.monto, moneda)}</span>
                </div>
              ))}
            </div>
          )}

          {fidelidadElegible && fidelidad && (
            <div className="mt-2.5 pt-2.5 border-t border-white/8">
              <p className={`text-[11px] ${fidelidadAplica ? "text-green-300/80" : "text-white/40 line-through"}`}>
                Nivel {fidelidad.nivel} de fidelidad · {fidelidad.descuentoPct}% de descuento
                {fidelidadAplica && d.descuentoFidelidad > 0 && <> aplicado ({fmt(d.descuentoFidelidad, moneda)})</>}
              </p>
              <label className="mt-1.5 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sinDescuentoFidelidad} onChange={(e) => setSinDescuentoFidelidad(e.target.checked)}
                  className="accent-lgb-red cursor-pointer" />
                <span className="text-[11px] text-white/60">
                  Sin descuento de fidelidad en esta cotización (se cobra el 100%)
                </span>
              </label>
              {fidelidadAplica && fidelidad.creditoDisponible > 0 && (
                <label className="mt-1.5 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={aplicarCreditoChk} onChange={(e) => setAplicarCreditoChk(e.target.checked)}
                    className="accent-lgb-red cursor-pointer" />
                  <span className="text-[11px] text-white/60">
                    Aplicar su crédito disponible ({fmt(fidelidad.creditoDisponible, moneda)})
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      <label className={`mt-3 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
        comisionPct > 0 ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
      }`}>
        <input type="checkbox" checked={comisionPct > 0}
          onChange={(e) => setComisionPct(e.target.checked ? COMISION_PAYPAL : 0)}
          className="mt-0.5 accent-lgb-red cursor-pointer" />
        <span className="min-w-0">
          <span className="text-sm text-white/85 block">Va a pagar por PayPal (+{COMISION_PAYPAL}%)</span>
          <span className="text-[11px] text-white/40 block mt-0.5">
            Le suma la comisión de la plataforma al total. Si no, ese {COMISION_PAYPAL}% sale de tu bolsa.
          </span>
        </span>
      </label>

      <Field label="Notas (opcional)"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="input resize-none" /></Field>

      {/* Desglose: solo aparece cuando hay algo que explicar. */}
      {(d.descuento > 0 || d.comision > 0) && (
        <div className="mt-2 space-y-0.5 text-xs">
          <div className="flex justify-between text-white/40"><span>Subtotal</span><span>{fmt(d.subtotal, moneda)}</span></div>
          {d.descuento > 0 && (
            <div className="flex justify-between text-white/40"><span>Descuento</span><span>- {fmt(d.descuento, moneda)}</span></div>
          )}
          {d.comision > 0 && (
            <div className="flex justify-between text-amber-300/80">
              <span>Comisión PayPal ({d.comisionPct}%)</span><span>+ {fmt(d.comision, moneda)}</span>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-between items-baseline mt-2">
        <span className="text-white/50 text-sm">Total</span>
        <span className="font-coolvetica text-2xl">{fmt(total, moneda)}</span>
      </div>
      {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
      <SaveBar saving={saving} onSave={save} onClose={onClose} />
    </Modal>
  );
}

// ── Modal de contrato ──
function ContratoModal({ initial, tipos, clientes, onClose, tcSugerido }: { initial: Contrato | Partial<Contrato> | null; tipos: TipoLite[]; clientes: ClienteLite[]; onClose: () => void; tcSugerido: number }) {
  const router = useRouter();
  const isEdit = !!(initial && "id" in initial && initial.id);
  const [tipo, setTipo] = useState(initial?.tipo ?? "produccion");
  const [nombre, setNombre] = useState(initial?.cliente_nombre ?? "");
  const [email, setEmail] = useState(initial?.cliente_email ?? "");
  const [telefono, setTelefono] = useState(initial?.cliente_telefono ?? "");
  const [direccion, setDireccion] = useState(initial?.cliente_direccion ?? "");
  const [contactoId, setContactoId] = useState<string | null>(initial?.contacto_id ?? null);
  const [moneda, setMoneda] = useState(initial?.moneda ?? "MXN");
  const [tipoCambio, setTipoCambio] = useState(initial?.tipo_cambio ? String(initial.tipo_cambio) : "");
  const [concepto, setConcepto] = useState(initial?.concepto ?? "");
  const [monto, setMonto] = useState(initial?.monto ?? 0);
  const [items, setItems] = useState<QuoteItem[]>(initial?.items ?? []);
  const [clausulas, setClausulas] = useState(initial?.clausulas_extra ?? "");
  const [notas, setNotas] = useState(initial?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickCliente = (val: string) => {
    setNombre(val);
    const c = clientes.find((x) => x.nombre === val);
    if (c) { setEmail(c.email ?? ""); setTelefono(c.telefono ?? ""); setDireccion(c.direccion ?? ""); setContactoId(c.id); }
  };

  const save = async () => {
    if (tipo !== "generico" && !concepto.trim()) { setErr("Escribe el concepto (beat/producción/servicio)."); return; }
    setSaving(true); setErr(null);
    const body = {
      id: isEdit ? (initial as Contrato).id : undefined,
      tipo, cotizacion_id: initial?.cotizacion_id ?? null, contacto_id: contactoId,
      cliente_nombre: nombre, cliente_email: email, cliente_telefono: telefono, cliente_direccion: direccion,
      moneda, tipo_cambio: Number(tipoCambio) || null,
      monto: Number(monto) || 0, concepto, items, clausulas_extra: clausulas, notas,
    };
    try {
      await api("/api/admin/contratos", isEdit ? "PATCH" : "POST", body);
      router.refresh();
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); setSaving(false); }
  };

  return (
    <Modal title={isEdit ? `Editar ${(initial as Contrato).folio}` : "Nuevo contrato"} onClose={onClose}>
      <Field label="Plantilla">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Contrato["tipo"])} className="input cursor-pointer">
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>
      <ClienteFields {...{ nombre, email, telefono, direccion, clientes, pickCliente, setEmail, setTelefono, setDireccion }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Concepto (beat/producción/servicio)"><input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="input" placeholder="Ej. Corrido a la medida" /></Field>
        <Field label="Monto"><input type="number" min={0} value={monto} onChange={(e) => setMonto(Number(e.target.value) || 0)} className="input" /></Field>
      </div>
      <MonedaYCambio moneda={moneda} setMoneda={setMoneda} tipoCambio={tipoCambio}
        setTipoCambio={setTipoCambio} monto={Number(monto) || 0} sugerido={tcSugerido} etiquetaMonto="Monto"
        onReexpresar={(factor) => {
          setMonto((m) => convertir(Number(m) || 0, factor));
          setItems((prev) => prev.map((i) => ({ ...i, unitPrice: convertir(i.unitPrice, factor) })));
        }} />
      {(tipo === "produccion" || tipo === "servicio" || tipo === "generico") && (
        <div className="mt-2"><label className="text-white/60 text-xs">Desglose (opcional)</label>
          <div className="mt-1"><ItemsEditor items={items} onChange={setItems} moneda={moneda} /></div>
        </div>
      )}
      {tipo === "generico" && (
        <Field label="Cláusulas (una por párrafo)"><textarea value={clausulas} onChange={(e) => setClausulas(e.target.value)} rows={5} className="input resize-none" placeholder={"PRIMERA. …\nSEGUNDA. …"} /></Field>
      )}
      <Field label="Notas internas (opcional)"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="input resize-none" /></Field>
      {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
      <SaveBar saving={saving} onSave={save} onClose={onClose} />
    </Modal>
  );
}

// ── UI helpers ──
function ClienteFields(p: {
  nombre: string; email: string; telefono: string; direccion: string; clientes: ClienteLite[];
  pickCliente: (v: string) => void; setEmail: (v: string) => void; setTelefono: (v: string) => void; setDireccion: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Cliente">
          <input list="clientes-dl" value={p.nombre} onChange={(e) => p.pickCliente(e.target.value)} className="input" placeholder="Nombre" />
          <datalist id="clientes-dl">{p.clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
        </Field>
        <Field label="Correo"><input value={p.email} onChange={(e) => p.setEmail(e.target.value)} className="input" placeholder="correo@…" /></Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Teléfono"><input value={p.telefono} onChange={(e) => p.setTelefono(e.target.value)} className="input" /></Field>
        <Field label="Dirección (opcional)"><input value={p.direccion} onChange={(e) => p.setDireccion(e.target.value)} className="input" /></Field>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mt-2"><span className="text-white/60 text-xs">{label}</span><div className="mt-1">{children}</div></label>;
}
function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait">
      {children}
    </button>
  );
}
function Empty({ label }: { label: string }) {
  return <div className="text-center text-white/40 text-sm py-16 border border-dashed border-white/10 rounded-2xl">{label}</div>;
}
function SaveBar({ saving, onSave, onClose }: { saving: boolean; onSave: () => void; onClose: () => void }) {
  return (
    <div className="flex gap-2 mt-5">
      <button onClick={onSave} disabled={saving} className="flex-1 bg-lgb-red text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50">
        {saving ? "Guardando…" : "Guardar"}
      </button>
      <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white bg-white/5 cursor-pointer">Cancelar</button>
    </div>
  );
}
// Línea de vida: el rastro desde la cotización hasta el contrato.
function RastroLinea({ c, r, onContratos }: { c: Cotizacion; r: RastroCot; onContratos: () => void }) {
  const steps = [
    { label: c.contacto_id ? "Contacto ✓" : "Sin contacto", on: !!c.contacto_id, href: "/admin/clientes" },
    { label: r.venta || "Venta", on: !!r.venta, href: "/admin/ventas" },
    // El proyecto sí enlaza a su ficha exacta; los demás al panel que les toca,
    // que es lo que hay (Ventas y Clientes no filtran por folio todavía).
    { label: r.proyecto || "Proyecto", on: !!r.proyecto, href: r.proyectoId ? `/admin/proyectos/${r.proyectoId}` : "/admin/produccion" },
    { label: r.contrato || "Contrato", on: !!r.contrato, href: null as string | null },
  ];
  // El acuerdo solo aparece cuando el tipo de servicio tiene uno (personalizado,
  // servicio, exclusiva negociada): los "genérico" no tienen texto legal que
  // ofrecer, y mostrar un pill siempre apagado sería ruido, no información.
  const acuerdo =
    r.acuerdo === "firmado"
      ? { label: "Acuerdo firmado", cls: "bg-green-500/15 text-green-300" }
      : r.acuerdo === "pendiente"
        ? { label: "Falta firmar acuerdo", cls: "bg-amber-500/15 text-amber-300" }
        : null;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-2.5 pt-2.5 border-t border-white/5">
      {steps.map((s, i) => {
        const cls = `text-[10px] px-2 py-0.5 rounded-full ${s.on ? "bg-lgb-red/15 text-lgb-red" : "bg-white/5 text-white/30"}`;
        // Sólo lleva a algún lado lo que ya existe: un paso apagado no tiene
        // destino, y ofrecerlo como enlace sería una promesa vacía.
        const contenido = !s.on ? (
          <span className={cls}>{s.label}</span>
        ) : s.href ? (
          <Link href={s.href} className={`${cls} hover:brightness-125 transition-[filter] cursor-pointer`} title="Abrir">
            {s.label}
          </Link>
        ) : (
          <button onClick={onContratos} className={`${cls} hover:brightness-125 transition-[filter] cursor-pointer`} title="Ver en Contratos">
            {s.label}
          </button>
        );
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ArrowRight size={10} className="text-white/20" />}
            {contenido}
          </span>
        );
      })}
      {acuerdo && (
        <span className="flex items-center gap-1">
          <ArrowRight size={10} className="text-white/20" />
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${acuerdo.cls}`}>{acuerdo.label}</span>
        </span>
      )}
    </div>
  );
}

const VENTA_TIPOS = ["Beat personalizado", "BP + Letra", "Grabación", "Mezcla / Master", "Exclusividad", "EP", "Álbum"];

// Convierte una cotización en venta (folio I####) + proyecto con tareas (reusa /api/admin/ventas).
function ConvertirVentaModal({ cotizacion: c, onClose, tcSugerido, equipo }: {
  cotizacion: Cotizacion; onClose: () => void; tcSugerido: number; equipo: MiembroEquipo[];
}) {
  const router = useRouter();
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [titulo, setTitulo] = useState(c.items[0]?.label ?? "Producción");
  const [tipo, setTipo] = useState("Beat personalizado");
  // Se guardan en el proyecto: el previo para músico los toma de aquí en vez de
  // pedirlos cada vez. Opcionales — si no se saben todavía, se capturan después.
  const [tonalidad, setTonalidad] = useState("");
  const [bpm, setBpm] = useState("");

  // Conceptos "libres" = los que NO salieron del catálogo (botón "+ Libre").
  // Si la cotización no trae ningún paquete, no aplica la plantilla estándar:
  // cada concepto se vuelve una tarea tal cual.
  const enCatalogo = (label: string) =>
    CATALOGO.some((x) => x.label.toLowerCase() === (label || "").trim().toLowerCase());
  const hayPaquete = c.items.some((i) =>
    CATALOGO.some((x) => x.group === "Paquetes" && x.label.toLowerCase() === (i.label || "").trim().toLowerCase())
  );
  const libres = c.items.filter((i) => !enCatalogo(i.label)).map((i) => i.label);

  const [modo, setModo] = useState<"plantilla" | "libre">(hayPaquete ? "plantilla" : "libre");
  const [tareasLibres, setTareasLibres] = useState(
    () => (libres.length ? libres : c.items.map((i) => i.label)).join("\n")
  );
  // Instrumentos inferidos del paquete cotizado (editables antes de crear el proyecto).
  const [extras, setExtras] = useState(() => inferirInstrumentos(c.items.map((i) => i.label)).join(", "));
  // Si la cotización llevaba la comisión de PayPal, el medio de pago ya se sabe.
  const [medioPago, setMedioPago] = useState(c.comision_pct > 0 ? "PAYPAL" : "");
  const [quienCerro, setQuienCerro] = useState("");
  // Por defecto los socios (Luis y Eliud): son los responsables de toda
  // producción salvo que se cambie aquí. Se lee del rol y no de dos ids fijos,
  // así sigue siendo correcto si el equipo cambia.
  const [responsables, setResponsables] = useState<string[]>(
    () => equipo.filter((e) => e.rol === "socio").map((e) => e.id),
  );
  const [anticipo, setAnticipo] = useState(0);
  const [crearProyecto, setCrearProyecto] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // La cotizacion ya trae su tipo de cambio; si no (es vieja), se propone el promedio.
  const [tipoCambio, setTipoCambio] = useState(
    c.tipo_cambio ? String(c.tipo_cambio) : esExtranjera(c.moneda) ? String(tcSugerido) : "",
  );
  const enPesos = aMxn(c.total, c.moneda, Number(tipoCambio) || 0);

  const save = async () => {
    const problema = validarTipoCambio(c.moneda, Number(tipoCambio) || 0);
    if (problema) { setErr(problema); return; }
    setSaving(true); setErr(null);
    try {
      await api("/api/admin/ventas", "POST", {
        fecha,
        cotizacion_id: c.id,
        cliente: c.cliente_nombre, email: c.cliente_email, telefono: c.cliente_telefono,
        canal: "whatsapp",
        tipo, beat_nombre: titulo,
        // Antes se copiaba `c.total` tal cual: una cotizacion de 500 USD
        // entraba como 500 pesos. Ahora se convierte con el tipo de cambio.
        moneda: c.moneda, monto_cobrado: c.total,
        tipo_cambio: esExtranjera(c.moneda) ? Number(tipoCambio) || null : null,
        total_mxn: enPesos,
        medio_pago: medioPago || null, quien_cerro: quienCerro || null,
        anticipo: Number(anticipo) || 0,
        extras: modo === "plantilla" ? extras || null : null,
        // Plantilla → tareas "Grabar {instrumento}". Libre → una tarea por concepto.
        instrumentos: modo === "plantilla" ? extras : "",
        tareas_libres: modo === "libre" ? tareasLibres : "",
        crear_proyecto: crearProyecto,
        responsables,
        tonalidad: tonalidad.trim() || null,
        bpm: Number(bpm) || null,
      });
      router.refresh();
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); setSaving(false); }
  };

  return (
    <Modal title={`Convertir ${c.folio} en venta`} onClose={onClose}>
      <p className="text-white/50 text-xs mb-1">
        Cliente: <b className="text-white/80">{c.cliente_nombre || c.cliente_email || "—"}</b> · Total: <b className="text-white/80">{fmt(c.total, c.moneda)}</b>
      </p>
      {esExtranjera(c.moneda) && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <label className="text-white/60 text-xs">Tipo de cambio <span className="text-white/30">(prom. {tcSugerido})</span></label>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <input type="number" step="any" min={0} value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)}
              className="input w-28" placeholder={String(tcSugerido)} />
            <span className="text-xs text-white/40">se registra como</span>
            <span className="text-sm font-medium text-green-300">
              ${enPesos.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" /></Field>
        <Field label="Tipo (arma las tareas)">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input cursor-pointer">
            {VENTA_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Título de la producción"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="input" /></Field>

      {/* Quedan guardados en el proyecto: el previo para músico los toma de aquí
          y ya no hay que escribirlos al renderizar. */}
      {crearProyecto && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tonalidad (opcional)">
            <input value={tonalidad} onChange={(e) => setTonalidad(e.target.value)} maxLength={12} placeholder="Am" className="input" />
          </Field>
          <Field label="BPM (opcional)">
            <input type="number" min={20} max={400} value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="154" className="input" />
          </Field>
        </div>
      )}
      {crearProyecto && (
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-white/60 text-xs mr-1">Tareas del proyecto:</span>
            {([
              { k: "plantilla", label: "Plantilla (maqueta, grabar, mezcla…)" },
              { k: "libre", label: "Solo estos conceptos" },
            ] as const).map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setModo(o.k)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                  modo === o.k ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {modo === "plantilla" ? (
            <>
              <span className="text-white/60 text-xs">
                Instrumentos <span className="text-white/30">(inferidos del paquete · ajústalos)</span>
              </span>
              <div className="mt-1"><InstrumentosPicker value={extras} onChange={setExtras} /></div>
            </>
          ) : (
            <>
              <span className="text-white/60 text-xs">
                Tareas a crear <span className="text-white/30">(una por línea · sin plantilla)</span>
              </span>
              <textarea
                value={tareasLibres}
                onChange={(e) => setTareasLibres(e.target.value)}
                rows={4}
                className="input resize-none mt-1"
                placeholder={"Grabar coros\nEditar voces\n…"}
              />
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Medio de pago (opcional)"><input value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className="input" placeholder="Transferencia, PayPal…" /></Field>
        <Field label="Anticipo (opcional)"><input type="number" min={0} value={anticipo} onChange={(e) => setAnticipo(Number(e.target.value) || 0)} className="input" /></Field>
      </div>
      <Field label="Quién cerró (opcional)"><input value={quienCerro} onChange={(e) => setQuienCerro(e.target.value)} className="input" placeholder="Eliud, Rocha…" /></Field>
      <label className="flex items-center gap-2 mt-3 cursor-pointer text-sm text-white/70">
        <input type="checkbox" checked={crearProyecto} onChange={(e) => setCrearProyecto(e.target.checked)} className="accent-lgb-red w-4 h-4" />
        Crear también el proyecto de producción y sus tareas
      </label>

      {/* Quién se hace cargo. Sólo tiene sentido si se está creando el proyecto. */}
      {crearProyecto && equipo.length > 0 && (
        <div className="mt-3">
          <p className="text-white/50 text-xs mb-1.5">Responsables del proyecto</p>
          <div className="flex flex-wrap gap-1.5">
            {equipo.map((e) => {
              const puesto = responsables.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    setResponsables((prev) => (puesto ? prev.filter((x) => x !== e.id) : [...prev, e.id]))
                  }
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer ${
                    puesto ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
                  }`}
                >
                  {e.nombre}
                </button>
              );
            })}
          </div>
          {responsables.length === 0 && (
            <p className="text-amber-300/70 text-[11px] mt-1.5">
              Sin responsables el proyecto no le aparece a nadie en su filtro.
            </p>
          )}
        </div>
      )}
      {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
      <SaveBar saving={saving} onSave={save} onClose={onClose} />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-lgb-dark border border-white/10 rounded-2xl p-5 w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-coolvetica text-xl">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white cursor-pointer"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
