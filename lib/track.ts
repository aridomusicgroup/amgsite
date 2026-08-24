import posthog from "posthog-js";

/**
 * Evento de producto para el embudo de la tienda (PostHog). Es best-effort:
 *  - No hace nada en SSR ni si PostHog aún no se inicializó.
 *  - Respeta el consentimiento: si el usuario dio opt-out, posthog no captura.
 *
 * Eventos del embudo: preview_play → licencia_abierta → add_to_cart →
 * checkout_iniciado → compra.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined") return;
    // __loaded = true solo después de posthog.init (lo hace AnalyticsBehavior)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(posthog as any).__loaded) return;
    posthog.capture(event, props);
  } catch {
    /* best-effort: nunca romper la UI por analítica */
  }
}
