"use client";
import { createContext, useContext } from "react";
import { CATALOGO_SEMILLA, type Catalogo } from "@/lib/servicios";

/**
 * El catálogo del cotizador para los componentes del panel.
 *
 * Lo pone el layout del panel (server) una sola vez, en vez de pasarlo prop por
 * prop por cotizaciones, ventas y ajustes. Fuera del panel (páginas de prueba)
 * cae a la semilla del archivo, así que nunca es undefined.
 */
const Ctx = createContext<Catalogo>(CATALOGO_SEMILLA);

export function CatalogoProvider({ catalogo, children }: { catalogo: Catalogo; children: React.ReactNode }) {
  return <Ctx.Provider value={catalogo}>{children}</Ctx.Provider>;
}

export const useCatalogo = (): Catalogo => useContext(Ctx);
