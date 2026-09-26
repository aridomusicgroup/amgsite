/**
 * Recorta al cuadrado (centrado) y encoge una imagen ANTES de subirla.
 *
 * Sin esto, una foto de celular de 4 MB viajaría entera para terminar
 * mostrándose a 40px (avatar) o a 400px (portada). WebP si el navegador puede;
 * JPEG de respaldo (Safari viejo). Sólo navegador.
 */
export async function cuadradoWebp(file: Blob, lado: number, calidad = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const corte = Math.min(bitmap.width, bitmap.height);
  // Nunca agrandar: una imagen de 600px no gana nada estirada a 1200.
  const salida = Math.min(lado, corte);
  const lienzo = document.createElement("canvas");
  lienzo.width = salida;
  lienzo.height = salida;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - corte) / 2, (bitmap.height - corte) / 2, corte, corte, 0, 0, salida, salida);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/webp", calidad));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise<Blob>((res, rej) =>
    lienzo.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la imagen."))), "image/jpeg", calidad),
  );
}

/** Medidas de una imagen sin subirla (para avisar si es muy chica). */
export async function medidas(file: Blob): Promise<{ ancho: number; alto: number }> {
  const bitmap = await createImageBitmap(file);
  const out = { ancho: bitmap.width, alto: bitmap.height };
  bitmap.close();
  return out;
}
