"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Lock, Check, Send, CreditCard, ArrowLeft } from "lucide-react";
import { RenderOpciones } from "@/components/admin/RenderOpciones";
import { toast } from "@/lib/toast";
import type { Renderizable, OpcionesRender } from "@/lib/render-jobs";

type Datos = {
  p: Renderizable | null;
  titulo: string;
  saldo: { total: number; cobrado: number; saldo: number } | null;
  previews: { lista: string; retenidaConPago: string | null; retenidaSinPago: string | null };
};
type Paso = "cargando" | "sinCarpeta" | "entregables" | "stems" | "aviso";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/**
 * El cuadro de entrega: Entregables → Stems → aviso al cliente.
 *
 * Los dos primeros pasos son EL MISMO cuadro que se abre al picarle a
 * "Entregables" y "Stems" en la página de REAPER, sin cambiar nada. El tercero
 * es lo nuevo: qué se le dice al cliente, que depende de si ya liquidó.
 *
 * Nada se encola hasta el final. Encolar los entregables en el paso 1 y que
 * alguien cerrara el cuadro en el 2 dejaría una entrega a medias, y el lote
 * se cerraría sin stems sin que nadie lo hubiera decidido.
 */
export function EntregaModal({ proyectoId, tareaId, onCerrar }: {
  proyectoId: string;
  tareaId: string | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [paso, setPaso] = useState<Paso>("cargando");
  const [opEnt, setOpEnt] = useState<OpcionesRender | null>(null);
  const [opStems, setOpStems] = useState<OpcionesRender | null>(null);
  const [avisar, setAvisar] = useState(true);
  const [conPago, setConPago] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/entrega?proyectoId=${proyectoId}${tareaId ? `&tareaId=${tareaId}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudo abrir la entrega");
        return d as Datos;
      })
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setPaso(d.p ? "entregables" : "sinCarpeta");
        if (!d.p?.puedeAvisar) setAvisar(false);
      })
      .catch((e: Error) => {
        if (!vivo) return;
        toast(`⚠️ ${e.message}`);
        onCerrar();
      });
    return () => { vivo = false; };
    // onCerrar viene estable del lanzador; volver a pedir por él no aporta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, tareaId]);

  const enviar = async () => {
    if (!opEnt) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/entrega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId, tareaId, entregables: opEnt, stems: opStems, avisar, conPago: avisar && conPago }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo encolar");
      toast(d.stemsError
        ? `⚠️ Los entregables quedaron en cola; los stems no: ${d.stemsError}`
        : "✓ Entrega en cola — te aviso cuando esté en Drive");
      router.refresh();
      onCerrar();
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo encolar"}`);
    } finally {
      setEnviando(false);
    }
  };

  if (paso === "cargando" || !datos) {
    return (
      <Marco onCerrar={onCerrar}>
        <p className="flex items-center gap-2 text-sm text-white/50 p-6"><Loader2 size={15} className="animate-spin" /> Preparando la entrega…</p>
      </Marco>
    );
  }

  if (paso === "sinCarpeta" || !datos.p) {
    return (
      <Marco onCerrar={onCerrar}>
        <div className="p-5">
          <p className="font-coolvetica text-lg mb-1">Entrega · {datos.titulo}</p>
          <p className="text-sm text-white/55 leading-relaxed">
            No encuentro la carpeta de REAPER de esto todavía. El script del estudio revisa cada 2 minutos;
            si el proyecto ya no está en Cola, Producción o Revisión, o no tiene venta ligada, no aparece para renderizar.
          </p>
          <div className="flex justify-end mt-4">
            <button onClick={onCerrar} className="px-4 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/15 cursor-pointer">Cerrar</button>
          </div>
        </div>
      </Marco>
    );
  }

  if (paso === "entregables") {
    return (
      <RenderOpciones
        key="entregables"
        p={datos.p} tipo="entregables" musicos={[]} enviando={false}
        encabezado="Entrega · paso 1 de 3" ocultarAviso etiquetaConfirmar="Siguiente: stems"
        onCerrar={onCerrar}
        onConfirmar={(op) => { setOpEnt(op); setPaso("stems"); }}
      />
    );
  }

  if (paso === "stems") {
    return (
      <RenderOpciones
        key="stems"
        p={datos.p} tipo="stems" musicos={[]} enviando={false}
        encabezado="Entrega · paso 2 de 3" ocultarAviso etiquetaConfirmar="Siguiente: aviso"
        etiquetaSaltar="Sin stems" onSaltar={() => { setOpStems(null); setPaso("aviso"); }}
        onCerrar={onCerrar}
        onConfirmar={(op) => { setOpStems(op); setPaso("aviso"); }}
      />
    );
  }

  // ── Paso 3: el aviso ────────────────────────────────────────────────────────
  const s = datos.saldo;
  const debe = Boolean(s && s.saldo > 0.5);
  const preview = !avisar
    ? null
    : debe
      ? (conPago ? datos.previews.retenidaConPago : datos.previews.retenidaSinPago)
      : datos.previews.lista;
  const minutos = opStems ? 16 : 10;

  return (
    <Marco onCerrar={() => !enviando && onCerrar()}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-lgb-red/80 mb-0.5">Entrega · paso 3 de 3</p>
          <p className="font-coolvetica text-lg truncate">Aviso al cliente · {datos.titulo}</p>
          <p className="text-white/40 text-xs mt-0.5">
            Se encolan: Entregables{opStems ? " + Stems" : ""} · ≈{minutos} min en REAPER, más la subida
          </p>
        </div>
        <button onClick={onCerrar} disabled={enviando} className="text-white/40 hover:text-white cursor-pointer shrink-0"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-3">
        {debe && s ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3">
            <Lock size={15} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/85 leading-relaxed">
              Debe <b className="text-white">{peso(s.saldo)}</b> de {peso(s.total)}. Se sube a Drive, pero <b className="text-white">no lo verá
              hasta liquidar</b>. En cuanto pague se le muestra solo y le llega el correo de que ya puede descargar.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl border border-green-400/20 bg-green-500/[0.06] p-3">
            <Check size={15} className="text-green-300 shrink-0 mt-0.5" />
            <p className="text-xs text-green-100/80 leading-relaxed">Ya liquidó. En cuanto suba a Drive se le muestra en su cuenta.</p>
          </div>
        )}

        <Casilla
          activo={avisar} inhabil={!datos.p.puedeAvisar} onClick={() => setAvisar((v) => !v)}
          icono={<Send size={13} />}
          titulo={debe ? `Avisarle que ya está listo` : `Avisarle por correo`}
          nota={datos.p.puedeAvisar
            ? debe ? "Le llega cuando termine de subir: “ya está listo, se desbloquea al liquidar”." : "Le llega cuando termine de subir, con el enlace a su cuenta."
            : "Este proyecto no tiene pedido ligado o el cliente no tiene correo."}
        />
        {debe && avisar && (
          <Casilla
            activo={conPago} onClick={() => setConPago((v) => !v)}
            icono={<CreditCard size={13} />}
            titulo="Incluir botón de pago (Stripe)"
            nota="El cobro se arma al momento del clic, por el saldo de ese instante: nunca caduca. Sin botón, el correo le pide respondernos para coordinar."
          />
        )}

        {preview && (
          <div>
            <p className="text-[11px] text-white/40 mb-1.5">Así le va a llegar</p>
            <iframe srcDoc={preview} sandbox="" title="Vista previa del correo" className="w-full h-72 rounded-xl bg-white border border-white/10" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 p-5 pt-3 border-t border-white/5">
        <button onClick={() => setPaso("stems")} disabled={enviando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white cursor-pointer disabled:opacity-40">
          <ArrowLeft size={14} /> Atrás
        </button>
        <button onClick={enviar} disabled={enviando}
          className="flex items-center gap-2 bg-lgb-red hover:bg-lgb-red/85 text-white px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-40">
          {enviando && <Loader2 size={14} className="animate-spin" />}
          Mandar a renderizar
        </button>
      </div>
    </Marco>
  );
}

function Marco({ onCerrar, children }: { onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCerrar}>
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-lgb-dark border border-white/10" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Casilla({ activo, inhabil, onClick, icono, titulo, nota }: {
  activo: boolean; inhabil?: boolean; onClick: () => void; icono: React.ReactNode; titulo: string; nota: string;
}) {
  return (
    <button onClick={onClick} disabled={inhabil}
      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
        activo && !inhabil ? "bg-lgb-red/10 border-lgb-red/40" : "bg-white/5 border-transparent"
      } ${inhabil ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/10"}`}>
      <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${activo && !inhabil ? "bg-lgb-red border-lgb-red" : "border-white/25"}`}>
        {activo && !inhabil && <Check size={11} className="text-white" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm text-white">{icono} {titulo}</span>
        <span className="block text-[11px] text-white/40 mt-0.5 leading-relaxed">{nota}</span>
      </span>
    </button>
  );
}
