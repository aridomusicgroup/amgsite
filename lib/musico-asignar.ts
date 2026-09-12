import "server-only";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const clave = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * La tarea "Grabar {instrumento}" de un proyecto normal (no los temas de un EP).
 *
 * Es el respaldo cuando quien asigna no sabe la tarea: el previo para músico de
 * una producción normal se manda al proyecto entero, sin tarea, y la
 * asignación nacía suelta — el músico sin fecha límite y la tarea sin decir
 * quién la graba (pasó en Alto Nivel).
 */
export async function tareaDeInstrumento(sb: SB, proyectoId: string, instrumento: string): Promise<string | null> {
  if (!instrumento.trim()) return null;
  try {
    const { data } = await sb.from("proyecto_tareas").select("id, titulo, es_cancion").eq("proyecto_id", proyectoId);
    const buscado = clave(`Grabar ${instrumento}`);
    const t = (data ?? []).find((x: { titulo: string; es_cancion?: boolean }) => !x.es_cancion && clave(String(x.titulo)) === buscado);
    return (t?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Le deja el trabajo en `/musico`, además del correo con el previo.
 *
 * Mandarle el previo y darle el trabajo en el portal son dos escrituras en dos
 * tablas distintas —`render_jobs` y `musico_asignaciones`— y cuando se
 * desincronizan no se rompe nada visible: el músico recibe su correo, entra al
 * portal y no encuentra nada. Por eso las dos formas de mandarle un previo
 * (renderizar uno nuevo, o reenviarle uno que ya existe) llaman a esto mismo.
 *
 * Sin `tareaId` (producción normal) se busca su tarea "Grabar {instrumento}",
 * y si ya tenía una asignación suelta en el proyecto se cuelga de ella en vez
 * de duplicarla.
 *
 * No usa `upsert` sobre el índice único porque ese índice es
 * `(musico_id, tarea_id)` y Postgres trata cada NULL como distinto.
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
    const tarea = tareaId ?? (await tareaDeInstrumento(sb, proyectoId, instrumento));
    const base = () => sb.from("musico_asignaciones").select("id")
      .eq("musico_id", musicoId).eq("proyecto_id", proyectoId);

    const { data: ya } = await (tarea ? base().eq("tarea_id", tarea) : base().is("tarea_id", null)).maybeSingle();
    if (ya) return true;   // ya lo tenía: no es error

    if (tarea) {
      const { data: suelta } = await base().is("tarea_id", null).maybeSingle();
      if (suelta) {
        const { error } = await sb.from("musico_asignaciones").update({ tarea_id: tarea }).eq("id", suelta.id);
        return !error;
      }
    }

    const { error } = await sb.from("musico_asignaciones").insert({
      musico_id: musicoId, proyecto_id: proyectoId, tarea_id: tarea,
      instrumento, nota, creado_por: actor,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Al crear la venta, le habilita el proyecto en `/musico` a quien tenga portal,
 * colgado de su tarea "Grabar {instrumento}" para que vea la fecha límite.
 *
 * NO se les manda correo aquí: el aviso sale cuando se les manda su previo
 * desde REAPER, que es cuando ya tienen sobre qué grabar.
 *
 * `porInstrumento` es el mapa que devuelve `crearTareasDeProyecto` (la vía
 * buena); sin él se busca la tarea por su título.
 */
export async function habilitarPortal(
  sb: SB,
  proyectoId: string,
  elegidos: { instrumento: string; musico_id: string }[],
  porInstrumento?: Map<string, string>,
  actor = "venta",
): Promise<void> {
  try {
    const { data: musicos } = await sb.from("musicos").select("id, portal_activo").in("id", elegidos.map((e) => e.musico_id));
    const conPortal = new Set(
      (musicos ?? []).filter((m: { portal_activo?: boolean }) => m.portal_activo).map((m: { id: string }) => m.id),
    );
    for (const e of elegidos) {
      if (!conPortal.has(e.musico_id)) continue;
      await asignarEnPortal(sb, proyectoId, porInstrumento?.get(e.instrumento) ?? null, e.musico_id, e.instrumento, actor);
    }
  } catch {
    /* best-effort: la venta y el proyecto ya quedaron; se asigna a mano desde la tarea */
  }
}
