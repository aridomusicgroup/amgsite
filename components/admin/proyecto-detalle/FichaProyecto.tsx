"use client";
import type { ReactNode } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { PRIORIDAD_LABEL, TIPO_PROY_LABEL, type ProyectoDetalle } from "@/lib/erp-data";
import { EDAD_ALERTA, EDAD_AVISO, PRIOR_DOT, edadDe, esContenidoPub, llevaFicha } from "@/components/admin/ProduccionBoard";

const fecha = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : null;

const esUrl = (s: string) => /^https?:\/\//i.test(s.trim());

/** Un dato de la ficha: etiqueta chica arriba, valor abajo. `ancho` ocupa las dos columnas. */
function Dato({ label, ancho, children }: { label: string; ancho?: boolean; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${ancho ? "sm:col-span-2" : ""}`}>
      <p className="text-[11px] font-medium text-white/35 mb-1">{label}</p>
      <div className="text-sm text-white/80 break-words">{children}</div>
    </div>
  );
}

const Vacio = ({ texto = "—" }: { texto?: string }) => <span className="text-white/25">{texto}</span>;

/** Enlace externo solo si de verdad es http(s): el campo es texto libre y no se debe armar un href con cualquier cosa. */
function Enlace({ url, texto }: { url: string; texto?: string }) {
  if (!esUrl(url)) return <>{url}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline inline-flex items-center gap-1 break-all">
      {texto ?? url} <ExternalLink size={12} className="shrink-0" />
    </a>
  );
}

/**
 * Todas las características del proyecto en un solo lugar.
 *
 * Antes solo se veían dentro de la ventana "Editar": responsables, prioridad,
 * fecha de entrega, link de entregables, tonalidad/BPM/compás, brief y venta
 * ligada. Entrabas al proyecto y no estaban en ninguna pestaña, así que había
 * que abrir el formulario nada más para leerlas. Aquí se leen directo, y el
 * lápiz abre ese mismo formulario (un solo editor, no una copia).
 */
export function FichaProyecto({ proyecto: p, ventaLabel, isAdmin, onEditar }: {
  proyecto: ProyectoDetalle;
  /** Texto de la venta ligada (solo lo trae el admin; para los demás no hay ventas). */
  ventaLabel: string | null;
  isAdmin: boolean;
  onEditar: () => void;
}) {
  const abierto = !["entregado", "cerrado", "cancelado"].includes(p.estado);
  const edad = abierto ? edadDe(p) : null;
  const esEpAlbum = p.tipo === "ep" || p.tipo === "album";
  const conMusica = llevaFicha(p.clase, p.tipo);
  const publicacion = esContenidoPub(p.tipo);
  const hayBriefUrl = !!p.brief && esUrl(p.brief);

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <p className="text-[11px] text-white/35 uppercase tracking-wider">Ficha del proyecto</p>
        <button onClick={onEditar} title="Editar estos datos"
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors">
          <Pencil size={12} /> Editar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
        <Dato label="Responsables" ancho>
          {p.responsablesNombres.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {p.responsablesNombres.map((n) => (
                <span key={n} className="px-2 py-0.5 rounded-full bg-white/5 text-white/70 text-xs">{n}</span>
              ))}
            </div>
          ) : <Vacio texto="Sin asignar" />}
        </Dato>

        <Dato label="Clase">{p.clase === "produccion" ? "Producción (cliente)" : "Tarea interna"}</Dato>
        <Dato label="Tipo">{p.tipo ? (TIPO_PROY_LABEL[p.tipo] ?? p.tipo) : <Vacio texto="Sin tipo" />}</Dato>

        <Dato label="Prioridad">
          <span className="inline-flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIOR_DOT[p.prioridad] ?? "bg-white/30"}`} />
            {PRIORIDAD_LABEL[p.prioridad] ?? p.prioridad}
          </span>
        </Dato>

        <Dato label="Entrega">
          {fecha(p.fecha_entrega) ?? <Vacio texto="Sin fecha" />}
          {edad !== null && (
            <span
              className={`ml-2 text-xs ${edad >= EDAD_ALERTA ? "text-red-400" : edad >= EDAD_AVISO ? "text-amber-300" : "text-white/40"}`}
              title={`Lleva ${edad} días abierto ${p.fechaVenta ? "desde la venta" : "desde que se creó"}`}>
              · lleva {edad} {edad === 1 ? "día" : "días"} abierto
            </span>
          )}
        </Dato>

        {conMusica && (
          <div className="sm:col-span-2 grid grid-cols-3 gap-x-6">
            <Dato label="Tonalidad">{p.tonalidad || <Vacio />}</Dato>
            <Dato label="BPM">{p.bpm != null ? p.bpm : <Vacio />}</Dato>
            <Dato label="Compás">{p.compas || <Vacio />}</Dato>
          </div>
        )}
        {esEpAlbum && (
          <p className="sm:col-span-2 text-[11px] text-white/35">
            Tonalidad, BPM y compás van en cada canción: ábrela en la pestaña Tareas.
          </p>
        )}

        <Dato label="Link entregables" ancho>
          {p.entregable_url ? <Enlace url={p.entregable_url} /> : <Vacio />}
        </Dato>

        {p.drive_folder_id && (
          <Dato label="Archivos del cliente" ancho>
            <Enlace url={`https://drive.google.com/drive/folders/${p.drive_folder_id}`} texto="Carpeta de Drive" />
          </Dato>
        )}

        {isAdmin && p.clase === "produccion" && (
          <Dato label="Venta ligada" ancho>
            {ventaLabel ?? <Vacio texto="Sin venta ligada" />}
          </Dato>
        )}

        {publicacion && (
          <>
            <Dato label="Plataforma">{p.plataforma || <Vacio />}</Dato>
            <Dato label="Fecha de publicación">{fecha(p.fecha_publicacion) ?? <Vacio />}</Dato>
            <Dato label="Link del post" ancho>
              {p.link_post ? <Enlace url={p.link_post} /> : <Vacio />}
            </Dato>
          </>
        )}

        <Dato label="Brief / notas" ancho>
          {p.brief ? (hayBriefUrl ? <Enlace url={p.brief} /> : p.brief) : <Vacio texto="Sin brief" />}
        </Dato>

        {p.notas && <Dato label="Notas" ancho>{p.notas}</Dato>}
      </div>
    </div>
  );
}
