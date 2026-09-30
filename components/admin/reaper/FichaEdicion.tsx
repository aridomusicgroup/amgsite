"use client";
import { useCallback, useEffect, useState } from "react";
import { Grid3x3 } from "lucide-react";
import { EdicionClave, envioVivo, mandarAEdicion, type EstadoClave } from "../proyecto-detalle/EdicionClave";
import type { TemaEdicion } from "../proyecto-detalle/EdicionAlbum";
import type { RenderJob } from "@/lib/render-jobs";
import { Fila, Seccion, EstadoJob, fecha } from "./ficha-ui";

type Respuesta =
  | ({ sinTabla: false; album: false } & EstadoClave)
  | { sinTabla: false; album: true; temas: TemaEdicion[] }
  | { sinTabla: true };

/** Cómo va el envío de ESTA carpeta, con los datos del tema si es de un EP. */
export type EdicionDeClave = (EstadoClave & { falta?: string[]; editado?: boolean | null }) | null;

/**
 * El envío a edición de esta carpeta, leído de la misma API que usa la ficha
 * del proyecto. En un EP la API contesta por TEMA; aquí sólo interesa el tema
 * de esta ficha. `undefined` = cargando; `null` = no hay tablas o no hay nada.
 */
export function useEdicion(proyectoId: string, tareaId: string | null) {
  const [estado, setEstado] = useState<EdicionDeClave | undefined>(undefined);

  const leer = useCallback(async (): Promise<EdicionDeClave> => {
    try {
      const res = await fetch(`/api/admin/edicion?proyecto_id=${proyectoId}`, { cache: "no-store" });
      if (!res.ok) return null;
      const r = (await res.json()) as Respuesta;
      if (r.sinTabla) return null;
      return r.album ? r.temas.find((t) => t.tareaId === tareaId) ?? null : r;
    } catch { return null; }
  }, [proyectoId, tareaId]);

  const cargar = useCallback(async () => { setEstado(await leer()); }, [leer]);

  useEffect(() => {
    let vivo = true;
    leer().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, [leer]);

  // Mientras algo sube, se vuelve a preguntar cada 20 s (igual que en la ficha
  // del proyecto): son cientos de filas cambiando, no vale la pena el tiempo real.
  const subiendo = Boolean(estado && envioVivo(estado));
  useEffect(() => {
    if (!subiendo) return;
    const t = setInterval(cargar, 20_000);
    return () => clearInterval(t);
  }, [subiendo, cargar]);

  return { estado, cargar };
}

/** Una frase para el cuadro de resumen. */
export function resumenEdicion(e: EdicionDeClave | undefined): { txt: string; sub: string; tono: "ok" | "pend" | "nada" } {
  if (e === undefined) return { txt: "…", sub: "cargando", tono: "nada" };
  if (!e || (!e.total && !e.envios.length)) return { txt: "Sin material", sub: "la PC aún no ve la carpeta", tono: "nada" };
  if (e.editado) return { txt: "Editado", sub: "“Editar y cuantizar” palomeado", tono: "ok" };
  const vivo = envioVivo(e);
  if (vivo) {
    const pct = e.total ? Math.round((e.subidos / e.total) * 100) : 0;
    return { txt: vivo.estado === "abierto" ? "En fila" : `Subiendo ${pct}%`, sub: `envío ${vivo.num}`, tono: "pend" };
  }
  const rev = e.revisiones[0];
  if (rev) return { txt: `rev-${String(rev.num).padStart(2, "0")} de vuelta`, sub: fecha(rev.subido_at), tono: "ok" };
  const ultimo = e.envios[0];
  if (ultimo?.estado === "listo") {
    return { txt: "Material subido", sub: e.pendientes ? `${e.pendientes} archivo(s) nuevo(s) sin mandar` : `envío ${ultimo.num} · ${fecha(ultimo.creado_at)}`, tono: "ok" };
  }
  return { txt: "Sin enviar", sub: `${e.total} archivo(s) listos para mandar`, tono: "pend" };
}

/**
 * Lo de edición de esta carpeta: el material que se le subió a quien cuantiza
 * (reusa `EdicionClave` tal cual, con su botón de enviar y sus revisiones) y
 * los "Cuadrar a la rejilla" que se han pedido desde REAPER.
 */
export function FichaEdicion({ proyectoId, tareaId, titulo, estado, recargar, cuadrar, miId }: {
  proyectoId: string;
  tareaId: string | null;
  titulo: string;
  estado: EdicionDeClave | undefined;
  recargar: () => Promise<void>;
  cuadrar: RenderJob[];
  miId: string | null;
}) {
  // En un tema de EP se pregunta si le falta algo antes de mandarlo, igual que
  // en el renglón del tema en la ficha del proyecto.
  const enviarTema = async () => {
    const falta = estado?.falta ?? [];
    if (falta.length && !confirm(`A “${titulo}” todavía le falta:\n· ${falta.join("\n· ")}\n\n¿Mandarlo a editar así?`)) return;
    const nota = prompt(`“${titulo}” — ¿algo que decirle? (opcional)\nEj: ya con las charchetas de Martín`);
    if (nota === null) return;
    if (await mandarAEdicion({ proyecto_id: proyectoId, tarea_id: tareaId, nota })) await recargar();
  };

  const vacio = estado !== undefined && (!estado || (!estado.total && !estado.envios.length));

  return (
    <Seccion id="edicion" titulo="Edición y cuantizar">
      {estado === undefined ? (
        <p className="text-xs text-white/30">Cargando…</p>
      ) : vacio ? (
        <p className="text-xs text-white/35">
          El script de la PC todavía no ha visto archivos en esta carpeta, así que no hay material para mandar a editar.
        </p>
      ) : (
        <>
          {estado?.falta && estado.falta.length > 0 && !estado.editado && (
            <p className="text-[11px] text-amber-300/80 mb-2">Antes de editar falta: {estado.falta.join(", ")}</p>
          )}
          <EdicionClave
            proyectoId={proyectoId}
            tareaId={tareaId}
            titulo={titulo}
            estado={estado!}
            miId={miId}
            recargar={recargar}
            onEnviar={tareaId ? enviarTema : undefined}
          />
        </>
      )}

      {cuadrar.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">Cuadrar a la rejilla</p>
          <div className="space-y-1.5">
            {cuadrar.map((j) => (
              <Fila key={j.id} icono={<Grid3x3 size={14} />} titulo="Proyecto “… AUTO.rpp”" detalle={fecha(j.createdAt)}>
                <EstadoJob job={j} />
              </Fila>
            ))}
          </div>
        </div>
      )}
    </Seccion>
  );
}
