import { NextRequest, NextResponse } from "next/server";
import { alumnoDeCurso } from "@/lib/curso-guard";
import { correosDe, getCursoDetalleCliente } from "@/lib/cursos-cliente";
import { elegibilidad, emitirCertificado } from "@/lib/curso-certificados";
import { generarCertificado } from "@/lib/certificado-pdf";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string }> };

/** Descarga el certificado (?tipo=termino|mencion) si el alumno ya lo ganó. */
export async function GET(req: NextRequest, { params }: Props) {
  const { cursoId } = await params;
  const g = await alumnoDeCurso(cursoId);
  if (!g.ok) return g.res;

  const tipo = req.nextUrl.searchParams.get("tipo") === "mencion" ? "mencion" : "termino";
  const curso = await getCursoDetalleCliente(g.email, cursoId);
  if (!curso) return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });
  const el = await elegibilidad(curso, await correosDe(g.email));
  if (!el[tipo]) return NextResponse.json({ error: "Todavía no completas lo necesario para este certificado." }, { status: 403 });

  const cert = await emitirCertificado(cursoId, g.email, tipo);
  if (!cert) return NextResponse.json({ error: "No se pudo emitir el certificado." }, { status: 500 });

  const pdf = await generarCertificado({ id: cert.id, nombre: cert.nombre, curso: curso.titulo, tipo, fecha: new Date(cert.emitidoEn) });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Certificado ${curso.titulo}.pdf`)}`,
      "cache-control": "private, no-store",
    },
  });
}
