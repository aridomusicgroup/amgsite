import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extenderVencimiento, leerConfig } from "@/lib/cursos-tipos";
import { bienvenidaCursoEmail, enviarCorreo } from "@/lib/emails-cursos";
import { registrarActividad } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function datosCurso(cursoId: string) {
  const { data } = await supabaseAdmin().from("cursos").select("titulo, tipo, config").eq("id", cursoId).maybeSingle();
  if (!data) return null;
  // En preventa el correo confirma el lugar apartado en vez de mandarlo a las lecciones.
  const p = leerConfig(data.config).preventa;
  return { titulo: data.titulo as string, tipo: data.tipo as string | undefined, preventa: p.activa ? { lanzamiento: p.lanzamiento } : null };
}

async function nombreDe(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("contactos").select("nombre").eq("email", email).is("merged_into", null).limit(1);
  const n = (data?.[0]?.nombre as string | undefined)?.trim();
  return n ? n.split(" ")[0] : null;
}

// ── Dar acceso manual a un curso (y avisarle al alumno) ──
export async function POST(req: NextRequest) {
  const staffEmail = await moduloPermitido("/admin/cursos");
  if (!staffEmail) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const cursoId = String(b.curso_id || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  if (!cursoId || !EMAIL.test(email)) return NextResponse.json({ error: "Faltan datos (curso o correo válido)." }, { status: 400 });

  const curso = await datosCurso(cursoId);
  if (!curso) return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });

  // La mentoría nace con un mes; un curso normal es de por vida.
  const meses = Math.floor(Number(b.meses));
  const venceEn = curso.tipo === "mentoria" || meses > 0 ? extenderVencimiento(null, new Date(), meses > 0 ? meses : 1) : null;

  const sb = supabaseAdmin();
  const fila: Record<string, unknown> = { curso_id: cursoId, email, origen: b.origen === "regalo" ? "regalo" : "manual", otorgado_por: staffEmail };
  if (venceEn) fila.vence_en = venceEn;
  const { error } = await sb.from("curso_accesos").upsert(fila, { onConflict: "curso_id,email", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarActividad(sb, {
    tipo: "curso_acceso_dado",
    titulo: `Acceso a “${curso.titulo}” para ${email}`,
    actor: staffEmail,
  });
  if (b.avisar !== false) await enviarCorreo(email, bienvenidaCursoEmail({ nombre: await nombreDe(email), curso: curso.titulo, cursoId, preventa: curso.preventa }));
  return NextResponse.json({ ok: true });
}

// ── Renovar (+N meses) o reenviar el correo de acceso ──
export async function PATCH(req: NextRequest) {
  const staffEmail = await moduloPermitido("/admin/cursos");
  if (!staffEmail) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del acceso." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: acc } = await sb.from("curso_accesos").select("id, curso_id, email, vence_en").eq("id", id).maybeSingle();
  if (!acc) return NextResponse.json({ error: "Acceso no encontrado." }, { status: 404 });
  const curso = await datosCurso(acc.curso_id as string);

  if (b.accion === "reenviar") {
    const ok = await enviarCorreo(acc.email as string, bienvenidaCursoEmail({
      nombre: await nombreDe(acc.email as string), curso: curso?.titulo ?? "tu curso", cursoId: acc.curso_id as string,
      preventa: curso?.preventa ?? null,
    }));
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se pudo mandar el correo." }, { status: 502 });
  }

  if (b.accion === "renovar") {
    const meses = Math.min(12, Math.max(1, Math.floor(Number(b.meses) || 1)));
    const vence = extenderVencimiento(acc.vence_en as string | null, new Date(), meses);
    const { error } = await sb.from("curso_accesos").update({ vence_en: vence }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await registrarActividad(sb, {
      tipo: "curso_acceso_renovado",
      titulo: `Renovó ${meses} mes${meses === 1 ? "" : "es"} de “${curso?.titulo ?? "curso"}” a ${acc.email}`,
      actor: staffEmail,
    });
    return NextResponse.json({ ok: true, vence_en: vence });
  }

  if (b.accion === "sin_vencimiento") {
    const { error } = await sb.from("curso_accesos").update({ vence_en: null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}

// ── Revocar acceso ──
export async function DELETE(req: NextRequest) {
  const staffEmail = await moduloPermitido("/admin/cursos");
  if (!staffEmail) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del acceso." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: acc } = await sb.from("curso_accesos").select("email, curso_id").eq("id", id).maybeSingle();
  const { error } = await sb.from("curso_accesos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (acc) {
    await registrarActividad(sb, { tipo: "curso_acceso_quitado", titulo: `Quitó el acceso a un curso a ${acc.email}`, actor: staffEmail });
  }
  return NextResponse.json({ ok: true });
}
