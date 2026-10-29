import type { PistaRpp } from "@/lib/render-jobs";

type PistaElegible = Pick<PistaRpp, "id" | "profundidad" | "silenciada">;

/**
 * Posiciones de lo que cuelga de la pista `i`: las siguientes que van más
 * adentro, hasta que la lista vuelve a su nivel. En REAPER una carpeta no
 * "contiene" nada en el archivo; sólo se reconoce porque lo que sigue está más
 * indentado.
 */
export function hijasDe(pistas: Pick<PistaRpp, "profundidad">[], i: number): number[] {
  const base = pistas[i]?.profundidad;
  if (base === undefined) return [];
  const hijas: number[] = [];
  for (let j = i + 1; j < pistas.length && pistas[j].profundidad > base; j++) hijas.push(j);
  return hijas;
}

/**
 * Marca o desmarca una pista para silenciarla.
 *
 * Elegir una carpeta marca también todas sus hijas. Hace falta porque silenciar
 * la carpeta apaga lo que pasa por ella, pero no los envíos que sus hijas hagan
 * a otros buses (una reverb compartida las seguiría oyendo).
 *
 * Una pista que ya viene silenciada en el proyecto, o sin `id` (inventario
 * publicado antes de que existiera el dato), no se puede elegir. Devuelve un
 * conjunto nuevo; el recibido no se toca.
 */
export function alternarSilencio(elegidas: ReadonlySet<string>, pistas: PistaElegible[], i: number): Set<string> {
  const siguiente = new Set(elegidas);
  const pista = pistas[i];
  if (!pista?.id || pista.silenciada) return siguiente;

  const ids = [i, ...hijasDe(pistas, i)]
    .map((k) => pistas[k])
    .filter((t) => t.id && !t.silenciada)
    .map((t) => t.id as string);

  if (elegidas.has(pista.id)) ids.forEach((id) => siguiente.delete(id));
  else ids.forEach((id) => siguiente.add(id));
  return siguiente;
}
