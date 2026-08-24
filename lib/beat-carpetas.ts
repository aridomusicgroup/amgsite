import driveLinks from "@/data/drive-links.json";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hijosDeCarpetas } from "@/lib/drive-api";
import { FORMATOS, type Formato } from "@/lib/beats-auditoria";

/**
 * De dónde sale la carpeta de Drive de un beat, y quién gana.
 *
 * Hay tres fuentes y este módulo fija el orden:
 *   1. `beat_carpetas` (asignada a mano desde el panel) ← SIEMPRE gana
 *   2. `beats.drive_folder_id`  (beats agregados desde el panel)
 *   3. `data/drive-links.json`  (los 52 originales, archivo del repo)
 *
 * El nivel 1 existe porque los otros dos se pueden equivocar y no había forma
 * de corregirlos: el JSON es de solo lectura en producción, y la carpeta de un
 * beat agregado se resolvía por nombre con una búsqueda muy floja —
 * `findBeatFolderByName` se quedaba con el PRIMER resultado que contuviera la
 * primera palabra del título, así que "EL CHICO TEMIDO" buscaba "EL" y se
 * enganchaba a cualquier carpeta. Se veía vinculada y apuntaba a otra cosa.
 */

export interface CarpetaBeat {
  driveFolderId: string;
  subfolders?: Record<string, string>;
}

const json = driveLinks as Record<string, CarpetaBeat>;

/** Carpeta original tal como quedó en el repo. */
export const carpetaDelRepo = (beatId: string): CarpetaBeat | undefined => json[beatId];

/**
 * Las carpetas corregidas a mano. Devuelve un mapa vacío si la tabla todavía no
 * existe, para que el panel siga funcionando antes de correr el SQL.
 */
export async function overridesCarpetas(): Promise<Map<string, CarpetaBeat>> {
  const out = new Map<string, CarpetaBeat>();
  try {
    const { data } = await supabaseAdmin()
      .from("beat_carpetas")
      .select("beat_id, drive_folder_id, drive_subfolders");
    for (const r of data ?? []) {
      const id = r.drive_folder_id as string;
      if (id) {
        out.set(r.beat_id as string, {
          driveFolderId: id,
          subfolders: (r.drive_subfolders as Record<string, string>) || undefined,
        });
      }
    }
  } catch {
    /* tabla aún no creada */
  }
  return out;
}

export const urlCarpeta = (folderId: string): string =>
  `https://drive.google.com/drive/folders/${folderId}`;

/** Saca el ID de carpeta de un link de Drive pegado, o de un ID suelto. */
export function idDeLink(input?: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) || s.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

export interface RevisionCarpeta {
  subfolders: Record<string, string>;
  archivos: Partial<Record<Formato, number>>;
  sueltos: number;
}

/**
 * Qué hay DE VERDAD dentro de una carpeta, ahora mismo.
 *
 * Lee las subcarpetas como Drive las reporta en este momento en vez de confiar
 * en lo guardado: si alguien renombró MP3 o la borró, lo guardado miente.
 */
export async function revisarCarpeta(folderId: string): Promise<RevisionCarpeta | null> {
  const hijos = await hijosDeCarpetas([folderId]);
  if (!hijos) return null;

  const subfolders: Record<string, string> = {};
  let sueltos = 0;
  for (const h of hijos) {
    if (!h.esCarpeta) {
      sueltos++;
      continue;
    }
    const n = h.name.trim().toUpperCase();
    if ((FORMATOS as readonly string[]).includes(n)) subfolders[n] = h.id;
  }

  const ids = Object.values(subfolders);
  const dentro = ids.length ? (await hijosDeCarpetas(ids)) ?? [] : [];
  const porSub = new Map<string, number>();
  for (const h of dentro) {
    if (h.esCarpeta) continue; // una carpeta dentro de MP3 no es un entregable
    porSub.set(h.padre, (porSub.get(h.padre) ?? 0) + 1);
  }

  const archivos: Partial<Record<Formato, number>> = {};
  for (const f of FORMATOS) {
    const idSub = subfolders[f];
    if (idSub) archivos[f] = porSub.get(idSub) ?? 0;
  }
  return { subfolders, archivos, sueltos };
}
