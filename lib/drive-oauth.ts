import "server-only";

/**
 * Escritura en Drive por OAuth (NO la cuenta de servicio) — una cuenta de
 * servicio tiene 0 bytes de cuota propia y no puede recibir archivos subidos
 * a menos que vivan en una Unidad Compartida (solo Workspace). En vez de eso,
 * esto actúa COMO `latinogangbeats@gmail.com` (autorizado una vez a mano),
 * usando SU cuota real. Scope `drive.file`: la app solo puede tocar carpetas y
 * archivos que ella misma creó — nunca el resto del Drive de esa cuenta.
 *
 * Separado por completo de `lib/drive-api.ts` (que sigue leyendo con la
 * cuenta de servicio, de solo lectura, para las carpetas de beats).
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

function creds(): { clientId: string; clientSecret: string; refreshToken: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export function driveOAuthConfigured(): boolean {
  return !!creds();
}

let cached: { token: string; exp: number } | null = null;

/**
 * Token de acceso de corta duración (~1h). Se cachea en memoria del proceso
 * mientras no expire — cada instancia serverless lo pide de nuevo, es barato.
 */
async function getAccessToken(): Promise<string | null> {
  const c = creds();
  if (!c) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 60) return cached.token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!j?.access_token) return null;
  cached = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

/**
 * El token que se le entrega AL NAVEGADOR del cliente para que suba directo a
 * Drive (sin pasar por nuestro servidor — así no hay límite de tamaño de
 * archivo de Vercel). Vive poco (el mismo ~1h de Google) y solo puede tocar
 * archivos que esta app haya creado (scope `drive.file`).
 */
export async function tokenParaNavegador(): Promise<{ accessToken: string; expiresAt: number } | null> {
  const c = creds();
  if (!c) return null;
  const token = await getAccessToken();
  if (!token || !cached) return null;
  return { accessToken: token, expiresAt: cached.exp * 1000 };
}

interface ArchivoDrive {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

/** Busca una subcarpeta por nombre exacto dentro de `parentId`, o la crea si no existe. */
export async function buscarOCrearCarpeta(nombre: string, parentId: string | null): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const escapado = nombre.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const padre = parentId ? `'${parentId}' in parents and ` : "";
  const q = `${padre}mimeType = '${FOLDER_MIME}' and name = '${escapado}' and trashed = false`;
  const buscar = await fetch(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
      q,
      fields: "files(id,name)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    })}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const encontrados = (await buscar.json().catch(() => null))?.files as Array<{ id: string }> | undefined;
  if (encontrados?.[0]?.id) return encontrados[0].id;

  const crear = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: nombre,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    }),
  });
  const nueva = await crear.json().catch(() => null);
  return nueva?.id ?? null;
}

/** Lo que hay en una carpeta (solo archivos, no subcarpetas) — para pintar la lista de subidos. */
export async function archivosDeCarpeta(folderId: string): Promise<ArchivoDrive[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const q = `'${folderId}' in parents and mimeType != '${FOLDER_MIME}' and trashed = false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
      q,
      fields: "files(id,name,mimeType,size,createdTime,webViewLink)",
      orderBy: "createdTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    })}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const j = await res.json().catch(() => null);
  return (j?.files ?? []) as ArchivoDrive[];
}
