"use client";
import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Users, Upload, Mic2, Check, Loader2 } from "lucide-react";
import { CTA_TEXTO_DEFAULT, type Cta, type EstadoMentoria } from "@/lib/cursos-tipos";
import { SOCIALS } from "@/lib/site";

export interface ContextoMentoria {
  estado: EstadoMentoria;
  cursoId: string | null;
  precioMes: number | null;
  esMiembro: boolean;
}

const wa = (texto: string) => `${SOCIALS.whatsapp}?text=${encodeURIComponent(texto)}`;

/**
 * El llamado al final de algunas lecciones (máximo uno por módulo). Se adapta
 * a cómo está la mentoría: apagada → WhatsApp; lista de espera → “Anótame”
 * con un clic; abierta → pagar el mes. Si ya es miembro, le recuerda la sesión.
 */
export function CtaLeccion({ cta, texto, cursoId, leccionId, cursoTitulo, mentoria, entregaHref }: {
  cta: Cta;
  texto: string | null;
  cursoId: string;
  leccionId: string;
  cursoTitulo: string;
  mentoria: ContextoMentoria;
  /** A dónde mandar para usar la revisión incluida (la Evaluación 1-A, normalmente). */
  entregaHref: string | null;
}) {
  const [estado, setEstado] = useState<"idle" | "busy" | "ok" | "error">("idle");
  if (cta === "ninguno") return null;

  const cuerpo = texto ?? CTA_TEXTO_DEFAULT[cta];

  const anotarme = async () => {
    setEstado("busy");
    const res = await fetch(`/api/cuenta/curso/${cursoId}/interes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leccion_id: leccionId }),
    }).catch(() => null);
    setEstado(res?.ok ? "ok" : "error");
  };

  const pagarMes = async () => {
    if (!mentoria.cursoId) return;
    setEstado("busy");
    const res = await fetch("/api/checkout-curso", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curso_id: mentoria.cursoId, modo: "mentoria_mes" }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (data?.url) window.location.href = data.url;
    else setEstado("error");
  };

  const btn = "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-60";
  const principal = `${btn} bg-lgb-red text-white hover:bg-red-700`;
  const secundario = `${btn} bg-white/8 text-white/80 hover:text-white`;

  let accion: React.ReactNode;
  if (cta === "estudio") {
    accion = <a href={wa(`Hola, soy alumno de ${cursoTitulo} y quiero grabar mi arreglo en el estudio.`)} target="_blank" rel="noopener noreferrer" className={principal}><Mic2 size={15} /> Cotizar mi grabación</a>;
  } else if (cta === "whatsapp") {
    accion = <a href={wa(`Hola, soy alumno de ${cursoTitulo} y tengo una duda.`)} target="_blank" rel="noopener noreferrer" className={principal}><MessageCircle size={15} /> Escribir por WhatsApp</a>;
  } else if (mentoria.esMiembro) {
    accion = <p className="text-sm text-green-400 flex items-center gap-1.5"><Check size={15} /> Ya estás en la mentoría: tráelo a la próxima sesión.</p>;
  } else if (cta === "revision" && entregaHref && mentoria.estado !== "abierta") {
    accion = <Link href={entregaHref} className={principal}><Upload size={15} /> Subir mi video</Link>;
  } else if (mentoria.estado === "abierta" && mentoria.cursoId) {
    accion = (
      <button onClick={pagarMes} disabled={estado === "busy"} className={principal}>
        {estado === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
        Entrar a la mentoría{mentoria.precioMes ? ` · $${mentoria.precioMes.toLocaleString("es-MX")}/mes` : ""}
      </button>
    );
  } else if (mentoria.estado === "lista_espera") {
    accion = estado === "ok"
      ? <p className="text-sm text-green-400 flex items-center gap-1.5"><Check size={15} /> Listo, te avisamos en cuanto abramos lugares.</p>
      : <button onClick={anotarme} disabled={estado === "busy"} className={principal}>
          {estado === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />} Anótame en la mentoría
        </button>;
  } else {
    accion = <a href={wa(`Hola, soy alumno de ${cursoTitulo}. Me interesa que revisen cómo toco.`)} target="_blank" rel="noopener noreferrer" className={secundario}><MessageCircle size={15} /> Escríbenos</a>;
  }

  return (
    <aside className="rounded-2xl border border-lgb-red/30 bg-lgb-red/[0.06] p-5">
      <p className="text-sm text-white/85 leading-relaxed mb-4">{cuerpo}</p>
      {accion}
      {estado === "error" && <p className="text-xs text-red-400 mt-2">No se pudo completar. Intenta de nuevo o escríbenos por WhatsApp.</p>}
    </aside>
  );
}
