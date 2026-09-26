import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { beatParaPanel } from "@/lib/catalog";
import { registrarActividad } from "@/lib/actividad";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

const BUCKET = "portadas-beats";
const TIPOS: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
/** El navegador manda ~150 KB (1200px) y ~25 KB (400px); el tope es para quien llame la API a mano. */
const MAX_GRANDE = 1_500_000;
const MAX_CHICA = 400_000;
// Sólo letras, números, guion y guion bajo: el id también es la ruta del archivo.
const ID_VALIDO = /^[A-Za-z0-9_-]{2,40}$/;

const rutas = (id: string) => Object.values(TIPOS).flatMap((ext) => [`${id}/1200.${ext}`, `${id}/400.${ext}`]);

/**
 * Portada propia del beat. Sube DOS medidas ya recortadas por el navegador:
 * 1200px (página del beat, vista al compartir, Stripe) y 400px (tarjetas,
 * reproductor, carrito). Sube por aquí con service-role, igual que la foto de
 * perfil: no hace falta ninguna política de Storage.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const email = await moduloPermitido("/admin/beats");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!rateLimit(`beat-portada:${email}`, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiados cambios seguidos. Espera un momento." }, { status: 429 });
  }
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return NextResponse.json({ error: "Beat inválido." }, { status: 400 });

  const actual = await beatParaPanel(id);
  if (!actual) return NextResponse.json({ error: "Ese beat no existe." }, { status: 404 });
  if (!actual.tablaFicha) return NextResponse.json({ error: "Falta correr supabase-beat-ficha.sql en Supabase." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const grande = form?.get("grande");
  const chica = form?.get("chica");
  if (!(grande instanceof File) || !(chica instanceof File) || !grande.size || !chica.size) {
    return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
  }
  for (const [f, max] of [[grande, MAX_GRANDE], [chica, MAX_CHICA]] as const) {
    if (!TIPOS[f.type]) return NextResponse.json({ error: "La portada debe ser JPG, PNG o WebP." }, { status: 400 });
    if (f.size > max) return NextResponse.json({ error: "La imagen pesa demasiado." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const subir = async (f: File, lado: 1200 | 400) => {
    const ruta = `${id}/${lado}.${TIPOS[f.type]}`;
    const { error } = await sb.storage.from(BUCKET).upload(ruta, await f.arrayBuffer(), {
      contentType: f.type, upsert: true, cacheControl: "31536000",
    });
    if (error) throw new Error(error.message);
    // La ruta es fija por beat: sin el `?v=` el navegador y el CDN seguirían
    // mostrando la portada vieja.
    return `${sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl}?v=${Date.now()}`;
  };

  let urlGrande: string;
  let urlChica: string;
  try {
    [urlGrande, urlChica] = await Promise.all([subir(grande, 1200), subir(chica, 400)]);
  } catch (e) {
    const msg = (e as Error).message;
    const sinBucket = /bucket not found/i.test(msg);
    return NextResponse.json(
      { error: sinBucket ? "Falta correr supabase-beat-ficha.sql (crea el espacio de las portadas)." : `No se pudo subir: ${msg}` },
      { status: 502 },
    );
  }

  const { error } = await sb.from("beat_ficha").upsert(
    { beat_id: id, portada_url: urlGrande, portada_chica_url: urlChica, actualizado_por: email, updated_at: new Date().toISOString() },
    { onConflict: "beat_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si la anterior era de otro formato (png → webp) quedaría huérfana.
  const nuevas = new Set([`${id}/1200.${TIPOS[grande.type]}`, `${id}/400.${TIPOS[chica.type]}`]);
  await sb.storage.from(BUCKET).remove(rutas(id).filter((r) => !nuevas.has(r))).catch(() => null);

  revalidateTag("catalog", { expire: 0 });
  await registrarActividad(sb, {
    tipo: "beat_portada", titulo: `Portada nueva para ${actual.beat.title}`, actor: email,
    entidad: "beat", entidad_id: id, entidad_nombre: actual.beat.title,
  });
  return NextResponse.json({ ok: true, portada: urlGrande, portadaChica: urlChica });
}

/** Volver a la portada de BeatStars / del catálogo. Borra los archivos propios. */
export async function DELETE(_req: NextRequest, { params }: Props) {
  const email = await moduloPermitido("/admin/beats");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return NextResponse.json({ error: "Beat inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("beat_ficha").update(
    { portada_url: null, portada_chica_url: null, actualizado_por: email, updated_at: new Date().toISOString() },
  ).eq("beat_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.storage.from(BUCKET).remove(rutas(id)).catch(() => null);

  revalidateTag("catalog", { expire: 0 });
  const actual = await beatParaPanel(id);
  await registrarActividad(sb, {
    tipo: "beat_portada", titulo: `${actual?.beat.title ?? id} volvió a su portada original`, actor: email,
    entidad: "beat", entidad_id: id, entidad_nombre: actual?.beat.title ?? id,
  });
  return NextResponse.json({ ok: true });
}
