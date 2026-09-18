import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getCursoPublico } from "@/lib/cursos-publico";
import { descuentoPct, pesos } from "@/lib/cursos-tipos";

/*
 * La tarjeta que sale al pegar el link del curso en WhatsApp o Facebook:
 * título, PREVENTA y precio (o el precio normal ya lanzado). Se regenera cada
 * 10 min para que el precio y los lugares no se queden viejos.
 */

export const alt = "Curso en línea — Árido Music Group";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 600;

const ROJO = "#c42f42";

async function archivo(ruta: string): Promise<Buffer | null> {
  try { return await readFile(join(process.cwd(), ruta)); } catch { return null; }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [c, fuente, logo] = await Promise.all([
    getCursoPublico(slug),
    archivo("public/fonts/Coolvetica-HvComp.otf"),
    archivo("public/logos/arido-blanco.png"),
  ]);
  const v = c?.venta;
  const titulo = c?.titulo ?? "Cursos Árido Music Group";
  const desc = v ? descuentoPct(v.precio, v.precioRegular) : null;

  const etiqueta = !v ? "CURSO EN LÍNEA"
    : v.estado === "preventa" ? "PREVENTA FUNDADOR"
    : v.estado === "preventa_cerrada" ? "MUY PRONTO" : "CURSO EN LÍNEA";
  const detalle = !v ? null
    : v.estado === "preventa" && v.quedan != null ? `Quedan ${v.quedan} lugares`
    : v.estado === "preventa" && v.lanzamiento ? `Lanzamiento: ${v.lanzamiento}`
    : v.estado === "preventa_cerrada" && v.lanzamiento ? `Lanzamiento: ${v.lanzamiento}` : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#0b0b0b", color: "#fff", fontFamily: fuente ? "Coolvetica" : "sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", top: -220, right: -160, width: 700, height: 700, borderRadius: 700, background: "radial-gradient(circle, rgba(196,47,66,0.45), rgba(196,47,66,0) 70%)", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", background: ROJO, color: "#fff", fontSize: 30, padding: "8px 22px", borderRadius: 999, letterSpacing: 2 }}>{etiqueta}</div>
          <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.55)", letterSpacing: 3 }}>ÁRIDO MUSIC GROUP</div>
        </div>

        <div style={{ display: "flex", fontSize: titulo.length > 28 ? 96 : 124, lineHeight: 0.95, maxWidth: 1000 }}>{titulo}</div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {v?.precio ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
                <div style={{ display: "flex", fontSize: 84 }}>{`${pesos(v.precio)} MXN`}</div>
                {v.estado === "preventa" && v.precioRegular ? (
                  <div style={{ display: "flex", fontSize: 46, color: "rgba(255,255,255,0.45)", textDecoration: "line-through" }}>{pesos(v.precioRegular)}</div>
                ) : null}
                {v.estado === "preventa" && desc ? (
                  <div style={{ display: "flex", fontSize: 38, color: ROJO }}>{`-${desc}%`}</div>
                ) : null}
              </div>
            ) : null}
            {detalle ? <div style={{ display: "flex", fontSize: 36, color: "rgba(255,255,255,0.7)" }}>{detalle}</div> : null}
          </div>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={`data:image/png;base64,${logo.toString("base64")}`} width={144} height={110} />
          ) : null}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fuente ? [{ name: "Coolvetica", data: fuente, style: "normal", weight: 400 }] : undefined,
    },
  );
}
