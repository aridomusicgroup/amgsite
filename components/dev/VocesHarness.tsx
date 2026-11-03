"use client";
import { SubirVoces } from "@/components/cuenta/SubirVoces";
import { SubirArchivos } from "@/components/cuenta/SubirArchivos";

/**
 * Banco de pruebas de "Tus voces" (panel del cliente). Todo se contesta en el
 * navegador: el API del pedido (voces, espacio y la sesión de subida que abre
 * el servidor) y la subida a Google (una subida falsa con progreso). Dos
 * pedidos: una canción y un EP (pide el tema).
 *
 * Un archivo con "falla" en el nombre hace que el servidor falso rechace la
 * sesión. `window.__subidas` guarda cada sesión pedida, en orden, para revisar que las
 * voces salgan una por una. Si algo llama directo a googleapis.com (como el
 * camino viejo con token), falla a propósito.
 */
type VozFalsa = { id: string; nombre: string; bytes: number; temaId: string | null; estado: "recibida" | "en_sesion" };

const MB = 1024 * 1024;
const TEMAS = [{ id: "t1", titulo: "KHABALAH" }, { id: "t2", titulo: "EFÍMERO" }, { id: "t3", titulo: "PROFECÍA" }];
const LIMITE = 2048 * MB;
const usado: Record<string, number> = { cancion: 131 * MB, ep: 40 * MB };
const datos: Record<string, { pideTema: boolean; voces: VozFalsa[] }> = {
  cancion: {
    pideTema: false,
    voces: [
      { id: "v1", nombre: "Lead verso.wav", bytes: 52 * MB, temaId: null, estado: "en_sesion" },
      { id: "v2", nombre: "Doble lead.wav", bytes: 48 * MB, temaId: null, estado: "en_sesion" },
      { id: "v3", nombre: "Coros finales con un nombre bien largo de archivo.wav", bytes: 31 * MB, temaId: null, estado: "recibida" },
    ],
  },
  ep: { pideTema: true, voces: [{ id: "v9", nombre: "Lead.wav", bytes: 40 * MB, temaId: "t2", estado: "recibida" }] },
};

if (typeof window !== "undefined" && !(window as unknown as { __vocesFalsas?: boolean }).__vocesFalsas) {
  (window as unknown as { __vocesFalsas?: boolean }).__vocesFalsas = true;
  const real = window.fetch.bind(window);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const m = /\/api\/cuenta\/pedido\/([^/]+)\/(voces|espacio|subida|subida-confirmada)(?=$|\?)/.exec(url);
    if (m) {
      const d = datos[m[1]];
      if (m[2] === "espacio") return json({ archivos: [], limiteBytes: LIMITE, usadoBytes: usado[m[1]] });
      if (m[2] === "subida-confirmada") return json({ ok: true });
      if (m[2] === "subida") {
        const b = JSON.parse(String(init?.body));
        const w = window as unknown as { __subidas?: unknown[] };
        (w.__subidas ??= []).push({ pedido: m[1], ...b });
        // Un nombre con "falla" = Google rechaza la sesión (para ver el mensaje de error).
        if (/falla/i.test(b.nombre)) return json({ error: "Google no aceptó la subida. Intenta en un momento." }, 502);
        if (b.clase === "voz" && !/\.wav$/i.test(b.nombre)) return json({ error: "Tu voz tiene que ser un archivo WAV." }, 400);
        if (usado[m[1]] + b.bytes > LIMITE) return json({ error: `"${b.nombre}" no cabe.` }, 413);
        usado[m[1]] += b.bytes;
        return json({ uploadUrl: `https://subida.falsa/${encodeURIComponent(b.nombre)}`, mime: b.mime || "audio/wav" });
      }
      if (init?.method === "POST") {
        const b = JSON.parse(String(init.body));
        d.voces.push({ id: crypto.randomUUID(), nombre: b.nombre, bytes: 20 * MB, temaId: b.temaId, estado: "recibida" });
        return json({ ok: true });
      }
      return json({ acepta: true, disponible: true, pideTema: d.pideTema, temas: d.pideTema ? TEMAS : [], voces: d.voces });
    }
    if (url.includes("googleapis.com")) throw new Error(`El navegador no debe hablar con Google con token: ${url}`);
    return real(input, init);
  };

  // La subida a Google: progreso en 10 pasos y responde el archivo creado.
  const XHRReal = window.XMLHttpRequest;
  class XHRFalso {
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    responseText = "";
    private real: XMLHttpRequest | null = null;
    private url = "";
    open(_m: string, url: string) { this.url = url; if (!url.startsWith("https://subida.falsa")) { this.real = new XHRReal(); this.real.open(_m, url); } }
    setRequestHeader() { /* */ }
    send(body?: Document | XMLHttpRequestBodyInit | null) {
      if (this.real) { this.real.send(body); return; }
      const w = window as unknown as { __puts?: string[] };
      (w.__puts ??= []).push(`inicio ${decodeURIComponent(this.url.split("/").pop() ?? "")}`);
      let n = 0;
      const t = setInterval(() => {
        n += 1;
        this.upload.onprogress?.({ lengthComputable: true, loaded: n, total: 10 });
        if (n >= 10) { clearInterval(t); w.__puts?.push(`fin ${decodeURIComponent(this.url.split("/").pop() ?? "")}`); this.status = 200; this.responseText = JSON.stringify({ id: `drive${Date.now()}` }); this.onload?.(); }
      }, 120);
    }
  }
  window.XMLHttpRequest = XHRFalso as unknown as typeof XMLHttpRequest;
}

export function VocesHarness() {
  return (
    <div className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <p className="text-[11px] text-white/30 mb-2">Pedido de una canción (mezcla de voces)</p>
        <SubirVoces pedidoId="cancion" />
        <SubirArchivos pedidoId="cancion" />
        <hr className="border-white/10 my-8" />
        <p className="text-[11px] text-white/30 mb-2">Pedido de EP (pide la canción)</p>
        <SubirVoces pedidoId="ep" />
      </div>
    </div>
  );
}
