import type { NextRequest } from "next/server";
import { DOMAINS } from "@/lib/site";
import { archivosDeCarpeta } from "@/lib/drive-oauth";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { limiteEfectivoMb } from "@/lib/almacenamiento";
import type { ProyectoDePedido } from "@/lib/cuenta-cliente";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Orígenes desde los que el navegador puede subir (CORS de la sesión resumible de Google). */
const ORIGENES = new Set([DOMAINS.main, "https://www.aridomusicgroup.com", "http://localhost:3000"]);

/**
 * El origen que se le declara a Google al abrir la sesión: el del navegador si
 * es uno nuestro, si no el dominio principal. Google sólo acepta el PUT del
 * navegador desde ese origen.
 */
export function origenDeSubida(req: NextRequest): string {
  const o = req.headers.get("origin") ?? "";
  return ORIGENES.has(o) ? o : DOMAINS.main;
}

export interface EspacioProyecto {
  folderId: string;
  archivos: { id: string; name: string; size?: string; webViewLink?: string }[];
  usadoBytes: number;
  limiteBytes: number;
}

/**
 * La carpeta de Drive del proyecto (creada si es la primera vez), lo que ya
 * hay en ella y cuánto le cabe. Lo comparten la lista de "Sube tus archivos" y
 * la apertura de cada subida, que es donde de verdad se cobra el espacio.
 */
export async function espacioDelProyecto(sb: SB, proy: ProyectoDePedido): Promise<EspacioProyecto | null> {
  const folderId = await carpetaDelProyecto(sb, proy.proyectoId);
  if (!folderId) return null;

  const archivos = await archivosDeCarpeta(folderId);
  const usadoBytes = archivos.reduce((a, f) => a + (f.size ? Number(f.size) : 0), 0);

  let defaults: Record<string, number> = {};
  try {
    const { data } = await sb.from("almacenamiento_tipos_default").select("tipo, limite_mb");
    for (const r of data ?? []) defaults[r.tipo as string] = Number(r.limite_mb) || 0;
  } catch {
    defaults = {};
  }
  const limiteMb = limiteEfectivoMb(proy.tipo, proy.limiteAlmacenamientoMb, defaults);

  return { folderId, archivos, usadoBytes, limiteBytes: limiteMb * 1024 * 1024 };
}
