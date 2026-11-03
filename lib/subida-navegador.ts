/**
 * Lo que hace el navegador para subir UN archivo a Drive sin tener un token:
 * pide la sesión al servidor (que decide carpeta, nombre y espacio) y luego
 * manda los bytes directo a Google con esa URL. La usan "Sube tus archivos" y
 * "Tus voces" del panel del cliente.
 */

/** La URL de la sesión resumible (sólo sirve para ESTE archivo) y el tipo declarado. */
export interface SesionSubida {
  uploadUrl: string;
  mime: string;
}

/** Pide la sesión de subida de un archivo. Devuelve la URL o lanza con el motivo. */
export async function abrirSubida(pedidoId: string, file: File, clase: "archivo" | "voz"): Promise<SesionSubida> {
  const res = await fetch(`/api/cuenta/pedido/${pedidoId}/subida`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: file.name, bytes: file.size, mime: file.type, clase }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.uploadUrl) throw new Error(d.error || "No se pudo preparar la subida.");
  return { uploadUrl: String(d.uploadUrl), mime: String(d.mime || file.type || "application/octet-stream") };
}

/** Sube los bytes a la sesión de Google. Resuelve con el id del archivo creado. */
export function subirASesion(sesion: SesionSubida, file: File, onPct: (n: number) => void): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sesion.uploadUrl);
    xhr.setRequestHeader("Content-Type", sesion.mime);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error("Falló la subida."));
      try {
        const id = JSON.parse(xhr.responseText)?.id;
        if (id) return resolve(String(id));
      } catch { /* cae abajo */ }
      reject(new Error("Google no regresó el archivo."));
    };
    xhr.onerror = () => reject(new Error("Falló la subida."));
    xhr.send(file);
  });
}
