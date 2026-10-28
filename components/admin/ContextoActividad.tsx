import { Music2, User } from "lucide-react";
import { contextoDe, type ItemActividad } from "@/lib/actividad-modulos";

/**
 * Proyecto y cliente del aviso, debajo de su texto. "Agregó la tarea
 * ‘Estructura’" no dice de quién es hasta que lo abres; esto lo dice a la vista.
 * Si el texto ya los menciona, no los repite (ver `contextoDe`).
 */
export function ContextoActividad({
  it,
  className = "",
}: {
  it: Pick<ItemActividad, "titulo" | "proyecto_titulo" | "cliente_nombre">;
  className?: string;
}) {
  const { proyecto, cliente } = contextoDe(it);
  if (!proyecto && !cliente) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] leading-snug text-white/55 ${className}`}>
      {proyecto && (
        <span className="inline-flex items-start gap-1 min-w-0">
          <Music2 size={11} className="mt-[2px] shrink-0 text-white/35" aria-hidden />
          <span className="sr-only">Proyecto: </span>
          <span className="break-words min-w-0">{proyecto}</span>
        </span>
      )}
      {cliente && (
        <span className="inline-flex items-start gap-1 min-w-0">
          <User size={11} className="mt-[2px] shrink-0 text-white/35" aria-hidden />
          <span className="sr-only">Cliente: </span>
          <span className="break-words min-w-0">{cliente}</span>
        </span>
      )}
    </p>
  );
}
