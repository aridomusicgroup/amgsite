"use client";
import { useState } from "react";
import { Dashboard } from "@/components/admin/Dashboard";
import { diasEnMes, type DatosOperacion, type MesConDias } from "@/lib/operacion";
import type { DashContacto, DashEgreso, DashIngreso, DashVenta } from "@/lib/erp-data";

// Datos de ejemplo (no son los de la base): sirven para ver la pestaña Operación sin Supabase.
// Lo cobrado se reparte parejo en los primeros `hastaDia` días del mes.
const mes = (m: string, cobrado: number, operacion: number, sueldosSocios: number, hastaDia = diasEnMes(m)): MesConDias => ({
  mes: m, cobrado, directos: Math.round(cobrado * 0.16), operacion, sueldosSocios,
  cobradoPorDia: Array.from({ length: diasEnMes(m) }, (_, i) => (i < hastaDia ? cobrado / hastaDia : 0)),
});

const NORMAL: DatosOperacion = {
  impuestosPct: 10,
  colchonSaldo: 52000,
  partidas: [
    { concepto: "Sueldo de socios", mensual: 13000, esSocio: true },
    { concepto: "Emmanuel Cervantes (Tozi)", mensual: 7367, esSocio: false },
    { concepto: "Renta Estudio · Paco", mensual: 3500, esSocio: false },
    { concepto: "Diego Galván", mensual: 3467, esSocio: false },
    { concepto: "Luz", mensual: 2056, esSocio: false },
    { concepto: "Servicios · Internet", mensual: 600, esSocio: false },
  ],
  meses: [
    mes("2026-05", 46300, 3500, 0), mes("2026-06", 91800, 9200, 0), mes("2026-07", 58900, 12400, 0),
    mes("2026-08", 93900, 14100, 0), mes("2026-09", 31000, 15800, 7800), mes("2026-10", 28400, 11000, 6500, 26),
  ],
};
const SIN_COSTOS: DatosOperacion = { ...NORMAL, partidas: [] };

const ventas: DashVenta[] = [
  { fecha: "2026-10-04", total_mxn: 7467, costo_extra: 1200, canal: "whatsapp", tipo: "Beat personalizado", beat_nombre: "TRiP MX", cliente: "Juan José" },
  { fecha: "2026-10-09", total_mxn: 1357, costo_extra: 0, canal: "beatstars", tipo: "Beat", beat_nombre: "CHANEL", cliente: "Rocha" },
  { fecha: "2026-10-12", total_mxn: 1357, costo_extra: 0, canal: "beatstars", tipo: "Beat", beat_nombre: "PROFECÍA", cliente: "Lalo" },
  { fecha: "2026-10-18", total_mxn: 12000, costo_extra: 2500, canal: "whatsapp", tipo: "Producción musical", beat_nombre: null, cliente: "Los Nuevos" },
  { fecha: "2026-10-21", total_mxn: 6000, costo_extra: 800, canal: "instagram", tipo: "Mezcla y máster", beat_nombre: null, cliente: "Beto" },
];
const ingresos: DashIngreso[] = ventas.map((v) => ({
  fecha: v.fecha, monto: v.total_mxn, canal: v.canal, tipo: v.tipo, beat_nombre: v.beat_nombre, cliente: v.cliente,
}));
const egresos: DashEgreso[] = [
  { fecha: "2026-10-01", total_mxn: 3500, es_capex: false, categoria: "Renta Estudio" },
  { fecha: "2026-10-05", total_mxn: 1700, es_capex: false, categoria: "Nómina" },
];
const contactos: DashContacto[] = [
  { created_at: "2026-10-03T12:00:00Z", etapa: "cliente", origen: "whatsapp", ltv: 7467, nombre: "Juan José" },
  { created_at: "2026-10-10T12:00:00Z", etapa: "lead", origen: "instagram", ltv: 0, nombre: "Beto" },
];

type Estado = "normal" | "sin-costos" | "error";

/** Banco de pruebas de Dashboard → Operación. En producción no existe. */
export function OperacionHarness() {
  const [estado, setEstado] = useState<Estado>("normal");
  const operacion = estado === "normal" ? NORMAL : estado === "sin-costos" ? SIN_COSTOS : null;
  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4 text-xs">
        {(["normal", "sin-costos", "error"] as const).map((e) => (
          <button key={e} type="button" onClick={() => setEstado(e)} className={`px-3 py-1.5 rounded-full ${estado === e ? "bg-lgb-red text-white" : "bg-white/5 text-white/50"}`}>{e}</button>
        ))}
      </div>
      <Dashboard ventas={ventas} ingresos={ingresos} egresos={egresos} contactos={contactos} proyectos={[]} operacion={operacion} />
    </div>
  );
}
