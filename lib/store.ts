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
    }),
    { name: "lgb-cart" }
  )
);
