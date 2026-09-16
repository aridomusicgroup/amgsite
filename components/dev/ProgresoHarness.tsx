"use client";
import { PedidoProgreso } from "@/components/cuenta/PedidoProgreso";
import type { PedidoTarea } from "@/lib/cuenta-cliente";

/** Sólo para desarrollo (ver app/dev/cliente). */
const PASOS = [
  "Maqueta recibida", "Grabar Tololoche", "Grabar Bajo", "Grabar Armonía de 6",
  "Grabar Requinto", "Grabar Trombón", "Grabar Voces", "Editar y cuantizar",
  "Mezclar", "Masterizar", "Aprobada", "Subir a Drive",
];

const cancion = (id: string, titulo: string, hechas: number): PedidoTarea => ({
  id,
  titulo,
  hecho: hechas >= PASOS.length,
  completadoAt: null,
  revision: 0,
  subHechas: hechas,
  subTotal: PASOS.length,
  pasos: PASOS.map((p, i) => ({ id: `${id}-${i}`, titulo: p, hecho: i < hechas })),
});

const tareas = [cancion("kh", "LA KHABALAH", 6), cancion("ef", "EFÍMERO", 1), cancion("pr", "PROFECÍA", 12)];

export function ProgresoHarness() {
  return (
    <main className="min-h-screen bg-lgb-black text-white p-5 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <PedidoProgreso
          concepto="TRiP MX 🇲🇽"
          tareas={tareas}
          hechas={1}
          total={3}
          pct={53}
          entregado={false}
          revisionActual={0}
          esAlbum
          fechaEntrega="2026-09-30"
          fechaEntregaReal={null}
        />
      </div>
    </main>
  );
}
