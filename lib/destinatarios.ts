/**
 * Destinatarios de un documento (cotización / contrato) que se manda por correo.
 *
 * Una sola fuente de verdad para la validación: el navegador usa `esEmail` para
 * avisar mientras se escribe, y el servidor vuelve a validar con `destinatariosDe`
 * porque la petición se puede armar a mano.
 */

/** Tope por envío: evita que un error de dedo convierta esto en un blast. */
export const MAX_DESTINATARIOS = 8;

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const esEmail = (v: string): boolean => RE_EMAIL.test(v.trim());

/** Parte un texto pegado ("a@b.com, c@d.com  e@f.com") en correos sueltos. */
export const partirCorreos = (texto: string): string[] =>
  texto.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);

/**
 * Arma la lista final: el correo del cliente (si tiene) más los adicionales que
 * haya escrito el equipo. Normaliza, valida y quita repetidos sin importar
 * mayúsculas para no mandar dos veces al mismo.
 */
export function destinatariosDe(
  clienteEmail: string | null,
  extra: unknown,
): { ok: string[]; malos: string[] } {
  const crudos = [clienteEmail ?? "", ...(Array.isArray(extra) ? extra.map(String) : [])];
  const vistos = new Set<string>();
  const ok: string[] = [];
  const malos: string[] = [];
  for (const c of crudos) {
    const e = c.trim();
    if (!e) continue;
    if (!esEmail(e)) { malos.push(e); continue; }
    const clave = e.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    ok.push(e);
  }
  return { ok: ok.slice(0, MAX_DESTINATARIOS), malos };
}
