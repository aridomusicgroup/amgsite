import { NextRequest, NextResponse } from "next/server";
import { alumnoDeLeccion } from "@/lib/curso-guard";
import { cursoBasico } from "@/lib/cursos-cliente";
import { carpetaEntregas } from "@/lib/curso-entregas";
import { driveOAuthConfigured, iniciarSubidaResumible } from "@/lib/drive-oauth";
import { FORMATOS_ENTREGA, MAX_ENTREGA_BYTES, extension } from "@/lib/cursos-tipos";
import { rateLimit } from "@/lib/rate-limit";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/** Orígenes desde los que el navegador puede subir (CORS de la sesión de Google). */
const ORIGENES = new Set([DOMAINS.main, "https://www.aridomusicgroup.com", "http://localhost:3000"]);

/**
 * Prepara la subida de una entrega: valida formato y tamaño, arma la carpeta
 * del alumno y abre la sesión resumible EN EL SERVIDOR. Al navegador sólo le
 * llega la URL de esa sesión (sirve para subir ese archivo y nada más) — nunca
 * un token de Drive.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { cursoId, leccionId } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;
  if (g.leccion.tipo !== "entrega") return NextResponse.json({ error: "Esta lección no recibe entregas." }, { status: 400 });
  if (!driveOAuthConfigured()) return NextResponse.json({ error: "Las entregas no están disponibles todavía." }, { status: 503 });
  if (!rateLimit(`entrega-sesion:${g.email}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre ?? "").trim().slice(0, 150);
  const bytes = Math.floor(Number(b.bytes));
  const ext = extension(nombre);
  if (!nombre || !(ext in FORMATOS_ENTREGA)) {
    return NextResponse.json({ error: `Formato no permitido. Sube ${Object.keys(FORMATOS_ENTREGA).join(", ")}.` }, { status: 400 });
  }
  if (!(bytes > 0 && bytes <= MAX_ENTREGA_BYTES)) {
    return NextResponse.json({ error: "El archivo pesa más de 1 GB. Comprímelo o recórtalo." }, { status: 400 });
  }

  const curso = await cursoBasico(cursoId);
  if (!curso) return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });
  const carpeta = await carpetaEntregas(curso.slug, g.email);
  if (!carpeta) return NextResponse.json({ error: "No se pudo preparar tu carpeta. Intenta en un momento." }, { status: 503 });

  const origenPedido = req.headers.get("origin") ?? "";
  const origin = ORIGENES.has(origenPedido) ? origenPedido : DOMAINS.main;
  const fecha = new Date().toISOString().slice(0, 10);
  const uploadUrl = await iniciarSubidaResumible({
    nombre: `${fecha} ${g.leccion.titulo.replace(/[\/:*?"<>|]/g, "").slice(0, 60)} - ${nombre}`,
    mime: FORMATOS_ENTREGA[ext],
    bytes,
    parentId: carpeta,
    origin,
  });
  if (!uploadUrl) return NextResponse.json({ error: "Google no aceptó la subida. Intenta en un momento." }, { status: 502 });
  return NextResponse.json({ uploadUrl, mime: FORMATOS_ENTREGA[ext] });
}
