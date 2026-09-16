"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/admin/ui/Modal";
import { money } from "@/components/admin/ui";

export interface Dependencias {
  tareas: number; subtareas: number; recordatorios: number;
  renderJobs: number; renderInventario: number;
  /** Sólo al borrar una venta: los proyectos que cuelgan de ella. */
  proyectos: number; proyectosTitulos: string[];
  /** Sólo al borrar un proyecto: la venta ligada. */
  ventas: number; pagos: number; montoTotalMxn: number;
  pagosMusico: number; montoPagosMusicoMxn: number;
  contratos: number; contratosFirmados: number;
  /** Pedidos del sitio: lo que el cliente ve en su panel. */
  pedidos: number;
  driveArchivos: number | null; driveCarpetaId: string | null;
}

export type TipoCascada = "proyecto" | "venta";

/**
 * Diálogo de borrado en cascada, para un proyecto o para una venta.
 *
 * Las casillas llegan PALOMEADAS: borrar algo se lleva lo que cuelga de ello,
 * que es lo que se espera. Lo que se quiera conservar se desmarca a mano, y
 * cada fila dice qué pasa si se deja sin marcar. Tareas, subtareas,
 * recordatorios y renders no son casilla: la base los borra con el proyecto, y
 * ofrecer una casilla que el servidor no puede honrar sería mentir.
 */
export function ConfirmCascadeDialog({ open, tipo = "proyecto", id, titulo, onClose, onConfirmed }: {
  open: boolean;
  tipo?: TipoCascada;
  id: string;
  titulo: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Eliminar "${titulo}"`} maxWidth="max-w-md">
      {/* Montada sólo mientras está abierta: cada apertura arranca limpia. */}
      {open && <CascadeContent key={id} tipo={tipo} id={id} onClose={onClose} onConfirmed={onConfirmed} />}
    </Modal>
  );
}

function CascadeContent({ tipo, id, onClose, onConfirmed }: {
  tipo: TipoCascada; id: string; onClose: () => void; onConfirmed: () => void;
}) {
  const base = tipo === "venta" ? "/api/admin/ventas" : "/api/admin/proyectos";
  const [deps, setDeps] = useState<Dependencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eliminarProyecto, setEliminarProyecto] = useState(true);
  const [eliminarVenta, setEliminarVenta] = useState(true);
  const [eliminarContrato, setEliminarContrato] = useState(true);
  const [eliminarPedido, setEliminarPedido] = useState(true);
  const [eliminarDrive, setEliminarDrive] = useState(true);

  useEffect(() => {
    fetch(`${base}/${id}/dependencias`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Dependencias | null) => setDeps(d))
      .catch(() => setDeps(null))
      .finally(() => setLoading(false));
  }, [base, id]);

  const confirmar = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(base, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, eliminarProyecto, eliminarVenta, eliminarContrato, eliminarPedido, eliminarDrive }),
      });
      if (r.ok) { onConfirmed(); return; }
      const d = await r.json().catch(() => ({}));
      setError(d.error || "No se pudo eliminar.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setBusy(false);
    }
  };

  const contratoFirmado = (deps?.contratosFirmados ?? 0) > 0;
  const esVenta = tipo === "venta";

  return (
    <>
      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-sm py-6 justify-center">
          <Loader2 size={16} className="animate-spin" /> Revisando qué depende de {esVenta ? "esta venta" : "este proyecto"}…
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
          {esVenta && deps.proyectos > 0 && (
            <Row
              label={`${deps.proyectos} proyecto(s) de producción: ${deps.proyectosTitulos.join(", ")}`}
              checked={eliminarProyecto}
              onChange={setEliminarProyecto}
              warn
              sub={`Se van con sus ${deps.tareas} tarea(s), ${deps.subtareas} subtarea(s) y sus renders. Sin marcar, el proyecto se queda sin venta.`}
            />
          )}
          {!esVenta && (
            <Row
              label={`${deps.tareas} tareas · ${deps.subtareas} subtareas · ${deps.recordatorios} recordatorios`}
              locked
              sub="Se eliminan automáticamente con el proyecto."
            />
          )}
          {!esVenta && (deps.renderJobs > 0 || deps.renderInventario > 0) && (
            <Row
              label={`${deps.renderJobs} render(s) · inventario de ${deps.renderInventario} pista(s)`}
              locked
              sub="Se eliminan automáticamente con el proyecto."
            />
          )}
          {!esVenta && deps.ventas > 0 && (
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
          {esVenta && (
            <Row
              label={`${deps.pagos} pago(s) del cliente${deps.pagosMusico > 0 ? ` · ${deps.pagosMusico} pago(s) a músico(s) (${money(deps.montoPagosMusicoMxn)})` : ""}`}
              locked
              sub="Se eliminan automáticamente con la venta."
            />
          )}
          {deps.contratos > 0 && (
            <Row
              label={`${deps.contratos} contrato(s)${contratoFirmado ? " — incluye uno FIRMADO" : ""}`}
              checked={eliminarContrato}
              onChange={setEliminarContrato}
              warn
              sub={contratoFirmado
                ? "Un contrato firmado es un documento que el cliente ya tiene. Desmárcalo si quieres conservarlo."
                : "Sin marcar, el contrato se conserva sin ligar a nada."}
            />
          )}
          {deps.pedidos > 0 && (
            <Row
              label={`${deps.pedidos} pedido(s) del cliente`}
              checked={eliminarPedido}
              onChange={setEliminarPedido}
              warn
              sub="Es lo que el cliente ve en su panel. Sin marcar, le sigue apareciendo."
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
      {error && <p className="text-red-300 text-xs mt-3">{error}</p>}
      <div className="flex items-center gap-2 pt-4 mt-3 border-t border-white/8">
        <button
          onClick={confirmar}
          disabled={busy || loading || !deps}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null} Eliminar {esVenta ? "venta" : "proyecto"}
        </button>
        <button onClick={onClose} className="text-white/40 hover:text-white text-xs px-2 cursor-pointer">Cancelar</button>
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
          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${checked ? "bg-red-500/40 border-red-400/60" : "border-white/25"}`}
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
