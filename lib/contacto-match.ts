import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Une o crea el contacto (CRM) a partir de datos del cliente. Mismo criterio que
 * usan Ventas y Producción: email → teléfono → nombre. Rellena huecos (dirección,
 * email, teléfono) sin pisar lo que ya haya. Devuelve el id del contacto o null.
 */
const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const tel10 = (s: string) => String(s || "").replace(/\D/g, "").slice(-10);

export interface ClienteInput {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  canal?: string | null;
}

interface ContactoFila {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
}

/** El contacto que ya existe con ese correo, teléfono o nombre (en ese orden). */
export async function buscarContacto(sb: SupabaseClient, cli: ClienteInput): Promise<ContactoFila | null> {
  const nombre = (cli.nombre || "").trim();
  const email = (cli.email || "").trim().toLowerCase();
  const t10 = tel10((cli.telefono || "").trim());
  if (!nombre && !email && !t10) return null;

  const { data: existentes } = await sb
    .from("contactos")
    .select("id, nombre, email, telefono, direccion")
    .is("merged_into", null);
  const list = (existentes ?? []) as ContactoFila[];
  return (
    (email && list.find((c) => c.email && String(c.email).toLowerCase() === email)) ||
    (t10.length === 10 && list.find((c) => c.telefono && tel10(c.telefono) === t10)) ||
    (nombre && list.find((c) => c.nombre && norm(c.nombre) === norm(nombre))) ||
    null
  );
}

export async function matchOrCreateContacto(
  sb: SupabaseClient,
  cli: ClienteInput
): Promise<string | null> {
  const nombre = (cli.nombre || "").trim();
  const email = (cli.email || "").trim().toLowerCase();
  const telefono = (cli.telefono || "").trim();
  const direccion = (cli.direccion || "").trim();
  if (!nombre && !email && !telefono) return null;

  const match = await buscarContacto(sb, cli);

  if (match) {
    const patch: Record<string, string> = {};
    if (email && !match.email) patch.email = email;
    if (telefono && !match.telefono) patch.telefono = telefono;
    if (direccion && !match.direccion) patch.direccion = direccion;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await sb.from("contactos").update(patch).eq("id", match.id);
    }
    return match.id as string;
  }

  const { data: nuevo, error } = await sb
    .from("contactos")
    .insert({
      nombre: nombre || null,
      email: email || null,
      telefono: telefono || null,
      direccion: direccion || null,
      etapa: "lead",
      origen: cli.canal || null,
    })
    .select("id")
    .single();
  if (error) return null;
  return (nuevo?.id as string) ?? null;
}

/**
 * El contacto al que se liga una cotización. Si el navegador manda uno, se
 * respeta SALVO que sea evidentemente otra persona: otro nombre Y otro correo
 * (los dos presentes y distintos). Pasó con COT-0093: se eligió a un cliente
 * de la lista, se retocó el nombre y el correo, y el id viejo se quedó pegado,
 * así que la cotización terminó ligada al cliente equivocado.
 */
export async function resolverContacto(
  sb: SupabaseClient,
  cli: ClienteInput & { contactoId?: string | null },
): Promise<string | null> {
  const id = (cli.contactoId || "").trim();
  if (id) {
    const { data: c } = await sb.from("contactos").select("id, nombre, email, direccion").eq("id", id).maybeSingle();
    if (c) {
      const email = (cli.email || "").trim().toLowerCase();
      const otroNombre = !!cli.nombre && !!c.nombre && norm(cli.nombre) !== norm(c.nombre as string);
      const otroCorreo = !!email && !!c.email && email !== String(c.email).toLowerCase();
      if (!(otroNombre && otroCorreo)) {
        const direccion = (cli.direccion || "").trim();
        if (direccion && !c.direccion) {
          await sb.from("contactos").update({ direccion, updated_at: new Date().toISOString() }).eq("id", id);
        }
        return id;
      }
    }
  }
  return matchOrCreateContacto(sb, cli);
}
