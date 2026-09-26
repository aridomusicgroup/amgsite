import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esOriginal, beatParaPanel } from "@/lib/catalog";
import { listarBeatsAdmin } from "@/lib/beat-admin";
import { registrarActividad } from "@/lib/actividad";

export const dynamic = "force-dynamic";

// ── GET: TODO el catálogo (originales + agregados + ocultos), con su semáforo ──
// Sin caché: quien acaba de editar tiene que ver su cambio. Incluye los ocultos
// para poder volver a mostrarlos (antes desaparecían del panel para siempre).
export async function GET() {
  if (!(await moduloPermitido("/admin/beats"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const list = await listarBeatsAdmin();
  return NextResponse.json({ beats: list, total: list.length });
}

// ── DELETE: quita un beat del catálogo ────────────────────────────────────────
// - agregado (DB): borra la fila.
// - original (JSON): lo OCULTA en su ficha (reversible desde el panel). Si la
//   tabla de fichas aún no existe, cae a lo de antes: una fila inactiva en `beats`.
export async function DELETE(req: NextRequest) {
  const email = await moduloPermitido("/admin/beats");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const sb = supabaseAdmin();

  if (esOriginal(id)) {
    // El título real importa: la entrega (lib/beat-descarga.ts) arma su mapa
    // por título y leería el de la fila inactiva.
    const title = (await beatParaPanel(id))?.beat.title ?? id;
    const { error } = await sb.from("beat_ficha").upsert(
      { beat_id: id, oculto: true, actualizado_por: email, updated_at: new Date().toISOString() },
      { onConflict: "beat_id" },
    );
    if (error) {
      const { error: e2 } = await sb.from("beats").upsert({ id, title, active: false }, { onConflict: "id" });
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }
    await registrarActividad(sb, {
      tipo: "beat_visibilidad", titulo: `${title} se ocultó de la tienda`, actor: email,
      entidad: "beat", entidad_id: id, entidad_nombre: title,
    });
  } else {
    const { error } = await sb.from("beats").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("catalog", { expire: 0 }); // la tienda refleja el cambio al instante
  return NextResponse.json({ ok: true });
}
