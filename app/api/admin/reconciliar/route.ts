import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCatalog } from "@/lib/catalog";
import rawBeats from "@/data/beats-beatstars.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

// El título de BeatStars trae el nombre del beat entre comillas:
//   «"Champagne" Oscar Maydon x Junior H | corrido tumbado» → "champagne"
const nombreBeat = (titulo: string): string => {
  const m = (titulo || "").match(/["“”']([^"“”']+)["“”']/);
  if (m) return norm(m[1]);
  return norm((titulo || "").split(/\b(type|prod)\b/i)[0]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Reconcilia/matchea los datos de beats que ya existen:
//   1. inventario_beats.nombre  → catálogo (TK id)  ⇒ rellena catalogo_beat_id
//   2. ventas.beat_nombre        → inventario        ⇒ rellena inventario_beat_id
// No borra nada; solo enlaza lo que hace match por nombre. Re-ejecutable.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST() {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { beats: catalogo } = await getCatalog();

    // Índice nombre→id: primero el nombre entre comillas del título crudo (JSON),
    // luego el título limpio (cubre beats agregados desde el admin / DB).
    const catByName = new Map<string, string>();
    for (const b of rawBeats as Array<{ id: string; title: string }>) {
      const n = nombreBeat(b.title);
      if (n) catByName.set(n, b.id);
    }
    for (const b of catalogo) {
      const n = norm(b.title);
      if (n && !catByName.has(n)) catByName.set(n, b.id);
    }

    const [invRes, ventasRes] = await Promise.all([
      sb.from("inventario_beats").select("id, nombre, catalogo_beat_id"),
      sb.from("ventas").select("id, beat_nombre, inventario_beat_id"),
    ]);

    const inventario = invRes.data ?? [];
    const ventas = ventasRes.data ?? [];

    const invByName = new Map<string, string>(); // norm(nombre) → inventario.id
    for (const i of inventario) if (i.nombre) invByName.set(norm(i.nombre), i.id);

    const summary = {
      inventarioEnlazadoACatalogo: 0,
      ventasEnlazadasAInventario: 0,
      ventasBeatPersonalizado: 0, // sin match en inventario (esperado: beats a la medida)
      inventarioSinCatalogo: 0,
    };

    // 1. Inventario → catálogo
    for (const i of inventario) {
      if (i.catalogo_beat_id) continue;
      const catId = catByName.get(norm(i.nombre));
      if (catId) {
        await sb.from("inventario_beats").update({ catalogo_beat_id: catId }).eq("id", i.id);
        summary.inventarioEnlazadoACatalogo++;
      } else {
        summary.inventarioSinCatalogo++;
      }
    }

    // 2. Ventas → inventario
    for (const v of ventas) {
      if (v.inventario_beat_id || !v.beat_nombre) continue;
      const invId = invByName.get(norm(v.beat_nombre));
      if (invId) {
        await sb.from("ventas").update({ inventario_beat_id: invId }).eq("id", v.id);
        summary.ventasEnlazadasAInventario++;
      } else {
        summary.ventasBeatPersonalizado++;
      }
    }

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
