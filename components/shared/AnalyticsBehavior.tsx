"use client";
// Analítica de comportamiento (PostHog + Microsoft Clarity) con consentimiento.
// - Solo carga en los sitios públicos (main + beats). NUNCA en el panel admin.
// - Se activa solo si hay llaves públicas en el entorno; si no, no hace nada.
// - PostHog arranca opted-out; captura solo tras "Aceptar".
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const CONSENT_KEY = "arido-consent";
const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;
const CONFIGURED = Boolean(PH_KEY || CLARITY_ID);

/** El admin (subdominio admin. o ruta /admin) nunca se rastrea. */
function esAdmin(): boolean {
  if (typeof window === "undefined") return true;
  return window.location.hostname.startsWith("admin.") || window.location.pathname.startsWith("/admin");
}
function sitio(): string {
  return typeof window !== "undefined" && window.location.hostname.startsWith("beats.") ? "beats" : "main";
}

let phReady = false;
function ensurePostHog() {
  if (phReady || !PH_KEY || typeof window === "undefined") return;
  phReady = true;
  posthog.init(PH_KEY, {
    api_host: PH_HOST,
    ui_host: "https://us.posthog.com",
    capture_pageview: false, // manual (App Router no dispara router events)
    capture_pageleave: true,
    autocapture: true, // clics/inputs → heatmaps automáticos
    person_profiles: "identified_only",
    opt_out_capturing_by_default: true, // hasta que haya consentimiento
    persistence: "localStorage+cookie",
  });
}

let clarityReady = false;
function loadClarity() {
  if (clarityReady || !CLARITY_ID || typeof window === "undefined") return;
  clarityReady = true;
  // Snippet oficial de Microsoft Clarity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (function (c: any, l: any, a: string, r: string, i: string) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

function Pageviews({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!enabled || !phReady) return;
    let url = window.location.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += "?" + qs;
    posthog.capture("$pageview", { $current_url: url, sitio: sitio() });
  }, [pathname, searchParams, enabled]);
  return null;
}

export function AnalyticsBehavior() {
  const [consent, setConsent] = useState<"unset" | "yes" | "no">("unset");
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!CONFIGURED || esAdmin()) return;
    setActive(true);
    ensurePostHog();
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved === "yes") { posthog.opt_in_capturing?.(); loadClarity(); setConsent("yes"); }
    else if (saved === "no") setConsent("no");
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "yes");
    if (PH_KEY) posthog.opt_in_capturing?.();
    loadClarity();
    setConsent("yes");
  };
  const reject = () => {
    localStorage.setItem(CONSENT_KEY, "no");
    if (PH_KEY) posthog.opt_out_capturing?.();
    setConsent("no");
  };

  if (!active) return null;

  return (
    <>
      <Suspense fallback={null}><Pageviews enabled={consent === "yes"} /></Suspense>
      {consent === "unset" && (
        <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[100] rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur text-white p-4 shadow-2xl">
          <p className="text-sm text-white/80 leading-relaxed">
            Usamos cookies y analítica para entender cómo usas el sitio y mejorarlo.{" "}
            <a href="/privacidad" className="underline hover:text-white">Más info</a>.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={accept} className="flex-1 bg-arido-red text-white text-sm font-medium rounded-lg px-3 py-2 hover:opacity-90 transition-opacity">Aceptar</button>
            <button onClick={reject} className="bg-white/10 text-white/80 text-sm rounded-lg px-3 py-2 hover:bg-white/15 transition-colors">Rechazar</button>
          </div>
        </div>
      )}
    </>
  );
}
