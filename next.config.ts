import type { NextConfig } from "next";

// Content-Security-Policy: limita de dónde se puede cargar cada tipo de recurso.
// Scoped a lo que la app realmente usa (Stripe, Supabase, BeatStars, Vercel Analytics, Drive).
const csp = [
  "default-src 'self'",
  // 'unsafe-inline' necesario para el script de tema y JSON-LD; no hay sinks de XSS (sin HTML de usuario)
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://js.stripe.com https://us-assets.i.posthog.com https://*.clarity.ms",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // fetch/XHR/HLS: Supabase, audio de BeatStars, Stripe, analytics de Vercel, subida directa a Drive
  "connect-src 'self' https://*.supabase.co https://*.beatstars.com https://api.stripe.com https://*.vercel-insights.com https://vitals.vercel-insights.com https://us.i.posthog.com https://us-assets.i.posthog.com https://*.clarity.ms https://c.bing.com https://www.googleapis.com",
  "media-src 'self' https://*.beatstars.com blob:",
  "worker-src 'self' blob:",
  "frame-src https://js.stripe.com https://checkout.stripe.com https://www.youtube-nocookie.com https://www.youtube.com",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Solo en producción: en dev fuerza https://localhost y rompe el servidor local.
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Fuerza HTTPS por 2 años en todos los subdominios
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Anti-clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Evita que el navegador "adivine" tipos de archivo (anti-MIME-sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la URL completa al navegar a otros sitios
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desactiva APIs sensibles del navegador que la app no usa
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // no revelar "X-Powered-By: Next.js"
  skipTrailingSlashRedirect: true, // requerido por el reverse proxy de PostHog
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Reverse proxy de PostHog: la analítica sale por NUESTRO dominio (/ingest) →
    // el CSP la permite como 'self' y los ad-blockers no la tumban.
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn5.beatstars.com" },
      { protocol: "https", hostname: "content.beatstars.com" },
      { protocol: "https", hostname: "prod-bts-track.s3.amazonaws.com" },
    ],
  },
};

export default nextConfig;
