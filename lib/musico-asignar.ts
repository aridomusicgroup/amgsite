import "server-only";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Le deja el trabajo en `/musico`, además del correo con el previo.
 *
 * Mandarle el previo y darle el trabajo en el portal son dos escrituras en dos
 * tablas distintas —`render_jobs` y `musico_asignaciones`— y cuando se
 * desincronizan no se rompe nada visible: el músico recibe su correo, entra al
 * portal y no encuentra nada. Por eso las dos formas de mandarle un previo
 * (renderizar uno nuevo, o reenviarle uno que ya existe) llaman a esto mismo.
 *
 * No usa `upsert` sobre el índice único porque ese índice es
 * `(musico_id, tarea_id)` y Postgres trata cada NULL como distinto: en un
 * proyecto sin canción (`tarea_id` null) mandar el previo dos veces habría
 * creado dos asignaciones y el músico vería la misma canción duplicada.
 *
 * Es best-effort a propósito y devuelve un booleano en vez de lanzar: quien lo
 * llama ya mandó el previo, y eso no se deshace. Pero el resultado **hay que
 * decirlo en pantalla** — que un `false` pasara callado es justo lo que dejó
 * esta mitad rota durante semanas sin que nadie lo notara.
 */
export async function asignarEnPortal(
  sb: SB,
  proyectoId: string,
  tareaId: string | null,
  musicoId: string,
  instrumento: string,
  actor: string,
  nota: string | null = null,
): Promise<boolean> {
  try {
    const q = sb.from("musico_asignaciones").select("id")
      .eq("musico_id", musicoId).eq("proyecto_id", proyectoId);
    const { data: ya } = await (tareaId ? q.eq("tarea_id", tareaId) : q.is("tarea_id", null)).maybeSingle();
    if (ya) return true;   // ya lo tenía: no es error

    const { error } = await sb.from("musico_asignaciones").insert({
      musico_id: musicoId, proyecto_id: proyectoId, tarea_id: tareaId,
      instrumento, nota, creado_por: actor,
    });
    return !error;
  } catch {
    return false;
  }
}
