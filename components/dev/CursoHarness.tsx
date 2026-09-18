"use client";
import { useState } from "react";
import { MODULOS, CURSO } from "@/scripts/curso-docerola/temario.mjs";
import type { CursoDetalle, CursoLeccion, EntregaAdmin } from "@/lib/cursos-admin";
import type { LeccionCliente, ModuloCliente } from "@/lib/cursos-cliente";
import type { CursoPublico } from "@/lib/cursos-publico";
import {
  camposVisibles, estadoVenta, hoyMx, leerConfig, leerPreventa, renglones, validarQuiz, validarRubrica,
  type Cta, type Etiqueta, type TipoLeccion,
} from "@/lib/cursos-tipos";
import { CursoEditor } from "@/components/admin/CursoEditor";
import { EntregasBandeja } from "@/components/admin/curso/EntregasBandeja";
import { MapaCurso } from "@/components/cuenta/curso/MapaCurso";
import { BitacoraPractica } from "@/components/cuenta/curso/BitacoraPractica";
import { CtaLeccion } from "@/components/cuenta/curso/CtaLeccion";
import { ReproductorPractica } from "@/components/cuenta/curso/ReproductorPractica";
import { NotasLeccion } from "@/components/cuenta/curso/NotasLeccion";
import { QuizAlumno } from "@/components/cuenta/curso/QuizAlumno";
import { EntregaReto } from "@/components/cuenta/curso/EntregaReto";
import { TabInteractiva } from "@/components/cuenta/curso/TabInteractiva";
import { VentaCurso } from "@/components/cursos/VentaCurso";
import { PreventaAlumno } from "@/components/cuenta/curso/PreventaAlumno";
import { AridoCursos } from "@/components/arido/Cursos";
import { aTarjeta } from "@/lib/cursos-tarjeta";
import { MUSICXML_MUESTRA, VIDEO_MUESTRA } from "./curso-muestra";

/**
 * Sólo para desarrollo (ver app/dev/curso): el curso Docerola Tumbada con la
 * plantilla real (temario.mjs) y respuestas falsas para lo que las pantallas
 * piden al servidor. Nada sale a la base ni a Drive.
 */

type LeccionTemario = { titulo: string; tipo: TipoLeccion; etiqueta: Etiqueta; opcional: boolean; preview?: boolean; cta?: Cta; contenido: Record<string, unknown> };
type ModuloTemario = { titulo: string; ruta: string; descripcion: string; lecciones: LeccionTemario[] };
const modulos = MODULOS as unknown as ModuloTemario[];

// Algunas lecciones ya "escritas" para ver cómo luce lo que el alumno sí ve.
const escrito = (l: LeccionTemario, i: number): Record<string, unknown> =>
  i % 3 === 0 && l.etiqueta === "nucleo"
    ? { ...l.contenido, objetivo: "Rasguear el patrón base a 80 bpm sin parar.", minimo: "El tumbado vive en la subdivisión: cuenta 1-y-2-y.", criterio: "En la estrofa, apagado corto; en el coro, abre la mano." }
    : l.contenido;

let n = 0;
const leccionesAdmin: CursoLeccion[][] = modulos.map((m) => m.lecciones.map((l, j) => {
  n++;
  return {
    id: `l${n}`, titulo: l.titulo, tipo: l.tipo, driveFileId: n % 4 === 0 ? "1AbCdEfGhIjKlMnOp" : null, urlExterna: null,
    duracionSeg: 480, orden: j, etiqueta: l.etiqueta, opcional: l.opcional, preview: Boolean(l.preview), publicada: n < 20,
    cta: l.cta ?? "ninguno", contenido: escrito(l, n), marcadores: [], recursos: [],
    estadoProduccion: n < 12 ? "editado" : n < 20 ? "grabado" : n < 30 ? "listo_grabar" : "guion",
  } as CursoLeccion;
}));

