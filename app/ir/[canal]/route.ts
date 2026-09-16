import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CANALES_ENLACE, ORIGEN_LABEL } from "@/lib/origenes";
import { SELLER } from "@/lib/pdf/parts";

export const dynamic = "force-dynamic";

/**
 * Enlace rastreable para la bio de cada perfil: aridomusicgroup.com/ir/tiktok.
 *
 * TikTok, YouTube y BeatStars no nos dicen quién llegó desde ahí. Con esto sí se
 * sabe: cada clic se cuenta, y la persona cae en WhatsApp con un mensaje que ya
 * dice "los vi en TikTok", así quien contesta sabe qué origen ponerle al cliente.
 *
 *   ?v=<id del video>   opcional: de qué video vino (se guarda tal cual)
 *   ?a=sitio            en vez de WhatsApp, manda al sitio (con utm_source)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ canal: string }> }) {
  const { canal: crudo } = await ctx.params;
  const canal = String(crudo || "").toLowerCase();
  const url = new URL(req.url);

  // Un canal que no existe no se cuenta: manda al sitio y ya.
  if (!CANALES_ENLACE.includes(canal)) return NextResponse.redirect("https://aridomusicgroup.com/", 302);

  const ref = (url.searchParams.get("v") || "").replace(/[^\w\-.:/]/g, "").slice(0, 120) || null;
  const pais = req.headers.get("x-vercel-ip-country")?.slice(0, 2) || null;

  // Best-effort y sin hacer esperar de más: si falla, la persona igual llega.
  try {
    await supabaseAdmin().from("clics_enlace").insert({ canal, ref, pais });
  } catch { /* la tabla aún no existe o Supabase no responde */ }

  if (url.searchParams.get("a") === "sitio") {
    return NextResponse.redirect(`https://aridomusicgroup.com/?utm_source=${canal}&utm_medium=bio`, 302);
  }

  const numero = SELLER.whatsapp.replace(/\D/g, "");
  const texto = `Hola 👋 los vi en ${ORIGEN_LABEL[canal] ?? canal} y quiero información`;
  return NextResponse.redirect(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, 302);
}
