import { NextRequest, NextResponse } from "next/server";
import { alumnoDeLeccion } from "@/lib/curso-guard";
import { correosDe, cursoBasico, esMiembroMentoria, marcarProgreso, rubricaDe } from "@/lib/cursos-cliente";
import { carpetaEntregas, entregasDelAlumno, revisionesUsadas } from "@/lib/curso-entregas";
import { metadatosArchivo } from "@/lib/drive-oauth";
import { MAX_ENTREGA_BYTES, esFormatoEntrega, validarCalificacion } from "@/lib/cursos-tipos";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { pushAEmails } from "@/lib/push";
import { registrarActividad } from "@/lib/actividad";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/** Mis entregas de esta lección + cuántas revisiones personales me quedan. */
export async function GET(_req: NextRequest, { params }: Props) {
  const { cursoId, leccionId } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;

  const emails = await correosDe(g.email);
  const curso = await cursoBasico(cursoId);
  const [entregas, usadas, miembro] = await Promise.all([
    entregasDelAlumno(emails, leccionId),
    revisionesUsadas(emails, cursoId),
    curso ? esMiembroMentoria(g.email, curso.config) : Promise.resolve(false),
  ]);
  return NextResponse.json({
    entregas,
    revisiones: { incluidas: curso?.revisionesIncluidas ?? 0, usadas, miembro },
  });
}

/**
 * Confirma una entrega que el navegador YA subió a Drive. Antes de guardarla
 * comprueba con Google que el archivo exista, esté en la carpeta de ESTE
 * alumno y sea de un formato y tamaño permitidos — el id que manda el
 * navegador no se cree a ciegas.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { cursoId, leccionId } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;
  if (g.leccion.tipo !== "entrega") return NextResponse.json({ error: "Esta lección no recibe entregas." }, { status: 400 });
  if (!rateLimit(`entrega:${g.email}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const fileId = String(b.drive_file_id ?? "").trim();
  const curso = await cursoBasico(cursoId);
  if (!curso) return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });

  const [meta, carpeta] = await Promise.all([metadatosArchivo(fileId), carpetaEntregas(curso.slug, g.email)]);
  if (!meta || !carpeta || !meta.parents.includes(carpeta)) {
    return NextResponse.json({ error: "No encontramos tu archivo. Vuelve a subirlo." }, { status: 400 });
  }
  if (!esFormatoEntrega(meta.name) || (meta.size != null && meta.size > MAX_ENTREGA_BYTES)) {
    return NextResponse.json({ error: "Formato o tamaño no permitido." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: ya } = await sb.from("curso_entregas").select("id").eq("drive_file_id", fileId).maybeSingle();
  if (ya) return NextResponse.json({ ok: true, id: ya.id });

  const emails = await correosDe(g.email);
  const [usadas, miembro] = await Promise.all([revisionesUsadas(emails, cursoId), esMiembroMentoria(g.email, curso.config)]);
  const conRevision = miembro || usadas < curso.revisionesIncluidas;
  const rubrica = rubricaDe(g.leccion);

  const { data: nueva, error } = await sb.from("curso_entregas").insert({
    leccion_id: leccionId,
    curso_id: cursoId,
    email: g.email.trim().toLowerCase(),
    drive_file_id: fileId,
    nombre: meta.name.slice(0, 200),
    bytes: meta.size,
    mime: meta.mimeType,
    autoevaluacion: validarCalificacion(b.autoevaluacion, rubrica),
    comentario_alumno: b.comentario ? String(b.comentario).trim().slice(0, 2000) : null,
    con_revision: conRevision,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "No se pudo registrar tu entrega." }, { status: 500 });

  // Entregar ya cuenta como haber hecho la lección.
  await marcarProgreso(g.email, leccionId, true);

  if (conRevision) {
    await pushAEmails(sb, [...new Set([...adminEmails(), ...crmEmails()])], {
      titulo: "🎸 Entrega nueva por revisar",
      cuerpo: `${g.leccion.titulo} · ${g.email}`,
      url: `https://admin.aridomusicgroup.com/admin/cursos/entregas?curso=${cursoId}`,
    });
  }
  await registrarActividad(sb, {
    tipo: "curso_entrega_recibida",
    titulo: `${g.email} entregó “${g.leccion.titulo}”${conRevision ? "" : " (sin revisión: ya usó las incluidas)"}`,
    actor: g.email,
  });

  return NextResponse.json({ ok: true, id: nueva?.id, conRevision });
}
