import "server-only";
import { buscarOCrearCarpeta, carpetaExiste } from "@/lib/drive-oauth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Resuelve (creando si falta) la carpeta de Drive de un proyecto:
 * "Clientes ARIDO" → "{cliente} — {id corto}" → "{folio} — {título}".
 *
 * Guarda el resultado en `contactos.drive_folder_id` / `proyectos.drive_folder_id`
 * para no tener que rehacer la búsqueda cada vez — mismo criterio que
 * `beat_carpetas`. Devuelve `null` si la integración de Drive no está
 * configurada (sin OAuth conectado todavía) — el que llama decide qué hacer.
 *
 * El id cacheado se COMPRUEBA antes de usarlo. Confiar en él a ciegas dejó al
 * cliente Alfred sin poder subir nada: alguien borró su carpeta en Drive, el id
 * viejo se siguió devolviendo, y crear la carpeta del proyecto dentro de un
 * padre muerto daba 404 sin manera de recuperarse. Si el id ya no vive se
 * reconstruye desde arriba y se vuelve a guardar.
 */
export async function carpetaDelProyecto(sb: SB, proyectoId: string): Promise<string | null> {
  const { data: proy } = await sb
    .from("proyectos")
    .select("id, folio, titulo, contacto_id, drive_folder_id")
    .eq("id", proyectoId)
    .single();
  if (!proy) return null;
  if (proy.drive_folder_id && (await carpetaExiste(proy.drive_folder_id as string))) {
    return proy.drive_folder_id as string;
  }
  if (!proy.contacto_id) return null;

  const carpetaCliente = await carpetaDelCliente(sb, proy.contacto_id as string);
  if (!carpetaCliente) return null;

  const nombreProyecto = `${proy.folio ?? "SIN-FOLIO"} — ${proy.titulo ?? "Producción"}`.slice(0, 120);
  const carpetaProyecto = await buscarOCrearCarpeta(nombreProyecto, carpetaCliente);
  if (!carpetaProyecto) return null;

  await sb.from("proyectos").update({ drive_folder_id: carpetaProyecto }).eq("id", proyectoId);
  return carpetaProyecto;
}

async function carpetaRaiz(): Promise<string | null> {
  const fijo = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (fijo) return fijo;
  return buscarOCrearCarpeta("Clientes ARIDO", "root");
}

async function carpetaDelCliente(sb: SB, contactoId: string): Promise<string | null> {
  const { data: c } = await sb.from("contactos").select("id, nombre, email, drive_folder_id").eq("id", contactoId).single();
  if (!c) return null;
  // Igual que arriba: el id guardado puede apuntar a una carpeta ya borrada.
  if (c.drive_folder_id && (await carpetaExiste(c.drive_folder_id as string))) {
    return c.drive_folder_id as string;
  }

  const raiz = await carpetaRaiz();
  if (!raiz) return null;

  const nombre = `${(c.nombre as string) || (c.email as string) || "Cliente"} — ${contactoId.slice(0, 8)}`;
  const carpeta = await buscarOCrearCarpeta(nombre, raiz);
  if (!carpeta) return null;

  await sb.from("contactos").update({ drive_folder_id: carpeta }).eq("id", contactoId);
  return carpeta;
}
