import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ENTIDADES_SENSIBLES, purgarActividadVieja } from "@/lib/actividad";
import { ENTIDADES_DE, type Modulo } from "@/lib/actividad-modulos";

export const dynamic = "force-dynamic";

// ── GET: bitácora del panel, con filtros ──────────────────────────────────────
// Los movimientos de dinero/comercial (ventas, pagos, cotizaciones, contratos,
// finanzas y accesos) SOLO los ve un admin. El resto del equipo ve Producción.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 200);
  const entidad = (url.searchParams.get("entidad") || "").trim();
  const actor = (url.searchParams.get("actor") || "").trim().toLowerCase();
  const q = (url.searchParams.get("q") || "").trim();
  const desde = (url.searchParams.get("desde") || "").trim();
  const modulo = (url.searchParams.get("modulo") || "").trim() as Modulo | "";
  const proyectoId = (url.searchParams.get("proyecto_id") || "").trim();

  try {
    const sb = supabaseAdmin();
    let query = sb
      .from("actividad")
      // `tarea_id` va en el select porque es lo que permite abrir la tarea
      // exacta al tocar el aviso (ver `destinoDe`).
      .select("id, tipo, titulo, proyecto_id, tarea_id, entidad, entidad_id, entidad_nombre, actor, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Bitácora de UN proyecto (pestaña Actividad de la página de detalle) — pasa
    // por encima del filtro por módulo, no se combinan.
    if (proyectoId) {
      query = query.eq("proyecto_id", proyectoId);
    } else if (modulo === "produccion") {
      query = query.or(
        `proyecto_id.not.is.null,tarea_id.not.is.null,entidad.in.(${ENTIDADES_DE.produccion.join(",")})`,
      );
    } else if (modulo === "clientes") {
      query = query
        .is("proyecto_id", null)
        .is("tarea_id", null)
        .in("entidad", ENTIDADES_DE.clientes);
    } else if (modulo === "finanzas") {
      query = query
        .is("proyecto_id", null)
        .is("tarea_id", null)
        .in("entidad", ENTIDADES_DE.finanzas);
    }

    // Blindaje por rol: quien no es admin nunca ve dinero/comercial/accesos.
    if (s.role !== "admin") {
      if (entidad && (ENTIDADES_SENSIBLES as string[]).includes(entidad)) {
        return NextResponse.json({ actividad: [] });
      }
      query = query.or(`entidad.is.null,entidad.not.in.(${ENTIDADES_SENSIBLES.join(",")})`);
      if (entidad) query = query.eq("entidad", entidad);
    } else if (entidad) {
      query = query.eq("entidad", entidad);
    }

    if (actor) query = query.eq("actor", actor);
    if (q) query = query.ilike("titulo", `%${q}%`);
    if (desde) query = query.gte("created_at", desde);

    const { data, error } = await query;
    if (error) return NextResponse.json({ actividad: [] });

    // Retención: borra lo de más de 6 meses (best-effort, no bloquea).
    void purgarActividadVieja(sb);

    return NextResponse.json({ actividad: data ?? [] });
  } catch {
    return NextResponse.json({ actividad: [] });
  }
}