// Preventa de ejemplo: $990 en vez de $1,490, 50 lugares, cierra en 12 días.
const hoy = hoyMx();
const enDias = (d: number) => new Date(Date.parse(`${hoy}T12:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const preventa = leerPreventa({
  activa: true, precio: 990, cierre: enDias(12), cupo: 50, lanzamiento: "noviembre 2026",
  bonos: ["Precio congelado en la mentoría grupal", "Sesión en vivo de lanzamiento con Q&A", "Tu nombre en los créditos del curso"].join("\n"),
});
const venta = (p = preventa, vendidos = 13) => estadoVenta({ activo: true, preventa: p, precioRegular: 1490, vendidos, hoy });

const config = leerConfig({ ...CURSO.config, preventa, mentoria: { estado: "lista_espera", curso_id: "m1", precio_mes: 499 } });

const cursoAdmin: CursoDetalle = {
  id: "c1", slug: CURSO.slug, titulo: CURSO.titulo, descripcion: CURSO.descripcion, portadaUrl: null, precioMxn: 1490,
  activo: true, driveFolderId: null, tipo: "curso", numModulos: modulos.length, numLecciones: n, numAlumnos: 3,
  config, revisionesIncluidas: 1, interesados: 7, entregasPendientes: 2, mentorias: [{ id: "m1", titulo: "Mentoría grupal semanal" }],
  modulos: modulos.map((m, i) => ({ id: `m${i}`, titulo: m.titulo, orden: i, ruta: m.ruta as CursoDetalle["modulos"][number]["ruta"], descripcion: m.descripcion, lecciones: leccionesAdmin[i] })),
  accesos: [
    { id: "a1", email: "alumno@ejemplo.com", origen: "venta", otorgadoPor: null, createdAt: "2026-09-10T12:00:00Z", venceEn: null },
    { id: "a2", email: "regalo@ejemplo.com", origen: "regalo", otorgadoPor: "eliud@ejemplo.com", createdAt: "2026-09-12T12:00:00Z", venceEn: null },
  ],
  venta: venta(), fundadores: 13, avisame: ["lead1@ejemplo.com", "lead2@ejemplo.com", "alumno@ejemplo.com"], estrenosAvisados: [],
};

const aCliente = (l: CursoLeccion, i: number): LeccionCliente => ({
  id: l.id, titulo: l.titulo, tipo: l.tipo, etiqueta: l.etiqueta, opcional: l.opcional, cta: l.cta, urlExterna: null,
  duracionSeg: l.duracionSeg, tieneArchivo: true, visto: i < 6, segundos: 0, datos: {},
  notas: camposVisibles(l.contenido, l.etiqueta), ctaTexto: null,
  marcadores: [{ t: 0, label: "Gancho" }, { t: 2, label: "Lo mínimo" }, { t: 5, label: "Manos a la obra" }],
  recursos: [{ titulo: "Mapa del diapasón de docerola", tipo: "pdf" }, { titulo: "Pista sin requinto (80%)", tipo: "audio" }],
  preguntas: validarQuiz(l.contenido.preguntas).map((q) => ({ pregunta: q.pregunta, opciones: q.opciones })),
  rubrica: validarRubrica(l.contenido.rubrica).map((r) => ({ criterio: r.criterio, niveles: r.niveles.map(() => "") })),
  enVivo: null,
});
let k = 0;
const modulosCliente: ModuloCliente[] = cursoAdmin.modulos.map((m) => ({
  id: m.id, titulo: m.titulo, descripcion: m.descripcion, ruta: m.ruta, lecciones: m.lecciones.map((l) => aCliente(l, k++)),
}));
const todas = modulosCliente.flatMap((m) => m.lecciones);
const leccionVideo = todas.find((l) => l.etiqueta === "nucleo" && l.notas.length > 0) ?? todas[0];
const quiz = todas.find((l) => l.tipo === "quiz" && l.titulo.includes("mapa"))!;
const entrega = todas.find((l) => l.tipo === "entrega")!;

const publico: CursoPublico = {
  id: "c1", slug: CURSO.slug, titulo: CURSO.titulo, descripcion: CURSO.descripcion, portadaUrl: null, precioMxn: 1490,
  revisionesIncluidas: 1, venta: venta(), bonos: renglones(preventa.bonos),
  config: leerConfig({ landing: {
    promesa: "En 12 semanas pasas del rasgueo básico a tocar tu propio requinto, con criterio para sacar cualquier rola.",
    para_quien: "Ya tienes docerola y quieres tocar corridos tumbados de verdad\nTe cansaste de tutoriales que no explican el porqué",
    no_para_quien: "Buscas tocar sin practicar",
    garantia: "[RELLENAR: garantía]",
    faqs: "P: ¿Necesito saber leer partitura?\nR: No. La partitura es una ruta opcional.\n\nP: ¿Cuánto tiempo tengo acceso?\nR: De por vida.",
  } }),
  modulos: modulos.map((m, i) => ({
    titulo: m.titulo, descripcion: m.descripcion, ruta: "principal",
    lecciones: m.lecciones.map((l, j) => ({ id: `p${i}-${j}`, titulo: l.titulo, tipo: l.tipo, etiqueta: l.etiqueta, opcional: l.opcional, duracionSeg: 480, gratis: Boolean(l.preview) })),
  })),
  conteo: { lecciones: 66, capsulas: 18, profundas: 8, evaluaciones: 6, tablaturas: 2, publicadas: 20, minutos: 600 },
};

const publicoCerrado: CursoPublico = { ...publico, venta: venta(preventa, 50) };
const publicoLanzado: CursoPublico = { ...publico, venta: venta({ ...preventa, activa: false }), bonos: [] };

const entregasAdmin: EntregaAdmin[] = [
  { id: "e1", cursoId: "c1", cursoTitulo: CURSO.titulo, leccionId: entrega.id, leccionTitulo: entrega.titulo, email: "alumno@ejemplo.com",
    nombre: "evaluacion.mp4", bytes: 12_000_000, mime: "video/mp4", autoevaluacion: { "Tempo y pulso": 3, Limpieza: 2 }, comentarioAlumno: "Me cuesta el cambio del compás 5.",
    estado: "enviada", conRevision: true, retro: null, rubricaProfe: {}, retroPor: null, revisadaEn: null, createdAt: "2026-09-16T18:00:00Z",
    rubrica: entrega.rubrica },
];

// Las llamadas se contestan aquí: nada sale a la base.
if (typeof window !== "undefined" && !(window as unknown as { __bancoCurso?: boolean }).__bancoCurso) {
  (window as unknown as { __bancoCurso?: boolean }).__bancoCurso = true;
  const real = window.fetch.bind(window);
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/dev-muestra.musicxml")) return new Response(MUSICXML_MUESTRA, { status: 200 });
    if (url.includes("/quiz")) return json({ correctas: 4, total: 5, pct: 80, aprobado: true, recomendacion: null, correccion: [0, 1, 0, 1, 1].map((c) => ({ correcta: c, elegida: c, explicacion: "Explicación de ejemplo." })) });
    if (url.endsWith("/entrega") && (!init || init.method === undefined || init.method === "GET")) {
      return json({ entregas: [], revisiones: { incluidas: 1, usadas: 0, miembro: false } });
    }
    if (url.includes("/entrega/sesion")) return json({ error: "En el banco de pruebas no se sube nada." }, 400);
    if (url.includes("/api/checkout-curso")) return json({ error: "En el banco de pruebas no se cobra nada." }, 400);
    if (url.includes("/api/cursos/aviso")) return json({ ok: true });
    if (url.includes("/api/admin/") || url.includes("/api/cuenta/")) return json({ ok: true });
    return real(input, init);
  };
}

type Vista = "editor" | "entregas" | "inicio" | "preventa" | "leccion" | "tab" | "quiz" | "entrega" | "venta" | "cerrada" | "lanzada" | "sitio";
const VISTAS: { id: Vista; label: string; admin?: boolean }[] = [
  { id: "editor", label: "Admin · editor", admin: true },
  { id: "entregas", label: "Admin · entregas", admin: true },
  { id: "inicio", label: "Alumno · inicio" },
  { id: "leccion", label: "Alumno · video" },
  { id: "tab", label: "Alumno · tablatura" },
  { id: "quiz", label: "Alumno · quiz" },
  { id: "entrega", label: "Alumno · entrega" },
  { id: "preventa", label: "Alumno · preventa" },
  { id: "venta", label: "Venta · preventa" },
  { id: "cerrada", label: "Venta · cerrada" },
  { id: "lanzada", label: "Venta · lanzada" },
  { id: "sitio", label: "Sitio · inicio" },
];
const PAGINA_COMPLETA: Vista[] = ["venta", "cerrada", "lanzada", "sitio"];
const mentoria = { estado: config.mentoria.estado, cursoId: "m1", precioMes: 499, esMiembro: false };

export function CursoHarness() {
  const [vista, setVista] = useState<Vista>("editor");
  const [claro, setClaro] = useState(false);
  const esAdmin = VISTAS.find((v) => v.id === vista)?.admin;

  const contenido = {
    editor: <CursoEditor curso={cursoAdmin} servicioEmail="lector@cuenta-servicio.iam.gserviceaccount.com" />,
    entregas: <EntregasBandeja entregas={entregasAdmin} cursos={[{ id: "c1", titulo: CURSO.titulo }]} cursoId="" estado="" />,
    inicio: (
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <BitacoraPractica cursoId="c1" racha={4} semana={95} meta={150} hoy={30} />
        <CtaLeccion cta="mentoria" texto={null} cursoId="c1" leccionId="" cursoTitulo={CURSO.titulo} entregaHref={null} mentoria={mentoria} />
        <MapaCurso cursoId="c1" modulos={modulosCliente} />
      </div>
    ),
    leccion: (
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="font-coolvetica text-3xl">{leccionVideo.titulo}</h1>
        <ReproductorPractica src={VIDEO_MUESTRA} marcadores={leccionVideo.marcadores} />
        <NotasLeccion cursoId="c1" leccionId={leccionVideo.id} notas={leccionVideo.notas} recursos={leccionVideo.recursos} />
        <CtaLeccion cta="revision" texto={null} cursoId="c1" leccionId={leccionVideo.id} cursoTitulo={CURSO.titulo} entregaHref="/dev/curso" mentoria={mentoria} />
      </div>
    ),
    tab: <div className="max-w-3xl mx-auto"><TabInteractiva src="/dev-muestra.musicxml" /></div>,
    quiz: <div className="max-w-3xl mx-auto"><QuizAlumno cursoId="c1" leccionId={quiz.id} preguntas={quiz.preguntas} mejorPct={60} /></div>,
    entrega: <div className="max-w-3xl mx-auto"><EntregaReto cursoId="c1" leccionId={entrega.id} rubrica={entrega.rubrica} /></div>,
    preventa: (
      <div className="max-w-2xl mx-auto">
        <h1 className="font-coolvetica text-3xl mb-4">{CURSO.titulo}</h1>
        <PreventaAlumno slug={CURSO.slug} lanzamiento={preventa.lanzamiento} bonos={renglones(preventa.bonos)} />
      </div>
    ),
    venta: <VentaCurso c={publico} />,
    cerrada: <VentaCurso c={publicoCerrado} />,
    lanzada: <VentaCurso c={publicoLanzado} />,
    sitio: (
      <div className={`bg-[var(--bg)] ${claro ? "" : "dark"}`}>
        <AridoCursos cursos={[aTarjeta(publico)]} />
      </div>
    ),
  }[vista];

  return (
    <div className={`min-h-screen bg-lgb-black text-white ${esAdmin && claro ? "panel-light" : ""}`}>
      <div className="sticky top-0 z-50 flex flex-wrap gap-1.5 p-3 bg-lgb-dark border-b border-white/10">
        {VISTAS.map((v) => (
          <button key={v.id} onClick={() => setVista(v.id)}
            className={`text-xs px-3 py-1.5 rounded-full cursor-pointer ${vista === v.id ? "bg-white text-black" : "bg-white/10 text-white/70"}`}>{v.label}</button>
        ))}
        {(esAdmin || vista === "sitio") && (
          <button onClick={() => setClaro((c) => !c)} className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white/70 cursor-pointer ml-auto">
            {claro ? "Modo oscuro" : "Modo claro"}
          </button>
        )}
      </div>
      <div className={PAGINA_COMPLETA.includes(vista) ? "" : "p-4 sm:p-8"}>{contenido}</div>
    </div>
  );
}
