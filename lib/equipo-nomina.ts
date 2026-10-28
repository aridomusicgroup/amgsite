/**
 * Alta en la nómina (`equipo`) de quien se da de alta en Ajustes → Equipo.
 *
 * Son dos listas distintas: `usuarios` dice quién ENTRA al panel y `equipo` es la
 * nómina, de donde salen los responsables de proyectos, tareas y cotizaciones y
 * a quién le llegan recordatorios y avisos. Dar de alta un usuario sólo escribía
 * en la primera, así que la persona nueva entraba al panel pero no se podía
 * elegir como responsable.
 *
 * Aquí se crea su fila como colaborador con pago 0, para no mover los números de
 * nómina ni el costo de operación. Nunca pisa ni reactiva una fila que ya existe:
 * la nómina tiene su propia historia (socios, pagos) y dar o quitar el acceso al
 * panel no decide quién está en ella.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type ResultadoNomina =
  | { estado: "creada" | "existente" }
  | { estado: "fallida"; error: string };

/** Nombre con el que entra a la nómina: el escrito, o uno armado con el correo. */
export function nombreParaNomina(nombre: string | null | undefined, email: string): string {
  const escrito = (nombre ?? "").trim();
  if (escrito) return escrito;
  const local = email.trim().split("@")[0] ?? "";
  const armado = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
  return armado || email.trim();
}

/**
 * Se asegura de que el correo tenga fila en `equipo`. Nunca lanza: si algo sale
 * mal lo devuelve como `fallida` para que el alta del acceso no se caiga por esto.
 */
export async function asegurarEnNomina(
  sb: SB,
  { email, nombre }: { email: string; nombre?: string | null },
): Promise<ResultadoNomina> {
  const correo = email.trim().toLowerCase();
  try {
    // La nómina es chica y `equipo.email` puede venir con otras mayúsculas o en
    // NULL: se compara aquí, exacto, en vez de un `ilike` donde `_` es comodín.
    const { data, error } = await sb.from("equipo").select("id, email");
    if (error) return { estado: "fallida", error: error.message };

    const yaEsta = ((data ?? []) as { email?: string | null }[])
      .some((f) => (f.email ?? "").trim().toLowerCase() === correo);
    if (yaEsta) return { estado: "existente" };

    const { error: errorInsertar } = await sb.from("equipo").insert({
      nombre: nombreParaNomina(nombre, correo),
      email: correo,
      rol: "colaborador",
      participacion_pct: 0,
      pago_base: 0,
      periodicidad: "semanal",
      pago_variable: false,
      activo: true,
      notas: "Alta desde Ajustes → Equipo.",
    });
    if (errorInsertar) return { estado: "fallida", error: errorInsertar.message };
    return { estado: "creada" };
  } catch (e) {
    return { estado: "fallida", error: e instanceof Error ? e.message : String(e) };
  }
}
