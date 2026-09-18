import { NextRequest, NextResponse } from "next/server";
import { diagnosticoDe, preguntasDe, registrarQuiz } from "@/lib/cursos-cliente";
import { alumnoDeLeccion } from "@/lib/curso-guard";
import { esRellenar, puntajeQuiz, recomendacionDiagnostico } from "@/lib/cursos-tipos";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/**
 * Califica un quiz EN EL SERVIDOR: el navegador nunca recibe las respuestas
 * correctas antes de contestar. Devuelve el puntaje, la corrección pregunta
 * por pregunta y, si es el diagnóstico, la ruta recomendada. Se marca como
 * vista sólo al aprobar (el diagnóstico, siempre).
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { cursoId, leccionId } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;
  if (g.leccion.tipo !== "quiz") return NextResponse.json({ error: "Esta lección no es un quiz." }, { status: 400 });
  if (!rateLimit(`quiz:${g.email}:${leccionId}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const preguntas = preguntasDe(g.leccion);
  if (!preguntas.length) return NextResponse.json({ error: "Este quiz todavía no tiene preguntas." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const respuestas: unknown[] = Array.isArray(b.respuestas) ? b.respuestas.slice(0, preguntas.length) : [];
  const r = puntajeQuiz(preguntas, respuestas);
  const rangos = diagnosticoDe(g.leccion);
  const texto = rangos.length ? recomendacionDiagnostico(rangos, r.pct) : null;
  const recomendacion = texto && !esRellenar(texto) ? texto : null;
  const esDiagnostico = rangos.length > 0;

  const aprobado = esDiagnostico || r.aprobado;
  await registrarQuiz(g.email, leccionId, { pct: r.pct, correctas: r.correctas, total: r.total }, aprobado);

  return NextResponse.json({
    ...r,
    aprobado,
    recomendacion,
    correccion: preguntas.map((p, i) => ({
      correcta: p.correcta,
      elegida: Number.isInteger(Number(respuestas[i])) ? Number(respuestas[i]) : null,
      explicacion: p.explicacion ?? null,
    })),
  });
}
