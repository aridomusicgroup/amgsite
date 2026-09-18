import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buscarOCrearCarpeta } from "@/lib/drive-oauth";

/**
 * Entregas de los alumnos (evaluaciones y retos). Los videos viven en el Drive
 * de la cuenta de OAuth, en carpetas que crea la propia app:
 *   CURSOS-ENTREGAS / <slug del curso> / <correo del alumno>
 * (tienen que ser de la app: con el scope `drive.file` no puede escribir en
 * carpetas creadas a mano).
 */

const RAIZ = "CURSOS-ENTREGAS";

export async function carpetaEntregas(cursoSlug: string, email: string): Promise<string | null> {
  const raiz = await buscarOCrearCarpeta(RAIZ, null);
  if (!raiz) return null;
  const curso = await buscarOCrearCarpeta(cursoSlug, raiz);
  if (!curso) return null;
  return buscarOCrearCarpeta(email.trim().toLowerCase(), curso);
}

/** Cuántas revisiones personales ya usó esta cuenta en este curso. */
export async function revisionesUsadas(emails: string[], cursoId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("curso_entregas")
    .select("id", { count: "exact", head: true })
    .eq("curso_id", cursoId)
    .in("email", emails)
    .eq("con_revision", true);
  return count ?? 0;
}

export interface EntregaAlumno {
  id: string;
  nombre: string;
  bytes: number | null;
  estado: "enviada" | "revisada";
  conRevision: boolean;
  autoevaluacion: Record<string, number>;
  comentarioAlumno: string | null;
  retro: string | null;
  rubricaProfe: Record<string, number>;
  revisadaEn: string | null;
  createdAt: string;
}

/** Las entregas de esta cuenta para una lección, la más nueva primero. */
export async function entregasDelAlumno(emails: string[], leccionId: string): Promise<EntregaAlumno[]> {
  const { data } = await supabaseAdmin()
    .from("curso_entregas")
    .select("id, nombre, bytes, estado, con_revision, autoevaluacion, comentario_alumno, retro, rubrica_profe, revisada_en, created_at")
    .eq("leccion_id", leccionId)
    .in("email", emails)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((e) => ({
    id: e.id as string,
    nombre: e.nombre as string,
    bytes: e.bytes == null ? null : Number(e.bytes),
    estado: e.estado === "revisada" ? "revisada" : "enviada",
    conRevision: e.con_revision !== false,
    autoevaluacion: (e.autoevaluacion as Record<string, number>) ?? {},
    comentarioAlumno: (e.comentario_alumno as string | null) ?? null,
    retro: (e.retro as string | null) ?? null,
    rubricaProfe: (e.rubrica_profe as Record<string, number>) ?? {},
    revisadaEn: (e.revisada_en as string | null) ?? null,
    createdAt: e.created_at as string,
  }));
}
