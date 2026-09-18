import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerConfig } from "@/lib/cursos-tipos";
import { correosConAcceso } from "@/lib/curso-preventa";
import { enviarMasivo, estrenoEmail } from "@/lib/emails-cursos";
import { registrarActividad } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * “Avisar estreno”: correo a todos los alumnos con acceso vigente de que ya
 * salió esta lección. Una sola vez por lección (queda en la bitácora) y sólo
 * con el curso ya lanzado: en preventa nadie ve lecciones todavía.
 */
export async function POST(req: NextRequest) {
  const staffEmail = await moduloPermitido("/admin/cursos");
  if (!staffEmail) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!UUID.test(id)) return NextResponse.json({ error: "Lección inválida." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: l } = await sb.from("curso_lecciones")
    .select("id, titulo, publicada, curso_modulos!inner(curso_id, cursos!inner(id, titulo, activo, config))")
    .eq("id", id).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const curso = (l as any)?.curso_modulos?.cursos as { id: string; titulo: string; activo: boolean; config: unknown } | undefined;
  if (!l || !curso) return NextResponse.json({ error: "Lección no encontrada." }, { status: 404 });
  if (!l.publicada) return NextResponse.json({ error: "Primero publica la lección." }, { status: 400 });
  if (leerConfig(curso.config).preventa.activa) {
    return NextResponse.json({ error: "El curso sigue en preventa: al lanzarlo, el correo de apertura avisa de todo." }, { status: 400 });
  }

  const { data: previo } = await sb.from("actividad").select("created_at").eq("tipo", "curso_estreno_avisado").eq("entidad_id", id).limit(1);
  if (previo?.length) {
    const cuando = new Date(previo[0].created_at as string).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    return NextResponse.json({ error: `Ya avisaste de esta lección el ${cuando}.` }, { status: 409 });
  }

  const alumnos = await correosConAcceso(sb, curso.id);
  if (!alumnos.length) return NextResponse.json({ error: "Este curso todavía no tiene alumnos." }, { status: 400 });

  const enviados = await enviarMasivo(
    alumnos,
    estrenoEmail({ curso: curso.titulo, cursoId: curso.id, leccion: l.titulo as string, leccionId: id }),
    `estreno-${id}`,
  );
  if (!enviados) return NextResponse.json({ error: "No se pudo mandar el correo." }, { status: 502 });

  await registrarActividad(sb, {
    tipo: "curso_estreno_avisado",
    titulo: `Estreno de “${l.titulo}” (${curso.titulo}) avisado a ${enviados} alumno${enviados === 1 ? "" : "s"}`,
    actor: staffEmail,
    entidad_id: id,
    entidad_nombre: l.titulo as string,
  });
  return NextResponse.json({ ok: true, enviados });
}
