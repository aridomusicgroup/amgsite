"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/admin/ui/Modal";
import { money } from "@/components/admin/ui";

export interface Dependencias {
  tareas: number; subtareas: number; recordatorios: number;
  renderJobs: number; renderInventario: number;
  ventas: number; pagos: number; montoTotalMxn: number;
  pagosMusico: number; montoPagosMusicoMxn: number;
  contratos: number; contratosFirmados: number;
  driveArchivos: number | null; driveCarpetaId: string | null;
}

/**
 * Diálogo de borrado en cascada. Tareas/subtareas/recordatorios/renders ya se
 * borran solos por ON DELETE CASCADE — se muestran como fila bloqueada
 * (informativa), no como checkbox real, porque ofrecer una casilla que el
 * backend no puede honrar sería mentirle al usuario. Venta+pagos, contrato y
 * Drive SÍ son reales y llegan desmarcados: son dinero, un documento legal o
 * archivos — no se borran por accidente solo por dar clic rápido en "Sí".
 */
export function ConfirmCascadeDialog({ open, proyectoId, proyectoTitulo, onClose, onConfirmed }: {
  open: boolean; proyectoId: string; proyectoTitulo: string; onClose: () => void; onConfirmed: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Eliminar "${proyectoTitulo}"`} maxWidth="max-w-md">
      {/* Montada solo mientras está abierto: cada apertura es un mount fresco
          (key=proyectoId), así los checkboxes y el fetch de dependencias
          arrancan limpios sin necesitar un efecto que los "resetee" a mano. */}
      {open && <CascadeContent key={proyectoId} proyectoId={proyectoId} onClose={onClose} onConfirmed={onConfirmed} />}
    </Modal>
  );
}

function CascadeContent({ proyectoId, onClose, onConfirmed }: {
  proyectoId: string; onClose: () => void; onConfirmed: () => void;
}) {
  const [deps, setDeps] = useState<Dependencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [eliminarVenta, setEliminarVenta] = useState(false);
  const [eliminarContrato, setEliminarContrato] = useState(false);
  const [eliminarDrive, setEliminarDrive] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/proyectos/${proyectoId}/dependencias`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Dependencias | null) => setDeps(d))
      .catch(() => setDeps(null))
      .finally(() => setLoading(false));
  }, [proyectoId]);

  const confirmar = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/proyectos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proyectoId, eliminarVenta, eliminarContrato, eliminarDrive }),
      });
      if (r.ok) onConfirmed();
    } finally {
      setBusy(false);
    }
  };

  const contratoFirmado = (deps?.contratosFirmados ?? 0) > 0;

  return (
    <>
      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-sm py-6 justify-center">
          <Loader2 size={16} className="animate-spin" /> Revisando qué depende de este proyecto…
        </div>
      ) : !deps ? (
        <p className="text-white/50 text-sm py-4">No se pudo revisar las dependencias. Intenta de nuevo.</p>
      ) : (
        <motion.div
          className="space-y-2.5"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        >
          <Row
            label={`${deps.tareas} tareas · ${deps.subtareas} subtareas · ${deps.recordatorios} recordatorios`}
            locked
            sub="Se eliminan automáticamente con el proyecto."
          />
          {(deps.renderJobs > 0 || deps.renderInventario > 0) && (
            <Row
              label={`${deps.renderJobs} render(s) · inventario de ${deps.renderInventario} pista(s)`}
              locked
              sub="Se eliminan automáticamente con el proyecto."
            />
          )}
          {deps.ventas > 0 && (
            <Row
              label={`Venta de ${money(deps.montoTotalMxn)} · ${deps.pagos} pago(s) registrado(s)${deps.pagosMusico > 0 ? ` · ${deps.pagosMusico} pago(s) a músico(s) (${money(deps.montoPagosMusicoMxn)})` : ""}`}
              checked={eliminarVenta}
              onChange={setEliminarVenta}
              warn
              sub={deps.pagosMusico > 0
                ? "Borra la venta, sus pagos del cliente Y los pagos a músicos ligados — no se puede deshacer."
                : "Borra el registro financiero de la venta y sus pagos — no se puede deshacer."}
            />
          )}
          {deps.contratos > 0 && (
            <Row
              label={`${deps.contratos} contrato(s)${contratoFirmado ? " — incluye uno FIRMADO" : ""}`}
              checked={eliminarContrato}
              onChange={setEliminarContrato}
              warn
              sub={contratoFirmado
                ? "Un contrato firmado no debería eliminarse — verifica con un socio antes de marcar esto."
                : "Si lo dejas sin marcar, el contrato se conserva sin ligar a este proyecto."}
            />
          )}
          {(deps.driveArchivos ?? 0) > 0 && (
            <Row
              label={`${deps.driveArchivos} archivo(s) en Drive`}
              checked={eliminarDrive}
              onChange={setEliminarDrive}
              warn
              sub="Se mandan a la papelera de Drive (recuperables 30 días)."
            />
          )}
        </motion.div>
      )}
      <div className="flex items-center gap-2 pt-4 mt-3 border-t border-white/8">
        <button
          onClick={confirmar}
          disabled={busy || loading || !deps}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null} Eliminar proyecto
        </button>
        <button onClick={onClose} className="text-white/40 hover:text-white text-xs px-2">Cancelar</button>
      </div>
    </>
  );
}

function Row({ label, sub, locked, checked, onChange, warn }: {
  label: string; sub?: string; locked?: boolean; checked?: boolean; onChange?: (v: boolean) => void; warn?: boolean;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${warn ? "border-amber-500/25 bg-amber-500/5" : "border-white/8 bg-white/[0.03]"}`}
    >
      {locked ? (
        <div title="Se elimina automáticamente" className="mt-0.5 w-4 h-4 rounded border border-white/20 bg-white/10 flex items-center justify-center shrink-0">
          <Check size={11} className="text-white/50" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onChange?.(!checked)}
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-red-500/40 border-red-400/60" : "border-white/25"}`}
        >
          {checked && <Check size={11} className="text-white" />}
        </button>
      )}
      <div className="min-w-0">
        <p className="text-sm text-white/85">{label}</p>
        {sub && (
          <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${warn ? "text-amber-300/80" : "text-white/35"}`}>
            {warn && <AlertTriangle size={11} className="shrink-0" />}{sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}
