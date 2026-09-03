"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/admin/ui/Modal";
import {
  TIPOS_PROD, TIPOS_INT, PLATAFORMAS, esContenidoPub, inp, lblS,
  ResponsablesPicker, type Equipo, type VentaLite,
} from "@/components/admin/ProduccionBoard";
import { TIPO_PROY_LABEL, PRIORIDAD_LABEL, type ProyectoDetalle } from "@/lib/erp-data";
import { toast } from "@/lib/toast";

/**
 * Mismo formulario que la edición inline de la tarjeta en el kanban (Producción),
 * solo que aquí vive en el modal compartido con blur de fondo. Un solo campo
 * de datos, un solo endpoint (PATCH /api/admin/proyectos) — nada se reimplementa
 * dos veces.
 */
export function EditarProyectoModal({ open, proyecto, equipo, ventas, isAdmin, onClose }: {
  open: boolean; proyecto: ProyectoDetalle; equipo: Equipo[]; ventas: VentaLite[]; isAdmin: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ef, setEf] = useState({
    titulo: proyecto.titulo, clase: proyecto.clase, tipo: proyecto.tipo ?? "",
    responsables: proyecto.responsables ?? [],
    prioridad: proyecto.prioridad, fecha_entrega: proyecto.fecha_entrega ?? "", brief: proyecto.brief ?? "",
    entregable_url: proyecto.entregable_url ?? "", notas: proyecto.notas ?? "", venta_id: proyecto.venta_id ?? "",
    plataforma: proyecto.plataforma ?? "", fecha_publicacion: proyecto.fecha_publicacion ?? "", link_post: proyecto.link_post ?? "",
  });
  const [ventaInput, setVentaInput] = useState(ventas.find((v) => v.id === proyecto.venta_id)?.label ?? "");
  const onVenta = (val: string) => {
    setVentaInput(val);
    const m = ventas.find((v) => v.label === val);
    setEf((s) => ({ ...s, venta_id: m ? m.id : "" }));
  };

  const guardar = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/proyectos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proyecto.id, ...ef }),
      });
      if (r.ok) { toast("✓ Guardado"); router.refresh(); onClose(); }
      else toast("⚠️ No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar proyecto">
      <div className="space-y-2.5">
        <div>
          <label className={lblS}>Título</label>
          <input data-autofocus value={ef.titulo} onChange={(e) => setEf((p) => ({ ...p, titulo: e.target.value }))} className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2 min-w-0">
            <label className={lblS}>Responsables</label>
            <ResponsablesPicker equipo={equipo} value={ef.responsables} onChange={(v) => setEf((p) => ({ ...p, responsables: v }))} />
          </div>
          <div className="col-span-2 min-w-0">
            <label className={lblS}>Clase</label>
            <select value={ef.clase} onChange={(e) => setEf((p) => ({ ...p, clase: e.target.value as "produccion" | "interna" }))} className={inp}>
              <option value="produccion" className="bg-lgb-dark">Producción (cliente)</option>
              <option value="interna" className="bg-lgb-dark">Tarea interna</option>
            </select>
          </div>
          <div className="col-span-2 min-w-0">
            <label className={lblS}>Tipo</label>
            <select value={ef.tipo} onChange={(e) => setEf((p) => ({ ...p, tipo: e.target.value }))} className={inp}>
              <option value="" className="bg-lgb-dark">Sin tipo</option>
              {(ef.clase === "produccion" ? TIPOS_PROD : TIPOS_INT).map((t) => (
                <option key={t} value={t} className="bg-lgb-dark">{TIPO_PROY_LABEL[t] ?? t}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className={lblS}>Prioridad</label>
            <select value={ef.prioridad} onChange={(e) => setEf((p) => ({ ...p, prioridad: e.target.value }))} className={inp}>
              {["baja", "media", "alta"].map((x) => <option key={x} value={x} className="bg-lgb-dark">{PRIORIDAD_LABEL[x]}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className={lblS}>Entrega</label>
            <input type="date" value={ef.fecha_entrega} onChange={(e) => setEf((p) => ({ ...p, fecha_entrega: e.target.value }))} className={inp} />
          </div>
          <div className="col-span-2 min-w-0">
            <label className={lblS}>Link entregables</label>
            <input value={ef.entregable_url} onChange={(e) => setEf((p) => ({ ...p, entregable_url: e.target.value }))} placeholder="Drive…" className={inp} />
          </div>
        </div>
        {isAdmin && (
          <div>
            <label className={lblS}>Venta ligada <span className="text-white/25">(busca folio · beat · cliente)</span></label>
            <input list="ventas-link-list-detalle" value={ventaInput} onChange={(e) => onVenta(e.target.value)} placeholder="Sin venta ligada" className={inp} />
            <datalist id="ventas-link-list-detalle">
              {ventas.map((v) => <option key={v.id} value={v.label} />)}
            </datalist>
          </div>
        )}
        <div>
          <label className={lblS}>Brief / notas</label>
          <input value={ef.brief} onChange={(e) => setEf((p) => ({ ...p, brief: e.target.value }))} className={inp} />
        </div>
        {esContenidoPub(proyecto.tipo) && (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={lblS}>Plataforma</label>
              <input list="plataformas-list-detalle" value={ef.plataforma} onChange={(e) => setEf((x) => ({ ...x, plataforma: e.target.value }))} placeholder="Instagram" className={inp} />
              <datalist id="plataformas-list-detalle">
                {PLATAFORMAS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label className={lblS}>Fecha publicación</label>
              <input type="date" value={ef.fecha_publicacion} onChange={(e) => setEf((x) => ({ ...x, fecha_publicacion: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lblS}>Link del post</label>
              <input value={ef.link_post} onChange={(e) => setEf((x) => ({ ...x, link_post: e.target.value }))} placeholder="https://…" className={inp} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2">
          <button onClick={guardar} disabled={busy} className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : null} Guardar
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xs px-2">Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}
