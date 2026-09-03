"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Trash2, Copy } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { toast } from "@/lib/toast";
import { ESTADO_PROY_LABEL, TIPO_PROY_LABEL, PRIORIDAD_LABEL, type ProyectoDetalle as TProyectoDetalle } from "@/lib/erp-data";
import { esContenidoPub, type Equipo, type VentaLite } from "@/components/admin/ProduccionBoard";
import { ConfirmCascadeDialog } from "@/components/admin/ui/ConfirmCascadeDialog";
import { EditarProyectoModal } from "@/components/admin/EditarProyectoModal";
import { ResumenTab } from "@/components/admin/proyecto-detalle/ResumenTab";
import { TareasTab } from "@/components/admin/proyecto-detalle/TareasTab";
import { ClienteVentaTab } from "@/components/admin/proyecto-detalle/ClienteVentaTab";
import { ContratoTab } from "@/components/admin/proyecto-detalle/ContratoTab";
import { DriveTab } from "@/components/admin/proyecto-detalle/DriveTab";
import { ActividadTab } from "@/components/admin/proyecto-detalle/ActividadTab";
import { ProduccionTab } from "@/components/admin/proyecto-detalle/ProduccionTab";
import { RedesTab } from "@/components/admin/proyecto-detalle/RedesTab";

const MUSICA_TIPOS = ["beat_personalizado", "bp_letra", "grabacion", "mezcla_master", "ep", "album"];
const PRIOR_DOT: Record<string, string> = { alta: "bg-red-400", media: "bg-amber-400", baja: "bg-white/30" };

export function ProyectoDetalle({ proyecto, equipo, ventas, isAdmin }: {
  proyecto: TProyectoDetalle; equipo: Equipo[]; ventas: VentaLite[]; isAdmin: boolean;
}) {
  const router = useRouter();
  // proyectos/proyecto_tareas/proyecto_subtareas ya se cubren globalmente en AdminNav;
  // esto solo agrega lo que esa suscripción panel-wide no incluye.
  useRealtimeRefresh("rt-proyecto-detalle", ["render_jobs", "render_inventario", "actividad", "contratos", "tarea_recordatorios"]);

  const tabs = [
    { id: "resumen", label: "Resumen", show: true },
    { id: "tareas", label: "Tareas", show: true },
    { id: "cliente", label: "Cliente y venta", show: proyecto.clase === "produccion" },
    { id: "contrato", label: "Contrato", show: proyecto.clase === "produccion" && (proyecto.contratos.length > 0 || !!proyecto.cotizacion || proyecto.tipo === "beat_personalizado") },
    { id: "produccion", label: "Producción", show: !!proyecto.tipo && MUSICA_TIPOS.includes(proyecto.tipo) },
    { id: "redes", label: "Redes", show: esContenidoPub(proyecto.tipo) },
    { id: "drive", label: "Archivos", show: true },
    { id: "actividad", label: "Actividad", show: true },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(tabs[0].id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicando, setDuplicando] = useState(false);

  const duplicar = async () => {
    setDuplicando(true);
    try {
      const r = await fetch("/api/admin/proyectos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: `${proyecto.titulo} (copia)`, clase: proyecto.clase, tipo: proyecto.tipo,
          brief: proyecto.brief, responsables: proyecto.responsables,
        }),
      });
      if (r.ok) { toast("✓ Proyecto duplicado — revísalo en Producción"); router.push("/admin/produccion"); }
      else toast("⚠️ No se pudo duplicar");
    } finally {
      setDuplicando(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIOR_DOT[proyecto.prioridad] ?? "bg-white/30"}`} title={`Prioridad ${PRIORIDAD_LABEL[proyecto.prioridad]}`} />
            <h1 className="font-coolvetica text-2xl sm:text-3xl text-white truncate">{proyecto.titulo}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-white/40">
            {proyecto.folio && <span>{proyecto.folio}</span>}
            {proyecto.tipo && <span>· {TIPO_PROY_LABEL[proyecto.tipo] ?? proyecto.tipo}</span>}
            <span>· {ESTADO_PROY_LABEL[proyecto.estado] ?? proyecto.estado}</span>
            {proyecto.contacto && <span>· {proyecto.contacto}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 bg-white/8 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={duplicar} disabled={duplicando} className="flex items-center gap-1.5 bg-white/8 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">
            <Copy size={13} /> Duplicar
          </button>
          {isAdmin && (
            <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg text-xs">
              <Trash2 size={13} /> Eliminar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/8 mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors ${tab === t.id ? "text-white" : "text-white/40 hover:text-white/70"}`}>
            {t.label}
            {tab === t.id && <motion.div layoutId="proyecto-tab-underline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-lgb-red" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
          {tab === "resumen" && <ResumenTab proyecto={proyecto} />}
          {tab === "tareas" && <TareasTab proyecto={proyecto} equipo={equipo} />}
          {tab === "cliente" && <ClienteVentaTab proyecto={proyecto} isAdmin={isAdmin} />}
          {tab === "contrato" && <ContratoTab proyecto={proyecto} />}
          {tab === "produccion" && <ProduccionTab proyecto={proyecto} />}
          {tab === "redes" && <RedesTab proyecto={proyecto} />}
          {tab === "drive" && <DriveTab proyectoId={proyecto.id} />}
          {tab === "actividad" && <ActividadTab actividad={proyecto.actividad} />}
        </motion.div>
      </AnimatePresence>

      <EditarProyectoModal open={editOpen} proyecto={proyecto} equipo={equipo} ventas={ventas} isAdmin={isAdmin} onClose={() => setEditOpen(false)} />
      <ConfirmCascadeDialog
        open={deleteOpen} proyectoId={proyecto.id} proyectoTitulo={proyecto.titulo}
        onClose={() => setDeleteOpen(false)}
        onConfirmed={() => { toast("✓ Proyecto eliminado"); router.push("/admin/produccion"); }}
      />
    </div>
  );
}
