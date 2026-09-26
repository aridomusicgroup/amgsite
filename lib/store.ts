"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Beat {
  id: string;
  slug?: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  artists: string[];
  mood: string;
  price: number;
  plays: number;
  likes: number;
  tags: string[];
  coverGradient: string[];
  artworkUrl?: string;
  artworkLarge?: string;
  previewUrl?: string | null;
  hlsUrl?: string | null;
  waveformUrl?: string;
  beatstarsUrl?: string;
  /** Precio de cada licencia de ESTE beat (lo calcula el servidor); null = se negocia. */
  precios?: Record<string, number | null>;
  descripcion?: string | null;
  destacado?: boolean;
  /** Id del video de YouTube para su página. */
  video?: string | null;
}

export interface License {
  id: string;
  badge: string;
  color: string;
  price: number | null;
  popular: boolean;
  exclusive: boolean;
  files: string[];
  name: { es: string; en: string };
  description: { es: string; en: string };
  features: { es: string[]; en: string[] };
  notIncluded: { es: string[]; en: string[] };
}

export interface CartItem {
  beat: Beat;
  licenseId: string;
  licenseName: string;
  price: number;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (beatId: string) => void;
  clearCart: () => void;
  toggleCart: () => void;
  total: () => number;
  /**
   * Pone al día los precios del carrito con lo que acaba de llegar del
   * catálogo. El carrito vive en localStorage: si el precio de un beat cambió
   * desde que se agregó, se vería un total y Stripe cobraría otro.
   */
  sincronizarPrecios: (beats: Beat[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (item) => {
        const existing = get().items.find((i) => i.beat.id === item.beat.id);
        if (!existing) {
          set((s) => ({ items: [...s.items, item] }));
        } else {
          set((s) => ({
            items: s.items.map((i) =>
              i.beat.id === item.beat.id ? item : i
            ),
          }));
        }
      },
      removeItem: (beatId) =>
        set((s) => ({ items: s.items.filter((i) => i.beat.id !== beatId) })),
      clearCart: () => set({ items: [] }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
      total: () => get().items.reduce((acc, i) => acc + i.price, 0),
      sincronizarPrecios: (beats) => {
        const porId = new Map(beats.map((b) => [b.id, b]));
        const actual = get().items;
        let cambio = false;
        const items = actual.flatMap((i) => {
          const b = porId.get(i.beat.id);
          if (!b?.precios || !(i.licenseId in b.precios)) return [i];
          const precio = b.precios[i.licenseId];
          // La licencia dejó de venderse aquí (p. ej. la exclusiva pasó a negociarse).
          if (precio == null) { cambio = true; return []; }
          if (precio === i.price) return [i];
          cambio = true;
          return [{ ...i, beat: b, price: precio }];
        });
        if (cambio) set({ items });
      },
    }),
    { name: "lgb-cart" }
  )
);
