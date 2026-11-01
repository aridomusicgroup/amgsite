"use client";
import { useState } from "react";
import { Terminal } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { IndicadorRender } from "@/components/admin/IndicadorRender";
import { effectiveModules } from "@/lib/modules";
import type { RendersEnCurso } from "@/lib/render-jobs";

/**
 * Sólo para desarrollo (ver app/dev/render-nav). El menú real del panel con
 * la onda de REAPER en cada estado, en oscuro y en claro, con el área de
 * Herramientas abierta o cerrada.
 */

const ESTADOS: { nombre: string; r: RendersEnCurso }[] = [
  { nombre: "Nada", r: { enCola: 0, renderizando: 0, subiendo: 0 } },
  { nombre: "En cola", r: { enCola: 1, renderizando: 0, subiendo: 0 } },
  { nombre: "Renderizando", r: { enCola: 0, renderizando: 1, subiendo: 0 } },
  { nombre: "Renderizando + 2 en cola", r: { enCola: 2, renderizando: 1, subiendo: 0 } },
  { nombre: "Subiendo a Drive", r: { enCola: 0, renderizando: 0, subiendo: 1 } },
];

const MODULOS = effectiveModules("admin", null);

export function RenderNavHarness() {
  const [i, setI] = useState(2);
  const [claro, setClaro] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const r = ESTADOS[i].r;

  const boton = (activo: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${activo ? "border-lgb-red text-white" : "border-white/10 text-white/50"}`;

  return (
    <div className={`min-h-screen ${claro ? "panel-light" : ""} bg-lgb-black text-white`}>
      {/* key: el menú lee "colapsado" sólo al montarse. */}
      <AdminNav
        key={String(cerrada)}
        email="luis@aridomusicgroup.com"
        nombre="Luis Rocha"
        modules={MODULOS}
        colapsado={cerrada ? ["herramientas"] : []}
        renders={r}
      />
      <main className="md:ml-60 p-5 sm:p-8 pb-32 space-y-6">
        <h1 className="text-lg">Onda de REAPER en el menú</h1>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((e, k) => (
            <button key={e.nombre} onClick={() => setI(k)} className={boton(k === i)}>{e.nombre}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setClaro((v) => !v)} className={boton(claro)}>Modo claro</button>
          <button onClick={() => setCerrada((v) => !v)} className={boton(cerrada)}>Herramientas cerrada</button>
        </div>

        {/* Con la sección abierta el link va en rojo; aquí no hay ruta /admin/dev-logs. */}
        <div className="w-56 space-y-1">
          <p className="text-[11px] text-white/40">Link seleccionado (estás en REAPER):</p>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm bg-lgb-red text-white">
            <Terminal size={17} />
            REAPER
            <IndicadorRender r={r} activo className="ml-auto" />
          </div>
        </div>
      </main>
    </div>
  );
}
