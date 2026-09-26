// Qué licencia compró el cliente en un renglón de su pedido, y qué formatos
// le tocan.
//
// Desde que hay precios por beat, el renglón GUARDA su licencia
// (`order_items.license_id`, la pone el webhook). Los pedidos de antes no la
// tienen: para ésos se sigue deduciendo por el monto, que entonces era fijo
// ($25 Basic, $50 Premium, $100 Premium Plus, $600+ Exclusiva).
//
// Módulo PURO.

export interface LicenciaArchivos {
  id: string;
  price: number | null;
  exclusive: boolean;
  files: string[];
}

export interface LicenciaDeRenglon {
  /** Formatos que le tocan; null = no se sabe (se entrega la carpeta general). */
  files: string[] | null;
  exclusive: boolean;
}

/** Pedidos viejos: la licencia se deduce del monto pagado. */
export function licenciaPorMontoPuro(monto: number, licencias: readonly LicenciaArchivos[], exclusivaMinima: number): LicenciaDeRenglon {
  if (monto >= exclusivaMinima) return { files: null, exclusive: true };
  const lic = licencias.find((l) => !l.exclusive && l.price !== null && Math.abs(l.price - monto) < 0.5);
  return { files: lic?.files ?? null, exclusive: false };
}

export function licenciaDeRenglonPuro(
  it: { amount: number; license_id?: string | null },
  licencias: readonly LicenciaArchivos[],
  exclusivaMinima: number,
): LicenciaDeRenglon {
  const lic = it.license_id ? licencias.find((l) => l.id === it.license_id) : undefined;
  if (lic) return { files: lic.exclusive ? null : [...lic.files], exclusive: lic.exclusive };
  return licenciaPorMontoPuro(it.amount, licencias, exclusivaMinima);
}
