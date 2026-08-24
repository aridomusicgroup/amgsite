"use client";
import { useState, useEffect } from "react";
import { BellRing, BellOff, BellPlus, Loader2 } from "lucide-react";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type Estado = "cargando" | "ios-instalar" | "no-soportado" | "off" | "on" | "denegado";

export function PushToggle() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!soportado) {
      // iPhone que aún NO está añadido al inicio: el push existe pero no está disponible
      const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error propiedad propia de Safari iOS
        window.navigator.standalone === true;
      setEstado(esIOS && !standalone ? "ios-instalar" : "no-soportado");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setEstado("on");
        else if (Notification.permission === "denied") setEstado("denegado");
        else setEstado("off");
      })
      .catch(() => setEstado("no-soportado"));
  }, []);

  const activar = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEstado(perm === "denied" ? "denegado" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (res.ok) setEstado("on");
    } catch {
      /* */
    } finally {
      setBusy(false);
    }
  };

  const desactivar = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEstado("off");
    } catch {
      /* */
    } finally {
      setBusy(false);
    }
  };

  if (estado === "cargando" || estado === "no-soportado") return null;

  if (estado === "ios-instalar") {
    return (
      <span className="text-[11px] text-white/40 max-w-[9rem] leading-tight text-right">
        Añade la app a tu inicio para recibir notificaciones 📲
      </span>
    );
  }

  if (estado === "on") {
    return (
      <button
        onClick={desactivar}
        disabled={busy}
        title="Notificaciones activadas — clic para desactivar"
        className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
      </button>
    );
  }

  if (estado === "denegado") {
    return (
      <span
        title="Notificaciones bloqueadas. Actívalas en los ajustes del navegador/app."
        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30"
      >
        <BellOff size={16} />
      </span>
    );
  }

  // off
  return (
    <button
      onClick={activar}
      disabled={busy}
      className="flex items-center gap-1.5 bg-lgb-red hover:bg-red-700 text-white text-xs font-medium px-3 py-2 rounded-full transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <BellPlus size={14} />}
      Activar notis
    </button>
  );
}
