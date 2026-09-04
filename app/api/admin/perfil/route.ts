import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "perfiles";
const TIPOS = new Set(["image/webp", "image/jpeg", "image/png"]);
/** El navegador manda ~30 KB; el tope existe para quien llame la API a mano. */
const MAX_BYTES = 512 * 1024;
const MAX_NOMBRE = 60;

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/**
 * Guarda el perfil del PROPIO usuario: nombre y foto.
 *
 * El correo sale de la sesión, NUNCA del cuerpo de la petición — misma regla
 * que `/api/admin/prefs`. Es lo que impide que alguien edite el perfil ajeno.
 *
 * La foto sube por aquí con service-role en vez de ir directo del navegador a
 * Storage: así no hace falta escribir ni una política RLS de Storage, y quién
 * es el dueño del archivo lo decide el servidor. El patrón de subida directa
 * (SubirArchivos.tsx) existe porque los entregables pesan cientos de MB; un
 * avatar de 30 KB no tiene ese problema.
 */
export async function POST(req: NextRequest) {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!rateLimit(`perfil:${email}`, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiados cambios seguidos. Espera un momento." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });

  const sb = supabaseAdmin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // ── Nombre ──
  if (form.has("nombre")) {
    const nombre = String(form.get("nombre") ?? "").trim();
    if (nombre.length > MAX_NOMBRE) {
      return NextResponse.json({ error: `El nombre no puede pasar de ${MAX_NOMBRE} caracteres.` }, { status: 400 });
    }
    patch.nombre = nombre || null;
  }

  // ── Foto ──
  const foto = form.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (!TIPOS.has(foto.type)) {
      return NextResponse.json({ error: "La foto debe ser JPG, PNG o WebP." }, { status: 400 });
    }
    if (foto.size > MAX_BYTES) {
      return NextResponse.json({ error: "La foto pesa demasiado." }, { status: 400 });
    }
    // Ruta fija por persona: una foto cada quien, sin archivos huérfanos.
    const ruta = `${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}.${EXT[foto.type]}`;
    const { error: eSubida } = await sb.storage
      .from(BUCKET)
      .upload(ruta, await foto.arrayBuffer(), { contentType: foto.type, upsert: true });
    if (eSubida) return NextResponse.json({ error: `No se pudo guardar la foto: ${eSubida.message}` }, { status: 502 });

    // Como el archivo se sobrescribe, la URL no cambia y el navegador seguiría
    // mostrando la foto vieja. El `?v=` la desempolva.
    const { data } = sb.storage.from(BUCKET).getPublicUrl(ruta);
    patch.foto_url = `${data.publicUrl}?v=${Date.now()}`;
  }

  if (form.get("quitar_foto") === "1") patch.foto_url = null;

  const { error } = await sb.from("usuarios").update(patch).eq("email", email.toLowerCase());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, foto_url: patch.foto_url ?? null });
}
