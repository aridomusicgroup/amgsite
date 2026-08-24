"use client";
import { useEffect, useState } from "react";

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent).detail as string;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, msg }]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 2600);
    };
    window.addEventListener("arido-toast", onToast);
    return () => window.removeEventListener("arido-toast", onToast);
  }, []);

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none">
      {items.map((x) => (
        <div key={x.id} className="bg-lgb-dark border border-white/15 text-white text-sm px-4 py-2 rounded-full shadow-2xl animate-fade-in">
          {x.msg}
        </div>
      ))}
    </div>
  );
}
