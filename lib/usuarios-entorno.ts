/**
 * Quién viene de las variables de entorno de Vercel.
 *
 * `ADMIN_EMAILS`, `CRM_EMAILS` y `PRODUCCION_EMAILS` son el respaldo del acceso:
 * quien está en ellas se vuelve a crear en `usuarios` (activo) al abrir Ajustes y
 * al entrar al panel. Por eso borrarlo con la X no lo quita: reaparece. Aquí se
 * detecta ese caso para avisar en vez de aparentar que se quitó.
 */

export type VariableAcceso = "ADMIN_EMAILS" | "CRM_EMAILS" | "PRODUCCION_EMAILS";

/** En el mismo orden en que `seedUsuariosFromEnv` las recorre. */
const VARIABLES: VariableAcceso[] = ["ADMIN_EMAILS", "CRM_EMAILS", "PRODUCCION_EMAILS"];

const limpiar = (e: string): string => e.trim().toLowerCase();

/** En qué variables de entorno está el correo (vacío si en ninguna). */
export function variablesDelEntorno(
  email: string,
  env: Record<string, string | undefined> = process.env,
): VariableAcceso[] {
  const correo = limpiar(email);
  if (!correo) return [];
  return VARIABLES.filter((variable) =>
    (env[variable] ?? "").split(",").some((e) => limpiar(e) === correo),
  );
}

/** Texto para quien intenta quitar a alguien que viene del entorno. */
export function avisoEnEntorno(email: string, variables: VariableAcceso[]): string {
  const donde = variables.length > 1
    ? `las variables ${variables.slice(0, -1).join(", ")} y ${variables[variables.length - 1]}`
    : `la variable ${variables[0]}`;
  return (
    `${email} está en ${donde} de Vercel, por eso se vuelve a crear al quitarlo.\n\n` +
    `Para sacarlo: ponlo Inactivo (botón "Activo" de su fila), o quita su correo de esa variable en Vercel y haz redeploy.`
  );
}
