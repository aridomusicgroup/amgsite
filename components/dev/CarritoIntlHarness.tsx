"use client";
import { useEffect, useState } from "react";
import { LGBCart } from "@/components/lgb/Cart";
import { useCartStore, type Beat } from "@/lib/store";

const BEAT: Beat = {
  id: "dev-beat", title: "CHANEL", bpm: 90, key: "Am", genre: "corridos", artists: ["ARIDO"],
  mood: "oscuro", price: 30, plays: 0, likes: 0, tags: [], coverGradient: ["#222", "#444"],
};

// El parche va al importar, no en un efecto: los efectos de los hijos corren
// antes que los del padre, y el carrito ya habría preguntado el país.
let paisSimulado = "US";
if (typeof window !== "undefined" && !("__paisParcheado" in window)) {
  (window as unknown as Record<string, boolean>).__paisParcheado = true;
  const real = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/api/pais")) {
      return new Response(JSON.stringify({ pais: paisSimulado, internacional: paisSimulado !== "MX" }), { status: 200 });
    }
    return real(input, init);
  };
}

/** Simula una visita desde Estados Unidos: el carrito debe mostrar el 7%. */
export function CarritoIntlHarness() {
  const { addItem, items, isOpen, toggleCart } = useCartStore();
  const [pais, setPais] = useState("US");

  useEffect(() => { paisSimulado = pais; }, [pais]);

  useEffect(() => {
    if (!items.length) addItem({ beat: BEAT, licenseId: "mp3", licenseName: "MP3", price: 30 });
    if (!isOpen) toggleCart();
    // Sólo al montar: el harness prepara el estado una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-lgb-dark text-white p-8">
      <div className="flex gap-2 mb-4">
        {["US", "MX"].map((p) => (
          <button key={p} onClick={() => setPais(p)}
            className={`rounded-full px-3 py-1 text-sm ${pais === p ? "bg-white/20" : "bg-white/5"}`}>
            Simular {p}
          </button>
        ))}
      </div>
      <p className="text-white/50 text-sm">Carrito: 1 beat de $30 USD. Desde US debe salir $2.10 de comisión y total $32.10.</p>
      <LGBCart />
    </main>
  );
}
