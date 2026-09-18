import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClienteProfile } from "@/lib/cuenta-cliente";
import type { CursoDetalleCliente } from "@/lib/cursos-cliente";

/**
 * Qué certificados le tocan a un alumno y su emisión (una sola vez por tipo:
 * el folio no cambia aunque lo descargue diez veces).
 *  - de término: 100% de la ruta principal publicada.
 *  - con mención: además, TODAS sus entregas de evaluación revisadas por el maestro.
 */

export interface Elegibilidad { termino: boolean; mencion: boolean }

export async function elegibilidad(curso: CursoDetalleCliente, emails: string[]): Promise<Elegibilidad> {
  const termino = curso.pct >= 100;
  if (!termino) return { termino, mencion: false };
  const entregas = curso.modulos.flatMap((m) => m.lecciones).filter((l) => l.tipo === "entrega" && l.etiqueta === "evaluacion");
  if (!entregas.length) return { termino, mencion: false };
  const { data } = await supabaseAdmin()
    .from("curso_entregas")
    .select("leccion_id")
    .eq("curso_id", curso.id)
    .in("email", emails)
    .eq("estado", "revisada");
  const revisadas = new Set((data ?? []).map((e) => e.leccion_id as string));
  return { termino, mencion: entregas.every((l) => revisadas.has(l.id)) };
}

/** Emite (o reutiliza) el certificado y devuelve su id y nombre impreso. */
export async function emitirCertificado(cursoId: string, email: string, tipo: "termino" | "mencion"): Promise<{ id: string; nombre: string; emitidoEn: string } | null> {
  const sb = supabaseAdmin();
  const correo = email.trim().toLowerCase();
  const { data: ya } = await sb.from("curso_certificados").select("id, nombre, emitido_en").eq("curso_id", cursoId).eq("email", correo).eq("tipo", tipo).maybeSingle();
  if (ya) return { id: ya.id as string, nombre: ya.nombre as string, emitidoEn: ya.emitido_en as string };
  const perfil = await getClienteProfile(correo);
  const nombre = (perfil.nombre ?? "").trim() || correo.split("@")[0];
  const { data, error } = await sb.from("curso_certificados").insert({ curso_id: cursoId, email: correo, nombre, tipo }).select("id, emitido_en").single();
  if (error || !data) return null;
  return { id: data.id as string, nombre, emitidoEn: data.emitido_en as string };
}

/** Para la página pública de verificación. */
export async function certificadoPublico(id: string): Promise<{ nombre: string; curso: string; tipo: "termino" | "mencion"; emitidoEn: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from("curso_certificados").select("nombre, tipo, emitido_en, cursos(titulo)").eq("id", id).maybeSingle();
  if (!data) return null;
  return {
    nombre: data.nombre as string,
    curso: ((data as { cursos?: { titulo?: string } | null }).cursos?.titulo) ?? "",
    tipo: data.tipo === "mencion" ? "mencion" : "termino",
    emitidoEn: data.emitido_en as string,
  };
}
