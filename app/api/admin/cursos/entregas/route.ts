import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validarCalificacion, validarRubrica } from "@/lib/cursos-tipos";
import { enviarCorreo, retroEntregaEmail } from "@/lib/emails-cursos";
import { registrarActividad } from "@/lib/actividad";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Guarda la retroalimentación del maestro sobre una entrega, la marca como
 * revisada y le avisa al alumno por correo. Se puede volver a editar: el
 * correo sólo sale la primera vez que pasa a revisada.
 */
export async function PATCH(req: NextRequest) {
  const staff = await moduloPermitido("/admin/cursos");
  if (!staff) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "").trim();
  const retro = String(b.retro ?? "").trim().slice(0, 5000);
  if (!id) return NextResponse.json({ error: "Falta la entrega." }, { status: 400 });
  if (!retro) return NextResponse.json({ error: "Escribe la retroalimentación." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: e } = await sb
    .from("curso_entregas")
    .select("id, email, estado, curso_id, leccion_id, cursos(titulo), curso_lecciones(titulo, contenido)")
    .eq("id", id)
    .maybeSingle();
  if (!e) return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const x = e as any;
  const rubrica = validarRubrica(x.curso_lecciones?.contenido?.rubrica);

  const { error } = await sb.from("curso_entregas").update({
    retro,
    rubrica_profe: validarCalificacion(b.rubrica_profe, rubrica),
    estado: "revisada",
    retro_por: staff,
    revisada_en: new Date().toISOString(),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leccion = String(x.curso_lecciones?.titulo ?? "tu entrega");
  const curso = String(x.cursos?.titulo ?? "tu curso");
  if (x.estado !== "revisada") {
    await enviarCorreo(x.email, retroEntregaEmail({
      nombre: null, curso, leccion,
      url: `${DOMAINS.main}/cuenta/login?siguiente=${encodeURIComponent(`/cuenta/curso/${x.curso_id}/leccion/${x.leccion_id}`)}`,
    }));
  }
  await registrarActividad(sb, { tipo: "curso_retro_enviada", titulo: `Retroalimentación a ${x.email} · ${leccion}`, actor: staff });
  return NextResponse.json({ ok: true });
}
