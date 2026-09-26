"use client";
import { useState } from "react";
import rawBeats from "@/data/beats-beatstars.json";
import { BeatDetalle } from "@/components/admin/BeatDetalle";
import { AddBeatPanel } from "@/components/admin/AddBeatPanel";
import { fichaVacia } from "@/lib/beat-ficha";
import type { BeatDetalleAdmin, BeatListaAdmin } from "@/lib/beat-admin";
import type { CatalogBeat } from "@/lib/catalog";

/**
 * Sólo para desarrollo (ver app/dev/beat). La ficha de un beat y la lista con
 * datos de ejemplo (LAGRIMA$ y compañía); lo que piden al servidor se contesta
 * aquí, nada sale a la base.
 */

const crudo = (rawBeats as Array<{ id: string; title: string; artworkUrl: string; artworkLarge: string; hlsUrl: string | null; beatstarsUrl: string; bpm: number }>);
const lagrima = crudo.find((b) => b.id === "TK25708405")!;

const beat: CatalogBeat = {
  id: lagrima.id, slug: "lagrima-junior-h-type-beat", url: "https://beats.aridomusicgroup.com/beat/lagrima-junior-h-type-beat",
  title: "LAGRIMA$ JUNIOR H TYPE BEAT", bpm: 130, key: "D#m", genre: "Corrido Tumbado", artists: ["Junior H"], mood: "Sad",
  price: 25, exclusivePrice: 800, precios: { basic: 25, premium: 70, "premium-plus": 100, exclusive: 800 },
  plays: 4, likes: 1, tags: ["corrido", "tumbado", "sad"], coverGradient: ["#1a0508", "#c42f42"],
  artworkUrl: lagrima.artworkUrl, artworkLarge: lagrima.artworkLarge, previewUrl: null, hlsUrl: lagrima.hlsUrl,
  waveformUrl: null, beatstarsUrl: lagrima.beatstarsUrl, addedAt: 0,
  descripcion: "Corrido tumbado oscuro con requinto al frente, ideal para letras de desamor.",
  destacado: true, oculto: false, video: null,
};

