import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { driveConfigured, cuentaServicioEmail, carpetaVisible } from "@/lib/drive-api";
import { idDeLink, revisarCarpeta, urlCarpeta } from "@/lib/beat-carpetas";
import { FORMATOS } from "@/lib/beats-auditoria";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Asignar A MANO la carpeta de Drive de un beat.
 *
 * Guarda y ADEMÁS revisa: devuelve cuántos archivos ve en cada subcarpeta para
 * que el que la pega sepa en el momento si quedó bien. Guardar un link sin
 * comprobarlo sería repetir el problema que esto viene a arreglar.
 */
export async function POST(req: NextRequest) {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!driveConfigured()) {
    return NextResponse.json({ error: "Falta configurar la cuenta de servicio de Google." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  const folderId = idDeLink(body?.link);
  if (!id) return NextResponse.json({ error: "Falta el beat." }, { status: 400 });
  if (!folderId) {
    return NextResponse.json(
      { error: "Ese link no parece de una carpeta de Drive. Copia el link desde la barra del navegador estando dentro de la carpeta." },
      { status: 400 },
    );
  }

  const sa = cuentaServicioEmail();
  const visible = await carpetaVisible(folderId);
  if (visible === false) {
    return NextResponse.json(
      {
        error:
          `No puedo ver esa carpeta. O el link está mal, o no está compartida con la cuenta del sistema` +
          (sa ? `: ${sa}` : "") + ". Compártela como Lector y vuelve a intentar.",
      },
      { status: 400 },
    );
  }

  const rev = await revisarCarpeta(folderId);
  if (!rev) return NextResponse.json({ error: "No se pudo consultar Google Drive." }, { status: 503 });

  const { error } = await supabaseAdmin()
    .from("beat_carpetas")
    .upsert(
      {
        beat_id: id,
        drive_folder_id: folderId,
        drive_subfolders: rev.subfolders,
        archivos: rev.archivos,
        asignado_por: email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "beat_id" },
    );
  if (error) {
    const falta = /beat_carpetas/i.test(error.message) && /(does not exist|schema cache)/i.test(error.message);
    return NextResponse.json(
      { error: falta ? "Falta correr supabase-beat-carpetas.sql en Supabase." : error.message },
      { status: 500 },
    );
  }

  // Aviso claro cuando la carpeta se guardó pero no sirve para entregar.
  const faltantes = FORMATOS.filter((f) => (rev.archivos[f] ?? 0) === 0);
  const vacia = faltantes.length === FORMATOS.length && rev.sueltos === 0;

  return NextResponse.json({
    ok: true,
    folderId,
    url: urlCarpeta(folderId),
    archivos: rev.archivos,
    sueltos: rev.sueltos,
    faltantes,
    aviso: vacia
      ? `Guardado, pero esa carpeta se ve completamente vacía${sa ? ` para ${sa}` : ""}. Revisa que sea la correcta y que esté compartida.`
      : faltantes.length
        ? `Guardado. Ojo: ${faltantes.join(" y ")} ${faltantes.length === 1 ? "sigue" : "siguen"} sin archivos.`
        : null,
  });
}

/** Quitar la asignación manual y volver a lo automático. */
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const { error } = await supabaseAdmin().from("beat_carpetas").delete().eq("beat_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
