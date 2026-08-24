// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Parte "TOLOLOCHE, CHARCHETAS" en lista limpia. */
function parseInstrumentos(v: unknown): string[] {
  return String(v || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Al crear una venta con instrumentos, genera un pago a músico EN PENDIENTE por
 * cada músico del catálogo que toque alguno de esos instrumentos (monto = su
 * tarifa). Se marcan como pagados después, cuando de verdad se les pague.
 * Idempotente-ish: solo se llama al crear la venta. Best-effort: nunca lanza.
 * Recalcula `ventas.costo_extra` (= suma) para que el reparto quede al día.
 */
export async function crearPagosMusicoPendientes(sb: SB, ventaId: string, extras: unknown): Promise<void> {
  try {
    const instrumentos = parseInstrumentos(extras);
    if (!instrumentos.length || !ventaId) return;

    const { data: musicos } = await sb.from("musicos").select("nombre, instrumentos, tarifa, activo");
    if (!musicos || !musicos.length) return;

    // Un pago por músico que toque CUALQUIER instrumento de la venta (dedup por músico).
    const porMusico = new Map<string, { nombre: string; tarifa: number; toca: string[] }>();
    for (const inst of instrumentos) {
      const il = inst.toLowerCase();
      for (const m of musicos) {
        if (m.activo === false) continue;
        const toca = (m.instrumentos || []).some((x: unknown) => {
          const xl = String(x).toLowerCase();
          return xl === il || il.includes(xl) || xl.includes(il);
        });
        if (!toca) continue;
        const key = String(m.nombre).toLowerCase();
        const cur = porMusico.get(key);
        if (cur) { if (!cur.toca.includes(inst)) cur.toca.push(inst); }
        else porMusico.set(key, { nombre: m.nombre, tarifa: Number(m.tarifa) || 0, toca: [inst] });
      }
    }
    if (porMusico.size === 0) return;

    const rows = [...porMusico.values()].map((m) => ({
      venta_id: ventaId,
      musico: m.nombre,
      monto: m.tarifa,          // tarifa del catálogo (editable después)
      fecha: null,              // aún no se paga
      pagado: false,            // PENDIENTE
      nota: `Auto: ${m.toca.join(", ")}`,
    }));
    await sb.from("pagos_musico").insert(rows);

    // Recalcula costo_extra = suma de pagos (mismo criterio que la API de pagos-musico).
    const { data: pm } = await sb.from("pagos_musico").select("monto").eq("venta_id", ventaId);
    const sum = (pm ?? []).reduce((a: number, r: { monto: unknown }) => a + (Number(r.monto) || 0), 0);
    await sb.from("ventas").update({ costo_extra: sum }).eq("id", ventaId);
  } catch {
    /* best-effort: no romper la creación de la venta */
  }
}
