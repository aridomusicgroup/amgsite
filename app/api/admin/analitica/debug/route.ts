import { NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

// Diagnóstico: hace llamadas puntuales a la Graph API y devuelve los errores/valores
// crudos para entender por qué faltan métricas. NO expone el token.
async function raw(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  return json as Record<string, unknown>;
}

function err(j: Record<string, unknown>): string {
  const e = j.error as { message?: string } | undefined;
  return e?.message ?? "ok";
}

export async function GET() {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const token = process.env.META_SYSTEM_TOKEN;
  if (!token) return NextResponse.json({ error: "Falta META_SYSTEM_TOKEN" }, { status: 500 });

  const sb = supabaseAdmin();
  const c = await sb.from("social_cuentas").select("external_id").eq("activo", true).limit(1);
  const igId = (c.data?.[0]?.external_id as string) ?? null;
  if (!igId) return NextResponse.json({ error: "Sin cuenta en social_cuentas" }, { status: 400 });

  const summary: Record<string, unknown> = { igId };

  // Permisos del token
  const dt = await raw("debug_token", { input_token: token }, token);
  const dtData = dt.data as { scopes?: string[] } | undefined;
  summary.scopes = dtData?.scopes ?? err(dt);

  // Cuenta básica
  const acc = await raw(igId, { fields: "username,followers_count,media_count" }, token);
  summary.account = { error: err(acc), username: acc.username, followers: acc.followers_count };

  // Alcance de cuenta (dos formatos)
  const ar1 = await raw(`${igId}/insights`, { metric: "reach", period: "day" }, token);
  const ar2 = await raw(`${igId}/insights`, { metric: "reach", period: "day", metric_type: "total_value" }, token);
  const arData1 = (ar1.data as { values?: { value: number }[] }[] | undefined)?.[0]?.values?.[0]?.value;
  const arData2 = (ar2.data as { total_value?: { value: number } }[] | undefined)?.[0]?.total_value?.value;
  summary.account_reach = { v1_error: err(ar1), v1_value: arData1 ?? null, v2_error: err(ar2), v2_value: arData2 ?? null };

  // Insights del primer post: probamos el formato clásico vs total_value (crudos)
  const media = await raw(`${igId}/media`, { fields: "id,media_product_type", limit: "1" }, token);
  const first = (media.data as { id?: string; media_product_type?: string }[] | undefined)?.[0];
  if (first?.id) {
    summary.first_post = {
      type: first.media_product_type,
      plain: await raw(`${first.id}/insights`, { metric: "reach,saved,shares" }, token),
      total_value: await raw(`${first.id}/insights`, { metric: "reach,saved,shares", metric_type: "total_value" }, token),
      reels_views: await raw(`${first.id}/insights`, { metric: "views,reach,saved", metric_type: "total_value" }, token),
    };
  }

  return NextResponse.json(summary, { status: 200 });
}
