import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import driveLinks from "@/data/drive-links.json";
import rawBeats from "@/data/beats-beatstars.json";
import licensesRaw from "@/data/licenses.json";
import { cleanTitle } from "@/lib/beatstars";
import { EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { overridesCarpetas } from "@/lib/beat-carpetas";

/**
 * Descarga DIRECTA de un beat comprado en el sitio.
 *
 * Antes cada botón (MP3, WAV) abría la carpeta de Drive y el cliente tenía que
 * encontrar el archivo y bajarlo desde ahí. Ahora el botón apunta a
 * `/api/beat/descarga/[token]`, que busca el archivo dentro de la subcarpeta de
 * la licencia y redirige a la descarga de Google: el navegador baja el archivo
 * sin abrir Drive, y el archivo no pasa por el sitio (un WAV pesa ~80 MB).
 *
 * STEMS sigue abriendo la carpeta: son muchos archivos, no uno.
 *
 * El enlace va firmado (pedido + renglón + formato) para que sirva también desde
 * el correo, sin sesión. No da más de lo que ya daban las carpetas públicas.
 */

export type Formato = "MP3" | "WAV" | "STEMS";
export const DIRECTOS: readonly Formato[] = ["MP3", "WAV"];

export interface CarpetaBeat {
  driveFolderId: string;
  subfolders?: Record<string, string>;
}

export interface Descarga {
  label: string;
  url: string;
  /** true = baja el archivo; false = abre una carpeta de Drive. */
  directo: boolean;
}

const links = driveLinks as Record<string, CarpetaBeat>;
const catalogo = rawBeats as Array<{ id: string; title: string }>;
const licencias = licensesRaw as Array<{ id: string; price: number | null; exclusive: boolean; files: string[] }>;

export const carpetaUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

const clave = (t: string) => cleanTitle(t).toLowerCase();

/**
 * Título del beat → su carpeta. Los del catálogo original, los agregados desde
 * el panel (tabla `beats`) y, por encima de todo, la carpeta asignada a mano.
 */
export async function mapaDeCarpetas(sb: SupabaseClient): Promise<Map<string, CarpetaBeat>> {
  const mapa = new Map<string, CarpetaBeat>();
  const tituloPorId = new Map<string, string>();
  for (const b of catalogo) {
    tituloPorId.set(b.id, b.title);
    if (links[b.id]) mapa.set(clave(b.title), links[b.id]);
  }
  try {
    const { data } = await sb.from("beats").select("id, title, drive_folder_id, drive_subfolders");
    for (const b of data ?? []) {
      tituloPorId.set(b.id as string, b.title as string);
      if (b.drive_folder_id) {
        mapa.set(clave(b.title as string), {
          driveFolderId: b.drive_folder_id as string,
          subfolders: (b.drive_subfolders as Record<string, string>) || undefined,
        });
      }
    }
  } catch {
    /* sin beats extra en DB */
  }
  for (const [id, carpeta] of await overridesCarpetas()) {
    const t = tituloPorId.get(id);
    if (t) mapa.set(clave(t), carpeta);
  }
  return mapa;
}

export const carpetaDe = (mapa: Map<string, CarpetaBeat>, descripcion: string) =>
  mapa.get(String(descripcion).toLowerCase()) ?? mapa.get(clave(descripcion));

/** Según el monto pagado se deduce la licencia y qué formatos incluye. */
export function licenciaPorMonto(monto: number): { files: Formato[] | null; exclusive: boolean } {
  if (monto >= EXCLUSIVE_DIRECT_PRICE) return { files: null, exclusive: true };
  const lic = licencias.find((l) => !l.exclusive && l.price !== null && Math.abs(l.price - monto) < 0.5);
  return { files: (lic?.files as Formato[] | undefined) ?? null, exclusive: false };
}

/**
 * Los renglones de un pedido en orden fijo. El token guarda la POSICIÓN del
 * renglón, y los ids de `order_items` cambian si Stripe reintenta el webhook
 * (se borran y se vuelven a insertar); el orden por descripción no.
 */
export function itemsOrdenados<T extends { description: string; amount: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.description.localeCompare(b.description) || a.amount - b.amount);
}

const secreto = (): string | null => {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return k ? `arido-descarga-beat:${k}` : null;
};

const firma = (datos: string, k: string) => createHmac("sha256", k).update(datos).digest("base64url").slice(0, 24);

export function tokenDescarga(orderId: string, idx: number, formato: Formato): string | null {
  const k = secreto();
  if (!k) return null;
  const datos = `${orderId}.${idx}.${formato}`;
  return `${datos}.${firma(datos, k)}`;
}

export function leerTokenDescarga(token: string): { orderId: string; idx: number; formato: Formato } | null {
  const k = secreto();
  const partes = String(token || "").split(".");
  if (!k || partes.length !== 4) return null;
  const [orderId, i, formato, f] = partes;
  const idx = Number(i);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !Number.isInteger(idx) || idx < 0) return null;
  if (!(DIRECTOS as readonly string[]).includes(formato)) return null;
  const esperada = Buffer.from(firma(`${orderId}.${idx}.${formato}`, k));
  const recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  return { orderId, idx, formato: formato as Formato };
}

/**
 * Los botones de descarga de UN beat comprado: MP3 y WAV directos, STEMS a su
 * carpeta. Exclusiva = los tres. Sin subcarpetas (o sin saber la licencia) =
 * la carpeta general, como antes. `base` vacío para el panel; absoluta para el
 * correo. Sin `orderId` (no se guardó el pedido) no hay token: carpetas.
 */
export function descargasDeBeat(opts: {
  orderId: string | null;
  idx: number;
  carpeta: CarpetaBeat;
  monto: number;
  base?: string;
  /** La licencia exacta, cuando se conoce (el correo la trae por id). Si no, por monto. */
  licencia?: { files: Formato[] | null; exclusive: boolean };
}): Descarga[] {
  const { orderId, idx, carpeta, monto, base = "" } = opts;
  const { files, exclusive } = opts.licencia ?? licenciaPorMonto(monto);
  const sub = carpeta.subfolders;
  const formatos: Formato[] | null = exclusive ? ["WAV", "MP3", "STEMS"] : files;
  if (!sub || !formatos) return [{ label: "Todo", url: carpetaUrl(carpeta.driveFolderId), directo: false }];

  const out: Descarga[] = [];
  for (const f of formatos) {
    const id = sub[f];
    if (!id) continue;
    const token = orderId && DIRECTOS.includes(f) ? tokenDescarga(orderId, idx, f) : null;
    out.push(token
      ? { label: f, url: `${base}/api/beat/descarga/${token}`, directo: true }
      : { label: f, url: carpetaUrl(id), directo: false });
  }
  return out.length ? out : [{ label: "Descargar", url: carpetaUrl(carpeta.driveFolderId), directo: false }];
}
