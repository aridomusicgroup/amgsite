import { supabaseAdmin } from "@/lib/supabase/admin";
import { SEEDS, COTIZACION_TERMINOS_SEED } from "@/lib/pdf/plantilla-seeds";
import type { ContractTipo } from "@/lib/pdf/contracts/types";
import { SEEDS as ACUERDO_SEEDS, type AcuerdoSeed } from "@/lib/acuerdos/seeds";
import { FAMILIA_LABEL, FAMILIAS, type Familia } from "@/lib/acuerdos/familias";

/**
 * Capa de datos de las plantillas EDITABLES (contratos + cotización).
 * Lee de la tabla `plantillas` (Supabase); si no hay fila editada, usa la
 * semilla del código como respaldo — así el PDF nunca se rompe.
 */

/** Texto del contrato (título + cuerpo) para un tipo, editado o semilla. */
export async function getPlantillaContrato(tipo: ContractTipo): Promise<{ titulo: string; cuerpo: string }> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("plantillas").select("titulo, cuerpo").eq("tipo", tipo).single();
    if (data && data.cuerpo) {
      return { titulo: (data.titulo as string) || SEEDS[tipo].titulo, cuerpo: data.cuerpo as string };
    }
  } catch { /* respaldo */ }
  return SEEDS[tipo];
}

/** Términos del pie de la cotización, editados o semilla. */
export async function getCotizacionTerminos(): Promise<string> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("plantillas").select("terminos").eq("tipo", "cotizacion").single();
    if (data && data.terminos) return data.terminos as string;
  } catch { /* respaldo */ }
  return COTIZACION_TERMINOS_SEED;
}

export interface PlantillaEditor {
  tipo: string;
  label: string;
  titulo: string;      // vacío para cotización
  cuerpo: string;      // términos para cotización
  seedTitulo: string;
  seedCuerpo: string;
  editada: boolean;
  updated_at: string | null;
  updated_por: string | null;
  esCotizacion: boolean;
}

const LABELS: Record<ContractTipo, string> = {
  beat_personalizado: "Contrato · Beat personalizado (2026, MXN)",
  exclusiva: "Contrato · Exclusiva (tienda, USD)",
  produccion: "Contrato · Producción a la medida",
  servicio: "Contrato · Servicio suelto",
  ep_album: "Contrato · EP / Álbum",
  generico: "Contrato · Genérico",
};

/** Todas las plantillas para el editor (contratos + cotización), con semilla. */
export async function getPlantillasEditor(): Promise<PlantillaEditor[]> {
  let rows: Record<string, { titulo?: string; cuerpo?: string; terminos?: string; updated_at?: string; updated_por?: string }> = {};
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("plantillas").select("tipo, titulo, cuerpo, terminos, updated_at, updated_por");
    for (const r of data ?? []) rows[r.tipo as string] = r;
  } catch { rows = {}; }

  const contratos: PlantillaEditor[] = (Object.keys(SEEDS) as ContractTipo[]).map((tipo) => {
    const r = rows[tipo];
    return {
      tipo,
      label: LABELS[tipo],
      titulo: (r?.titulo as string) || SEEDS[tipo].titulo,
      cuerpo: (r?.cuerpo as string) || SEEDS[tipo].cuerpo,
      seedTitulo: SEEDS[tipo].titulo,
      seedCuerpo: SEEDS[tipo].cuerpo,
      editada: !!r?.cuerpo,
      updated_at: (r?.updated_at as string) ?? null,
      updated_por: (r?.updated_por as string) ?? null,
      esCotizacion: false,
    };
  });

  const cr = rows["cotizacion"];
  const cotizacion: PlantillaEditor = {
    tipo: "cotizacion",
    label: "Cotización · términos del pie",
    titulo: "",
    cuerpo: (cr?.terminos as string) || COTIZACION_TERMINOS_SEED,
    seedTitulo: "",
    seedCuerpo: COTIZACION_TERMINOS_SEED,
    editada: !!cr?.terminos,
    updated_at: (cr?.updated_at as string) ?? null,
    updated_por: (cr?.updated_por as string) ?? null,
    esCotizacion: true,
  };

  // Acuerdos del panel del cliente, uno por FAMILIA de servicio (licencia,
  // exclusiva, beat personalizado, grabación/mezcla, EP/álbum) — no un solo
  // texto para todo. No son contratos en PDF, por eso no salen de SEEDS ni
  // cuentan como ContractTipo. Solo `personalizado`, `servicio` y `ep_album`
  // se muestran hoy en el panel; `licencia` y `exclusiva` esperan su checkout.
  const acuerdos: PlantillaEditor[] = FAMILIAS.map((familia: Familia) => {
    const seed: AcuerdoSeed = ACUERDO_SEEDS[familia];
    const r = rows[`acuerdo_${familia}`];
    return {
      tipo: `acuerdo_${familia}`,
      label: `Acuerdo · ${FAMILIA_LABEL[familia]}`,
      titulo: (r?.titulo as string) || seed.titulo,
      cuerpo: (r?.cuerpo as string) || seed.cuerpo,
      seedTitulo: seed.titulo,
      seedCuerpo: seed.cuerpo,
      editada: !!r?.cuerpo,
      updated_at: (r?.updated_at as string) ?? null,
      updated_por: (r?.updated_por as string) ?? null,
      esCotizacion: false,
    };
  });

  return [...contratos, cotizacion, ...acuerdos];
}