const detalle: BeatDetalleAdmin = {
  id: beat.id,
  source: "original",
  nombreCorto: "lagrima$",
  beat,
  base: {
    bpm: 130, key: "D#m", genre: "Latin", artists: ["Junior H"], mood: "Energetic", tags: [],
    artworkUrl: lagrima.artworkUrl, artworkLarge: lagrima.artworkLarge,
  },
  preciosBase: { basic: 25, premium: 50, "premium-plus": 100, exclusive: 600 },
  exclusivaDirectaGlobal: 600,
  ficha: {
    ...fichaVacia(beat.id), genero: "Corrido Tumbado", mood: "Sad", tags: ["corrido", "tumbado", "sad"],
    descripcion: beat.descripcion, destacado: true, precios: { premium: 70, exclusive: 800 },
    notas: "Se lo ofrecimos a Tony por WhatsApp el 12-sep.", updated_at: "2026-09-24T18:00:00Z",
  },
  tablaFicha: true,
  audio: true,
  carpeta: { folderId: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345", manual: true, archivos: { MP3: 1, WAV: 1, STEMS: 0 } },
  publicaciones: [
    {
      id: "00000000-0000-0000-0000-000000000001", canal: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      titulo: "\"LAGRIMA$\" Junior H Type Beat | Corrido Tumbado 2026", miniatura: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      publicado_at: "2026-06-20", mostrar_en_tienda: true, social_post_id: null, metricas: null,
    },
    {
      id: "00000000-0000-0000-0000-000000000002", canal: "instagram", url: "https://www.instagram.com/reel/C8abc/",
      titulo: "Así suena LAGRIMA$ 🔥", miniatura: null, publicado_at: "2026-06-22", mostrar_en_tienda: false,
      social_post_id: "00000000-0000-0000-0000-0000000000aa", metricas: { reproducciones: 18400, likes: 612, comentarios: 34 },
    },
  ],
  sugerenciasIg: [
    { id: "00000000-0000-0000-0000-0000000000bb", permalink: "https://www.instagram.com/reel/C9xyz/", caption: "Top 5 beats de corrido tumbado de la semana: LAGRIMA$, MORRAS, CHAVALONAS…", thumbnail: null, publicado_at: "2026-07-02", reproducciones: 9200 },
  ],
  ventas: [
    { id: "v1", folio: "WEB-cs_live_a1b2c3d4e5f6g7h8i9", fecha: "2026-09-10", tipo: "Licencia (sitio)", canal: "sitio", moneda: "USD", monto: 70, mxn: 1260, cliente: "Brayan Chavira", licencia: "Premium License", via: "id", parcial: false },
    { id: "v2", folio: "BS-INV77812", fecha: "2026-01-25", tipo: "Licencia básica", canal: "beatstars", moneda: "USD", monto: 21.05, mxn: 368.38, cliente: "Fernando", licencia: null, via: "nombre", parcial: false },
    { id: "v3", folio: "I0231", fecha: "2025-11-02", tipo: "Exclusividad", canal: "whatsApp", moneda: "MXN", monto: 9000, mxn: 9000, cliente: null, licencia: null, via: "nombre", parcial: false },
  ],
  directCheckout: false,
  cuentaServicio: "arido-drive@precise-armor-457617-f6.iam.gserviceaccount.com",
};

const lista: BeatListaAdmin[] = crudo.slice(0, 8).map((b, i) => ({
  id: b.id,
  title: b.title.replace(/["“”]/g, ""),
  url: "#",
  bpm: i === 3 ? 0 : b.bpm,
  key: i === 3 ? null : "D#m",
  genre: "Latin",
  price: i === 0 ? 25 : 25,
  artworkUrl: b.artworkUrl,
  beatstarsUrl: b.beatstarsUrl,
  source: i === 1 ? "agregado" : "original",
  entrega: i === 4 ? "sin_carpeta" : "ok",
  audio: i !== 1,
  oculto: i === 6,
  destacado: i === 0,
  publicaciones: i < 2 ? 2 : 0,
  precioPropio: i === 0,
}));

if (typeof window !== "undefined" && !(window as unknown as { __bancoBeat?: boolean }).__bancoBeat) {
  (window as unknown as { __bancoBeat?: boolean }).__bancoBeat = true;
  const real = window.fetch.bind(window);
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/admin/catalog")) return json({ beats: lista, total: lista.length });
    if (url.includes("/entrega")) {
      return json({ ok: true, revision: {
        id: beat.id, title: beat.title, origen: "original", archivos: { MP3: 1, WAV: 1, STEMS: 0 }, sueltos: 2, estado: "parcial",
        puedeEntregar: ["Básica", "Premium"], noPuedeEntregar: ["Premium Plus", "Exclusiva"], carpetaId: "x", manual: true,
      } });
    }
    if (url.includes("/api/admin/")) return json({ ok: true });
    return real(input, init);
  };
}

export function BeatHarness() {
  const [claro, setClaro] = useState(false);
  const [vista, setVista] = useState<"ficha" | "lista">("ficha");
  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white p-5 sm:p-8`}>
      <div className="flex gap-4 mb-5 text-xs text-white/50">
        <button onClick={() => setClaro((c) => !c)} className="underline cursor-pointer">
          Banco de pruebas · modo {claro ? "oscuro" : "claro"}
        </button>
        <button onClick={() => setVista((v) => (v === "ficha" ? "lista" : "ficha"))} className="underline cursor-pointer">
          Ver {vista === "ficha" ? "la lista" : "la ficha"}
        </button>
      </div>
      {vista === "ficha" ? <BeatDetalle d={detalle} /> : <AddBeatPanel />}
    </div>
  );
}
