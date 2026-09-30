"use client";
import { useCallback, useEffect, useState } from "react";
import { EdicionClave, envioVivo, type EstadoClave } from "./EdicionClave";
import { EdicionAlbum, type TemaEdicion } from "./EdicionAlbum";

type Respuesta =
  | ({ sinTabla: false; album: false } & EstadoClave)
  | { sinTabla: false; album: true; temas: TemaEdicion[] }
  | { sinTabla: true };

/**
 * Mandarle el proyecto a quien edita y cuantiza, y recibir sus revisiones.
 *
 * Un beat personalizado es UNA carpeta; un EP/álbum son tantas como temas, y
 * cada tema se manda por su lado (ver `EdicionAlbum`). Aquí sólo se decide cuál
 * de las dos se pinta y se mantiene fresco el estado.
 */
export function EdicionProyecto({ proyectoId, miId }: { proyectoId: string; miId: string | null }) {
  const [r, setR] = useState<Respuesta | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/edicion?proyecto_id=${proyectoId}`, { cache: "no-store" });
      setR(res.ok ? await res.json() : null);
    } catch { setR(null); }
  }, [proyectoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mientras algo sube, se vuelve a preguntar cada 20 s. No es tiempo real: son
  // cientos de filas cambiando y suscribirse a todas saturaría el canal para
  // pintar una barra que con esto ya se mueve bien.
  const claves: EstadoClave[] = !r || r.sinTabla ? [] : r.album ? r.temas : [r];
  const subiendo = claves.some((c) => envioVivo(c));
  useEffect(() => {
    if (!subiendo) return;
    const t = setInterval(cargar, 20_000);
    return () => clearInterval(t);
  }, [subiendo, cargar]);

  if (!r || r.sinTabla) return null;
  // Sin nada en el disco y sin envíos: el script todavía no ha visto la carpeta.
  if (!claves.some((c) => c.total || c.envios.length)) return null;

  if (r.album) return <EdicionAlbum proyectoId={proyectoId} temas={r.temas} miId={miId} recargar={cargar} />;
  return <EdicionClave proyectoId={proyectoId} tareaId={null} estado={r} miId={miId} recargar={cargar} />;
}
