"use client";
import { useEffect, useState } from "react";
import { OrigenesPanel } from "@/components/admin/OrigenesPanel";
import { OrigenCliente, ORIGEN_VACIO, type OrigenValor } from "@/components/admin/OrigenCliente";
import type { ResumenOrigenes } from "@/lib/origenes-data";

const REELS = [
  { id: "00000000-0000-0000-0000-000000000001", caption: "Top 5 requintos más difíciles 🔥", publicado_at: "2026-09-10T18:00:00Z", thumbnail: null, permalink: "https://instagram.com", reproducciones: 48210, tipo: "ranking", tipoManual: false },
  { id: "00000000-0000-0000-0000-000000000002", caption: "Cuando el cliente dice 'nomás un cambiecito' 😂", publicado_at: "2026-09-06T18:00:00Z", thumbnail: null, permalink: null, reproducciones: 31900, tipo: "humor", tipoManual: true },
  { id: "00000000-0000-0000-0000-000000000003", caption: "Beat CHANEL disponible, cotiza el tuyo", publicado_at: "2026-09-02T18:00:00Z", thumbnail: null, permalink: null, reproducciones: 6400, tipo: "venta", tipoManual: false },
];

const DATA: ResumenOrigenes = {
  completo: true,
  meses: [
    { mes: "2026-06", medianaReel: 9800, reels: 14, filas: [{ origen: "instagram", nuevos: 21, compradores: 3, ventas: 4, ventasMxn: 18400, clics: 0 }] },
    { mes: "2026-07", medianaReel: 8200, reels: 12, filas: [{ origen: "instagram", nuevos: 18, compradores: 2, ventas: 3, ventasMxn: 12900, clics: 0 }] },
    { mes: "2026-08", medianaReel: 7400, reels: 16, filas: [{ origen: "instagram", nuevos: 24, compradores: 4, ventas: 5, ventasMxn: 26100, clics: 0 }, { origen: "beatstars", nuevos: 11, compradores: 11, ventas: 12, ventasMxn: 9800, clics: 0 }] },
    { mes: "2026-09", medianaReel: 11250, reels: 9, filas: [
      { origen: "whatsapp", nuevos: 4, compradores: 3, ventas: 6, ventasMxn: 41200, clics: 0 },
      { origen: "instagram", nuevos: 29, compradores: 5, ventas: 5, ventasMxn: 22500, clics: 37 },
      { origen: "tiktok", nuevos: 6, compradores: 1, ventas: 1, ventasMxn: 14500, clics: 52 },
      { origen: "beatstars", nuevos: 9, compradores: 9, ventas: 9, ventasMxn: 6300, clics: 4 },
      { origen: "sin_origen", nuevos: 2, compradores: 1, ventas: 2, ventasMxn: 3900, clics: 0 },
    ] },
  ],
  conversionIg: { contactos: 71, compradores: 9, pct: 13 },
  tipos: [
    { tipo: "ranking", reels: 7, mediana: 22400, pctReproducciones: 38 },
    { tipo: "humor", reels: 9, mediana: 18100, pctReproducciones: 34 },
    { tipo: "proceso", reels: 5, mediana: 7300, pctReproducciones: 10 },
    { tipo: "venta", reels: 11, mediana: 4100, pctReproducciones: 12 },
    { tipo: null, reels: 3, mediana: 3900, pctReproducciones: 6 },
  ],
  reelsConClientes: [
    { id: "r1", caption: "Top 5 requintos más difíciles 🔥", permalink: "https://instagram.com", publicado_at: null, reproducciones: 48210, clientes: 3, ventasMxn: 18700 },
    { id: "r2", caption: "Cuando el cliente dice 'nomás un cambiecito' 😂", permalink: null, publicado_at: null, reproducciones: 31900, clientes: 1, ventasMxn: 0 },
  ],
  sinOrigen: { clientes: 6, ventasMxn: 43800 },
};

export function OrigenesHarness() {
  const [v, setV] = useState<OrigenValor>(ORIGEN_VACIO);
  useEffect(() => {
    const real = window.fetch;
    window.fetch = async (input, init) => {
      if (String(input).includes("/api/admin/social-posts")) {
        return new Response(JSON.stringify(init?.method === "PATCH" ? { ok: true } : { reels: REELS }), { status: 200 });
      }
      return real(input, init);
    };
    return () => { window.fetch = real; };
  }, []);
  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white";
  return (
    <main className="min-h-screen bg-lgb-dark text-white p-4 sm:p-8 space-y-10 max-w-6xl mx-auto">
      <OrigenesPanel data={DATA} isAdmin />
      <div className="grid grid-cols-2 gap-3 max-w-xl rounded-2xl border border-white/10 p-4">
        <OrigenCliente value={v} onChange={setV} requerido inputClass={inp} labelClass="block text-[11px] text-white/55 mb-1.5" />
      </div>
    </main>
  );
}
