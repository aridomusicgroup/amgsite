import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hijosDeCarpetas, driveConfigured, cuentaServicioEmail } from "@/lib/drive-api";
import { overridesCarpetas } from "@/lib/beat-carpetas";
import { evaluar, resumir, porUrgencia, FORMATOS, type Formato, type BeatAuditado } from "@/lib/beats-auditoria";
import driveLinks from "@/data/drive-links.json";
import rawBeats from "@/data/beats-beatstars.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const links = driveLinks as Record<string, { driveFolderId: string; subfolders?: Record<string, string> }>;
const catalogo = rawBeats as Array<{ id: string; title: string }>;

/**
 * ¿Qué beats se pueden entregar HOY y cuáles no?
 *
 * Corre en el servidor porque la cuenta de servicio de Google vive aquí. Va en
 * DOS pasadas por lotes en vez de carpeta por carpeta: 55 beats × 4 consultas
 * serían cientos de llamadas a Google, lentas y con riesgo de que corte por
 * límite de tasa. Así son unas veinte.
 *
 * Solo LEE: no crea, mueve ni borra nada en Drive.
 */
export async function GET() {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!driveConfigured()) {
    return NextResponse.json({ error: "Falta configurar la cuenta de servicio de Google (GOOGLE_SERVICE_ACCOUNT)." }, { status: 503 });
  }

  // ── Junta los dos orígenes del catálogo ────────────────────────────────
  // Encima de ambos manda `beat_carpetas`: la carpeta asignada a mano.
  const manual = await overridesCarpetas();

  type Base = { id: string; title: string; origen: "original" | "agregado"; carpeta: string | null; subs: Record<string, string> };
  const bases: Base[] = catalogo.map((b) => ({
    id: b.id,
    title: b.title,
    origen: "original" as const,
    carpeta: manual.get(b.id)?.driveFolderId ?? links[b.id]?.driveFolderId ?? null,
    subs: manual.get(b.id)?.subfolders ?? links[b.id]?.subfolders ?? {},
  }));

  try {
    const { data } = await supabaseAdmin().from("beats").select("id, title, drive_folder_id, drive_subfolders");
    for (const b of data ?? []) {
      const id = b.id as string;
      bases.push({
        id,
        title: (b.title as string) ?? "",
        origen: "agregado",
        carpeta: manual.get(id)?.driveFolderId ?? ((b.drive_folder_id as string) || null),
        subs: manual.get(id)?.subfolders ?? ((b.drive_subfolders as Record<string, string>) || {}),
      });
    }
  } catch { /* sin base: se audita al menos el catálogo original */ }

  // ── Pasada 1: qué hay dentro de cada carpeta de beat ────────────────────
  const carpetas = bases.map((b) => b.carpeta).filter((x): x is string => !!x);
  const hijos = await hijosDeCarpetas(carpetas);
  if (!hijos) return NextResponse.json({ error: "No se pudo autenticar con Google Drive." }, { status: 503 });

  // Subcarpetas por beat: se toman las que Drive reporta AHORA, no las que
  // quedaron guardadas — si alguien renombró o borró una, el guardado miente.
  const subsPorCarpeta = new Map<string, Record<string, string>>();
  const sueltosPorCarpeta = new Map<string, number>();
  for (const h of hijos) {
    if (h.esCarpeta) {
      const n = h.name.trim().toUpperCase();
      if ((FORMATOS as readonly string[]).includes(n)) {
        subsPorCarpeta.set(h.padre, { ...(subsPorCarpeta.get(h.padre) ?? {}), [n]: h.id });
      }
    } else {
      sueltosPorCarpeta.set(h.padre, (sueltosPorCarpeta.get(h.padre) ?? 0) + 1);
    }
  }

  // ── Pasada 2: cuántos archivos hay dentro de cada subcarpeta ────────────
  const idsSub: string[] = [];
  for (const subs of subsPorCarpeta.values()) idsSub.push(...Object.values(subs));
  const hijosSub = idsSub.length ? (await hijosDeCarpetas(idsSub)) ?? [] : [];
  const archivosPorSub = new Map<string, number>();
  for (const h of hijosSub) {
    if (h.esCarpeta) continue; // una subcarpeta dentro de MP3 no es un entregable
    archivosPorSub.set(h.padre, (archivosPorSub.get(h.padre) ?? 0) + 1);
  }

  // ── Veredicto por beat ──────────────────────────────────────────────────
  const beats: BeatAuditado[] = bases.map((b) => {
    const subs = b.carpeta ? subsPorCarpeta.get(b.carpeta) ?? {} : {};
    const archivos: Partial<Record<Formato, number>> = {};
    for (const f of FORMATOS) {
      const idSub = subs[f];
      if (idSub) archivos[f] = archivosPorSub.get(idSub) ?? 0;
    }
    return evaluar(
      {
        id: b.id,
        title: b.title,
        origen: b.origen,
        tieneCarpeta: !!b.carpeta,
        carpetaId: b.carpeta,
        manual: manual.has(b.id),
      },
      archivos,
      b.carpeta ? sueltosPorCarpeta.get(b.carpeta) ?? 0 : 0,
    );
  });

  beats.sort(porUrgencia);
  return NextResponse.json({
    ok: true,
    resumen: resumir(beats),
    beats,
    // Para el aviso de "compártela con este correo" cuando una carpeta se ve vacía.
    cuentaServicio: cuentaServicioEmail(),
  });
}
