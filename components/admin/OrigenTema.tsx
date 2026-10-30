"use client";
import { useMemo, type ReactNode } from "react";
import { herenciaReaper } from "@/lib/mezcla-voces";
import type { ProyectoTema } from "@/lib/cotizaciones-data";

/**
 * "¿De qué tema es?": el selector del proyecto que produjimos y al que se liga
 * una cotización (un diseño, una mezcla de voces). Los del cliente primero:
 * casi siempre es una canción suya.
 */
export function OrigenTemaSelect({
  proyectos, contactoId, value, onChange, pregunta, vacio,
}: {
  proyectos: ProyectoTema[];
  contactoId: string | null;
  value: string;
  onChange: (id: string) => void;
  pregunta: ReactNode;
  /** Texto de la opción sin tema. */
  vacio: string;
}) {
  const { suyos, otros } = useMemo(() => {
    const suyos = contactoId ? proyectos.filter((p) => p.contacto_id === contactoId) : [];
    const ids = new Set(suyos.map((p) => p.id));
    return { suyos, otros: proyectos.filter((p) => !ids.has(p.id)) };
  }, [proyectos, contactoId]);

  const etiqueta = (p: ProyectoTema, conCliente: boolean) =>
    `${p.folio ?? "—"} · ${p.titulo}${conCliente && p.cliente ? ` (${p.cliente})` : ""}`;

  return (
    <label className="block mt-2">
      <span className="text-white/60 text-xs">{pregunta}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input cursor-pointer mt-1">
        <option value="">{vacio}</option>
        {suyos.length > 0 && (
          <optgroup label="De este cliente">
            {suyos.map((p) => <option key={p.id} value={p.id}>{etiqueta(p, false)}</option>)}
          </optgroup>
        )}
        <optgroup label={suyos.length ? "Otros proyectos" : "Proyectos"}>
          {otros.map((p) => <option key={p.id} value={p.id}>{etiqueta(p, true)}</option>)}
        </optgroup>
      </select>
    </label>
  );
}

/**
 * Lo de la mezcla de voces dentro del modal de cotización: de qué tema son las
 * voces, y si el proyecto nuevo va a trabajar en la MISMA sesión de REAPER.
 *
 * El aviso usa la misma regla que aplica el servidor al crear el proyecto
 * (`herenciaReaper`), para que lo que se lee aquí sea lo que va a pasar.
 */
export function MezclaVocesCotizacion({
  proyectos, contactoId, origenId, onOrigen,
}: {
  proyectos: ProyectoTema[];
  contactoId: string | null;
  origenId: string;
  onOrigen: (id: string) => void;
}) {
  const origen = origenId ? proyectos.find((p) => p.id === origenId) ?? null : null;
  const comparte = origen
    ? herenciaReaper(
        { tipo: origen.tipo ?? null, titulo: origen.titulo, reaper_carpeta: null, contacto_id: origen.contacto_id },
        contactoId,
        (s) => s,
      ) !== null
    : false;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] font-medium text-white/70">Mezcla de voces</p>
      <OrigenTemaSelect
        proyectos={proyectos} contactoId={contactoId} value={origenId} onChange={onOrigen}
        pregunta={<>¿De qué tema son las voces? <span className="text-white/45">(si lo produjimos)</span></>}
        vacio="No lo produjimos / sin tema"
      />
      {!origen ? (
        <p className="text-white/45 text-xs mt-1.5">Sin tema de origen, el proyecto nace con su propia carpeta de REAPER.</p>
      ) : comparte ? (
        <p className="text-green-300 text-xs font-medium mt-1.5">
          Se mezcla en la sesión de REAPER de {origen.titulo}: el proyecto nuevo queda ligado a él y no crea otra carpeta.
        </p>
      ) : (
        <p className="text-amber-300 text-xs font-medium mt-1.5">
          {contactoId
            ? "Ese tema es de otro cliente o es un EP/álbum: no puede compartir su sesión, el proyecto nace con su propia carpeta."
            : "Elige al cliente de la lista para compartir la sesión de ese tema."}
        </p>
      )}
    </div>
  );
}
