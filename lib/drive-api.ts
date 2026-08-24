import crypto from "crypto";

/**
 * Integración mínima con Google Drive API usando una cuenta de servicio.
 * Auth por JWT firmado (RS256) → access token → Drive REST. Sin dependencias.
 * Requiere env GOOGLE_SERVICE_ACCOUNT = el JSON completo de la cuenta de servicio.
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getSA(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) return null;
    return { client_email: sa.client_email, private_key: String(sa.private_key).replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const sa = getSA();
  if (!sa) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 60) return cached.token;

  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned =
    `${enc({ alg: "RS256", typ: "JWT" })}.` +
    `${enc({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!j?.access_token) return null;
  cached = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

async function driveQuery(token: string, q: string, campos = "files(id,name,mimeType)") {
  const url =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      q,
      fields: campos,
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const j = await res.json().catch(() => null);
  return (j?.files || []) as Array<{ id: string; name: string; mimeType: string; parents?: string[] }>;
}

export interface HijoDrive {
  id: string;
  name: string;
  esCarpeta: boolean;
  padre: string;
}

/**
 * Contenido de MUCHAS carpetas de una sola vez.
 *
 * Se pregunta por lotes (`'a' in parents or 'b' in parents …`) porque auditar 55
 * beats carpeta por carpeta serían cientos de llamadas a Google: lento y con
 * riesgo de que corte por límite de tasa. Así son unas cuantas.
 *
 * Devuelve `null` solo si no hay cuenta de servicio; una carpeta sin permiso o
 * inexistente simplemente no trae hijos, y eso el que llama lo interpreta.
 */
export async function hijosDeCarpetas(folderIds: string[], porLote = 25): Promise<HijoDrive[] | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const ids = [...new Set(folderIds.filter(Boolean))];
  const out: HijoDrive[] = [];

  for (let i = 0; i < ids.length; i += porLote) {
    const lote = ids.slice(i, i + porLote);
    const q = `(${lote.map((id) => `'${id}' in parents`).join(" or ")}) and trashed = false`;
    const files = await driveQuery(token, q, "files(id,name,mimeType,parents)");
    for (const f of files) {
      // Un archivo puede tener varios padres; solo interesa el del lote.
      const padre = (f.parents || []).find((p) => lote.includes(p)) || (f.parents || [])[0] || "";
      out.push({ id: f.id, name: f.name, esCarpeta: f.mimeType === FOLDER_MIME, padre });
    }
  }
  return out;
}

/** Detecta las subcarpetas MP3/WAV/STEMS dentro de una carpeta de Drive. */
export async function findSubfolders(folderId: string): Promise<Record<string, string> | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const files = await driveQuery(
    token,
    `'${folderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`
  );
  const out: Record<string, string> = {};
  for (const f of files) {
    const n = (f.name || "").trim().toLowerCase();
    if (n === "mp3" || n === "wav" || n === "stems") out[n.toUpperCase()] = f.id;
  }
  return Object.keys(out).length ? out : null;
}

/** Para meter texto dentro de una consulta de Drive sin romperla. */
const escaparQ = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const normaliza = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

/**
 * Busca la carpeta cuyo nombre coincide con el título del beat.
 *
 * Devuelve `null` ante la duda, A PROPÓSITO. La versión anterior tomaba la
 * primera palabra del título y se quedaba con el PRIMER resultado: "EL CHICO
 * TEMIDO" buscaba "EL" y se enganchaba a cualquier carpeta que tuviera esas dos
 * letras. El beat quedaba "vinculado" a una carpeta ajena y nadie se enteraba
 * hasta que un cliente no recibía nada. Es mejor no encontrar nada — el panel
 * pide el link a mano — que apuntar en silencio al lugar equivocado.
 */
export async function findBeatFolderByName(title: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const clean = (title || "")
    .replace(/["'$]/g, "")
    .replace(/\b(type beat|corrido tumbado|peso pluma|junior h|instrumental|\d{4})\b/gi, "")
    .trim();
  if (!clean) return null;

  const objetivo = normaliza(clean);
  // Palabras con las que vale la pena buscar: las de 4+ letras no se topan con
  // media unidad. Si el título entero es corto, se usa completo.
  const termino = clean.split(/\s+/).find((w) => w.length >= 4) ?? (clean.length >= 4 ? clean : null);
  if (!termino) return null;

  const files = await driveQuery(
    token,
    `mimeType = '${FOLDER_MIME}' and name contains '${escaparQ(termino)}' and trashed = false`
  );
  if (!files.length) return null;

  // Solo cuenta como acierto un nombre que de verdad corresponde al beat: igual,
  // o uno contenido en el otro. Y si quedan varios candidatos, se prefiere no
  // adivinar.
  const candidatos = files.filter((f) => {
    const n = normaliza(f.name || "");
    return n === objetivo || n.includes(objetivo) || objetivo.includes(n);
  });
  const exacto = candidatos.find((f) => normaliza(f.name || "") === objetivo);
  if (exacto) return exacto.id;
  return candidatos.length === 1 ? candidatos[0].id : null;
}

/** ¿Está configurada la cuenta de servicio? */
export function driveConfigured(): boolean {
  return !!getSA();
}

/**
 * El correo de la cuenta de servicio.
 *
 * Se muestra en el panel cuando una carpeta se ve vacía: la causa más común no
 * es que falten archivos, sino que la carpeta nunca se compartió con este
 * correo. Drive no da error en ese caso — simplemente no devuelve nada.
 */
export function cuentaServicioEmail(): string | null {
  return getSA()?.client_email ?? null;
}

/**
 * Descarga (o un rango de) un archivo con la cuenta de servicio, pasando el
 * header `Range` tal cual para que el navegador pueda adelantar/atrasar un
 * video sin bajarlo completo. Devuelve la Response cruda de Google — el que
 * llama transmite su body y copia los headers relevantes. `null` = sin cuenta
 * de servicio configurada.
 */
export async function descargarArchivo(fileId: string, rangeHeader?: string | null): Promise<Response | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${new URLSearchParams({ alt: "media", supportsAllDrives: "true" })}`;
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (rangeHeader) headers.range = rangeHeader;
  return fetch(url, { headers });
}

/** ¿La carpeta existe y la puede ver la cuenta de servicio? */
export async function carpetaVisible(folderId: string): Promise<boolean | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const url =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?` +
    new URLSearchParams({ fields: "id,mimeType,trashed", supportsAllDrives: "true" });
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return false;
  const j = await res.json().catch(() => null);
  return j?.mimeType === FOLDER_MIME && !j?.trashed;
}
