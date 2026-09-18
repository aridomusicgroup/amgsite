import Link from "next/link";
import { Check, X, ChevronDown, PlayCircle, ShieldCheck, MessageCircle } from "lucide-react";
import type { CursoPublico } from "@/lib/cursos-publico";
import { ETIQUETA_DE, esRellenar, formatoTiempo, parseFaqs, renglones } from "@/lib/cursos-tipos";
import { SOCIALS } from "@/lib/site";
import { BotonComprar } from "@/components/cursos/BotonComprar";

/*
 * La página de venta de un curso, separada de su ruta para poder revisarla en
 * el banco de pruebas (/dev/curso) con datos de ejemplo. Sin hooks: sirve tanto
 * desde el servidor como dentro de un componente de cliente.
 */

const PASOS = [
  { n: "1", t: "Lo mínimo", d: "Sólo la teoría que necesitas para tocar lo de hoy. Nada de clases eternas de pizarrón." },
  { n: "2", t: "Manos a la obra", d: "Lo tocas de inmediato: lento, a 0.5x y a tempo real, con pistas para tocar encima." },
  { n: "3", t: "Criterio", d: "El porqué: cuándo sí, cuándo no y por qué suena a corrido. Así dejas de depender de tutoriales." },
];

const HERRAMIENTAS = [
  "Reproductor de práctica: 0.5x sin cambiar el tono, repetir un pedazo y modo espejo",
  "Tablaturas que suenan: bájales el tempo, repite compases y silencia instrumentos",
  "Cómo sacar rolas con IA (Moises, LALAL.ai) y con el capo, paso a paso",
  "Bitácora de práctica con racha diaria para crear el hábito",
];

const wa = (texto: string) => `${SOCIALS.whatsapp}?text=${encodeURIComponent(texto)}`;

