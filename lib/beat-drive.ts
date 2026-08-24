import driveLinks from "@/data/drive-links.json";
import rawBeats from "@/data/beats-beatstars.json";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { overridesCarpetas } from "@/lib/beat-carpetas";

const links = driveLinks as Record<
  string,
  { driveFolderId: string; subfolders?: Record<string, string> }
>;
const catalog = rawBeats as Array<{ id: string; title: string }>;

export interface BeatMeta {
  title: string;
  driveFolderId?: string;
  subfolders?: Record<string, string>;
}

/**
 * Resuelve título + carpeta de Drive de un beat por ID, buscando en:
 *  - los 53 originales (beats-beatstars.json + drive-links.json)
 *  - los agregados desde el admin (tabla `beats` de Supabase)
 */
export async function getBeatMeta(beatId: string): Promise<BeatMeta | null> {
  // La carpeta asignada a mano gana sobre todo lo demás: es la corrección que
  // alguien hizo a propósito porque lo automático estaba mal.
  const manual = (await overridesCarpetas()).get(beatId);

  const cat = catalog.find((b) => b.id === beatId);
  const j = manual ?? links[beatId];
  if (cat || j) {
    return { title: cat?.title ?? "", driveFolderId: j?.driveFolderId, subfolders: j?.subfolders };
  }
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("beats")
      .select("title, drive_folder_id, drive_subfolders")
      .eq("id", beatId)
      .maybeSingle();
    if (data) {
      return {
        title: (data.title as string) ?? "",
        driveFolderId: manual?.driveFolderId ?? ((data.drive_folder_id as string) || undefined),
        subfolders: manual?.subfolders ?? ((data.drive_subfolders as Record<string, string>) || undefined),
      };
    }
  } catch {
    /* sin DB */
  }
  return null;
}
