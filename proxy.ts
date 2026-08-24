import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Mantiene viva la sesión de Supabase: valida y renueva el access token y
 * reescribe las cookies frescas en la respuesta. Sin esto la sesión caduca en
 * ~1h y el equipo tiene que re-loguearse seguido. Solo en el subdominio admin.
 */
async function refreshAdminSession(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (toSet) =>
            toSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            ),
        },
      }
    );
    await supabase.auth.getUser(); // dispara el refresh del token si hace falta
  } catch {
    /* sin sesión o sin red: continuar normal */
  }
  return response;
}

/**
 * Host-based routing:
 * beats.aridomusicgroup.com  → renders the /beats route at the subdomain root.
 * admin.aridomusicgroup.com  → renders the /admin route at the subdomain root.
 * aridomusicgroup.com/beats* → redirects to the beats subdomain (canonical).
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl.clone();

  // Archivos PWA estáticos: servir tal cual en cualquier host (el SW en la raíz
  // necesita scope "/", así que NO se reescribe al subdominio admin).
  // /ingest = reverse proxy de PostHog (lo maneja next.config rewrites): debe
  // pasar intacto en TODOS los hosts. Sin esto, en beats. se reescribía a
  // /beats/ingest/* y la analítica del embudo (que vive en beats.) caía a 404.
  if (
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/ingest")
  ) {
    return NextResponse.next();
  }

  if (host.startsWith("admin.")) {
    let response: NextResponse;
    if (!url.pathname.startsWith("/admin") && !url.pathname.startsWith("/api")) {
      url.pathname = url.pathname === "/" ? "/admin" : `/admin${url.pathname}`;
      response = NextResponse.rewrite(url);
    } else {
      response = NextResponse.next();
    }
    return refreshAdminSession(request, response);
  }

  if (host.startsWith("beats.")) {
    if (!url.pathname.startsWith("/beats") && !url.pathname.startsWith("/api")) {
      url.pathname = url.pathname === "/" ? "/beats" : `/beats${url.pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Dominio principal: /beats vive en el subdominio
  if (
    (host === "aridomusicgroup.com" || host === "www.aridomusicgroup.com") &&
    url.pathname.startsWith("/beats")
  ) {
    const rest = url.pathname.replace(/^\/beats/, "") || "/";
    return NextResponse.redirect(
      `https://beats.aridomusicgroup.com${rest}${url.search}`,
      308
    );
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|logos/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|otf|ttf|woff2?)).*)"],
};
