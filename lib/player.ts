"use client";
import { create } from "zustand";
import { Beat } from "./store";

interface PlayerStore {
  current: Beat | null;
  queue: Beat[];
  isPlaying: boolean;
  /** Play a beat. Optionally set the queue (e.g. the currently filtered list). */
  play: (beat: Beat, queue?: Beat[]) => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  current: null,
  queue: [],
  isPlaying: false,
  play: (beat, queue) => {
    const { current, isPlaying } = get();
    if (current?.id === beat.id) {
      set({ isPlaying: !isPlaying, ...(queue ? { queue } : {}) });
    } else {
      set({ current: beat, isPlaying: true, ...(queue ? { queue } : {}) });
    }
  },
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  next: () => {
    const { queue, current } = get();
    if (!queue.length || !current) return;
    const i = queue.findIndex((b) => b.id === current.id);
    const nextBeat = queue[(i + 1) % queue.length];
    set({ current: nextBeat, isPlaying: true });
  },
  prev: () => {
    const { queue, current } = get();
    if (!queue.length || !current) return;
    const i = queue.findIndex((b) => b.id === current.id);
    const prevBeat = queue[(i - 1 + queue.length) % queue.length];
    set({ current: prevBeat, isPlaying: true });
  },
  close: () => set({ current: null, isPlaying: false }),
}));