/** Página de venta pública: hero, clase gratis, método, temario, para quién, garantía y FAQ. */
export function VentaCurso({ c }: { c: CursoPublico }) {
  const L = c.config.landing;
  const promesa = esRellenar(L.promesa) ? null : L.promesa;
  const si = renglones(L.para_quien);
  const no = renglones(L.no_para_quien);
  const garantia = esRellenar(L.garantia) ? null : L.garantia;
  const faqs = parseFaqs(L.faqs);
  const gratis = c.modulos.flatMap((m) => m.lecciones).filter((l) => l.gratis);
  const trailer = gratis[0] ?? null;

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <Link href="/" className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white">Árido Music Group</Link>
        <Link href="/cuenta/login" className="text-xs text-white/60 hover:text-white">Ya soy alumno</Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-10">
        <p className="text-[11px] uppercase tracking-[0.2em] text-lgb-red mb-3">Curso en línea · a tu ritmo</p>
        <h1 className="font-coolvetica text-4xl sm:text-6xl leading-[0.95] mb-4">{c.titulo}</h1>
        {c.descripcion && <p className="text-lg text-white/75 leading-relaxed mb-3">{c.descripcion}</p>}
        {promesa && <p className="text-white/60 leading-relaxed mb-6">{promesa}</p>}
        <Stats c={c} />
        <Compra c={c} className="mt-8 max-w-sm" />
      </section>

      {trailer && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
          <video src={`/api/curso-preview/${trailer.id}`} controls playsInline preload="metadata" className="w-full aspect-video rounded-2xl bg-black" />
          <p className="text-xs text-white/50 mt-2">Clase gratis: {trailer.titulo}</p>
          {gratis.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {gratis.slice(1).map((l) => (
                <a key={l.id} href={`/api/curso-preview/${l.id}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-white/8 text-white/75 hover:text-white">
                  <PlayCircle size={13} /> {l.titulo}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Método */}
      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="font-coolvetica text-3xl mb-2">Así vas a aprender</h2>
          <p className="text-white/60 mb-8">Cada lección sigue el mismo ciclo. Tocas desde el primer día y entiendes lo que tocas.</p>
          <ol className="grid gap-4 sm:grid-cols-3">
            {PASOS.map((p) => (
              <li key={p.n} className="rounded-2xl border border-white/8 bg-lgb-black p-5">
                <span className="font-coolvetica text-3xl text-lgb-red">{p.n}</span>
                <p className="font-medium mt-2">{p.t}</p>
                <p className="text-sm text-white/60 mt-1 leading-relaxed">{p.d}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-8 grid gap-2.5">
            {HERRAMIENTAS.map((h) => (
              <li key={h} className="flex gap-2.5 text-sm text-white/80"><Check size={16} className="text-lgb-red shrink-0 mt-0.5" /> {h}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Temario */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="font-coolvetica text-3xl mb-2">El temario completo</h2>
        <p className="text-white/60 mb-6">
          Ruta principal para tocar, y rutas opcionales para ir a fondo (📚) y demostrar lo aprendido (🏆). Entre lecciones, ⚡ Datos Crack: la ciencia de tu docerola en 45 segundos.
        </p>
        <div className="flex flex-col gap-2">
          {c.modulos.map((m) => (
            <details key={m.titulo} className="group rounded-2xl border border-white/8 bg-white/[0.02] open:bg-white/[0.04]">
              <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer list-none">
                <span className="flex-1">
                  <span className="block font-medium">{m.titulo}</span>
                  {m.descripcion && <span className="block text-xs text-white/50 mt-0.5">{m.descripcion}</span>}
                </span>
                <span className="text-xs text-white/40 shrink-0">{m.lecciones.length}</span>
                <ChevronDown size={16} className="text-white/40 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="px-5 pb-4 flex flex-col gap-1.5">
                {m.lecciones.map((l) => (
                  <li key={l.id} className="flex items-center gap-2.5 text-sm text-white/75">
                    <span className="w-5 text-center shrink-0" aria-label={ETIQUETA_DE[l.etiqueta]?.label}>{ETIQUETA_DE[l.etiqueta]?.emoji}</span>
                    <span className="flex-1">{l.titulo}</span>
                    {l.gratis && <span className="text-[11px] px-2 py-0.5 rounded-full bg-lgb-red/20 text-white shrink-0">Gratis</span>}
                    {l.duracionSeg ? <span className="text-[11px] text-white/40 shrink-0">{formatoTiempo(l.duracionSeg)}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {(si.length > 0 || no.length > 0) && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-14 grid gap-4 sm:grid-cols-2">
          {si.length > 0 && (
            <div className="rounded-2xl border border-white/8 p-5">
              <h3 className="font-coolvetica text-xl mb-3">Es para ti si…</h3>
              <ul className="flex flex-col gap-2">{si.map((x) => <li key={x} className="flex gap-2 text-sm text-white/80"><Check size={16} className="text-green-400 shrink-0 mt-0.5" /> {x}</li>)}</ul>
            </div>
          )}
          {no.length > 0 && (
            <div className="rounded-2xl border border-white/8 p-5">
              <h3 className="font-coolvetica text-xl mb-3">No es para ti si…</h3>
              <ul className="flex flex-col gap-2">{no.map((x) => <li key={x} className="flex gap-2 text-sm text-white/80"><X size={16} className="text-white/40 shrink-0 mt-0.5" /> {x}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {garantia && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-14">
          <div className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <ShieldCheck size={22} className="text-green-400 shrink-0" />
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{garantia}</p>
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-14">
          <h2 className="font-coolvetica text-3xl mb-4">Preguntas frecuentes</h2>
          <div className="flex flex-col gap-2">
            {faqs.map((f) => (
              <details key={f.p} className="group rounded-2xl border border-white/8 px-5 py-4">
                <summary className="flex items-center gap-3 cursor-pointer list-none font-medium text-sm">
                  <span className="flex-1">{f.p}</span>
                  <ChevronDown size={16} className="text-white/40 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="text-sm text-white/70 mt-2 leading-relaxed whitespace-pre-line">{f.r}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-white/8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 text-center">
          <h2 className="font-coolvetica text-3xl mb-2">Empieza hoy</h2>
          <p className="text-white/60 mb-6">En 20 minutos ya estás rasgueando tu primer tumbado.</p>
          <Compra c={c} className="max-w-sm mx-auto" />
        </div>
      </section>
    </main>
  );
}

function Stats({ c }: { c: CursoPublico }) {
  const items = [
    { n: c.conteo.lecciones, t: "lecciones" },
    { n: c.conteo.capsulas, t: "Datos Crack" },
    { n: c.conteo.evaluaciones, t: "evaluaciones" },
    ...(c.revisionesIncluidas > 0 ? [{ n: c.revisionesIncluidas, t: c.revisionesIncluidas === 1 ? "revisión personal" : "revisiones personales" }] : []),
  ].filter((x) => x.n > 0);
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3">
      {items.map((x) => (
        <div key={x.t}>
          <dt className="sr-only">{x.t}</dt>
          <dd><span className="font-coolvetica text-2xl">{x.n}</span> <span className="text-sm text-white/60">{x.t}</span></dd>
        </div>
      ))}
    </dl>
  );
}

function Compra({ c, className }: { c: CursoPublico; className?: string }) {
  if (c.precioMxn && c.precioMxn > 0) return <BotonComprar cursoId={c.id} precio={c.precioMxn} className={className} />;
  return (
    <div className={className}>
      <a href={wa(`Hola, me interesa el curso ${c.titulo}.`)} target="_blank" rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 bg-lgb-red text-white px-6 py-4 rounded-full text-base font-medium hover:bg-red-700 transition-colors">
        <MessageCircle size={18} /> Quiero entrar
      </a>
      <p className="text-[11px] text-white/50 text-center mt-2">Te atendemos por WhatsApp.</p>
    </div>
  );
}
