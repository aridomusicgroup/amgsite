"use client";
import { useMemo } from "react";
import { money } from "@/components/admin/ui";
import { KpiCard, HBars } from "@/components/admin/charts";
import { DIAS_POR_MES, diasQuePaga, type FilaMes, type ResumenOperacion } from "@/lib/operacion";
import type { DashVenta } from "@/lib/erp-data";

const VERDE = "#34d399";
const AMBAR = "#fbbf24";
const ROSA = "#fb7185";
const GRIS = "#94a3b8";
/** La barra llega hasta 150% de la cuenta, para que un mes que sobra se vea más largo que uno justo. */
const TOPE_BARRA = 1.5;

const nombreMes = (k: string) => new Date(`${k}-15T12:00:00`).toLocaleDateString("es-MX", { month: "long" });
const dias = (n: number) => {
  const v = Math.abs(n).toFixed(1).replace(/\.0$/, "");
  return `${v} ${v === "1" ? "día" : "días"}`;
};

function Panel({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="font-coolvetica text-lg">{title}</h2>
        {hint && <span className="text-white/30 text-[11px]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

type Tono = "ok" | "ojo" | "mal" | "neutro";
/** El texto usa clases (el modo claro las remapea para que se lean); la barra, el color directo. */
const TONOS: Record<Tono, { texto: string; barra: string }> = {
  ok: { texto: "text-green-400", barra: VERDE },
  ojo: { texto: "text-amber-300", barra: AMBAR },
  mal: { texto: "text-red-300", barra: ROSA },
  neutro: { texto: "text-white/50", barra: GRIS },
};

/** Lo que dice el mes en una frase: si cubrió la cuenta y en qué día (el real; en el mes en curso, a veces una proyección). */
function veredicto(f: FilaMes): { texto: string; tono: Tono } {
  if (f.enCurso) {
    if (f.cubre) return { texto: `Ya cubriste la cuenta (día ${f.diaEquilibrio})`, tono: "ok" };
    if (f.ritmo === "pronto") return { texto: `Apenas van ${f.transcurridos} días: aún es pronto para saberlo`, tono: "neutro" };
    if (f.ritmo === "llega") return { texto: `Al ritmo de hoy la cubres el día ${f.diaProyectado}`, tono: "ojo" };
    return { texto: "Al ritmo de hoy no alcanza", tono: "mal" };
  }
  if (f.cubre) return { texto: `Cubrió la cuenta el día ${f.diaEquilibrio} · sobraron ${dias(f.diasDeHolgura)}`, tono: "ok" };
  return { texto: `No alcanzó · faltaron ${dias(f.diasDeHolgura)}`, tono: "mal" };
}

function MesRow({ f }: { f: FilaMes }) {
  const { texto, tono } = veredicto(f);
  const razon = f.costo > 0 ? f.neto / f.costo : 0;
  const ancho = Math.min(razon, TOPE_BARRA) / TOPE_BARRA;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm text-white/80"><span className="capitalize">{nombreMes(f.mes)}</span>{f.enCurso && <span className="text-white/30"> · en curso</span>}</span>
        <span className={`text-xs text-right ${TONOS[tono].texto}`}>{texto}</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/5 overflow-hidden" role="img" aria-label={`Lo neto cubre ${Math.round(razon * 100)}% de lo que cuesta operar`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(ancho * 100, 1)}%`, background: TONOS[tono].barra }} />
        <div className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${(1 / TOPE_BARRA) * 100}%` }} />
      </div>
      <p className="text-white/40 text-xs mt-1.5">
        Entró {money(f.cobrado)} · quedan {money(f.neto)} después de músicos e impuestos · operar cuesta {money(f.costo)}
      </p>
    </li>
  );
}

export function OperacionPanel({ resumen, incluirSocios, onIncluirSocios, ventas, periodLabel }: {
  resumen: ResumenOperacion | null;
  incluirSocios: boolean;
  onIncluirSocios: (v: boolean) => void;
  /** Ventas del periodo elegido arriba: de ahí sale el ticket de cada tipo. */
  ventas: DashVenta[];
  periodLabel: string;
}) {
  const porTipo = useMemo(() => {
    if (!resumen || resumen.costoDia <= 0) return [];
    const grupos = new Map<string, { suma: number; n: number }>();
    for (const v of ventas) {
      const k = v.tipo ?? "Sin tipo";
      const g = grupos.get(k) ?? { suma: 0, n: 0 };
      grupos.set(k, { suma: g.suma + v.total_mxn, n: g.n + 1 });
    }
    return [...grupos.entries()]
      .map(([label, g]) => ({
        label,
        value: diasQuePaga(g.suma / g.n, resumen.margen, resumen.costoDia),
        sub: `${g.n} ${g.n === 1 ? "venta" : "ventas"} · ticket ${money(g.suma / g.n)}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [ventas, resumen]);

  if (!resumen) {
    return <p className="text-white/50 text-sm">No se pudo calcular la operación. El resto del Dashboard sigue funcionando; revisa los registros del servidor.</p>;
  }
  if (resumen.sinCostos) {
    return (
      <p className="text-white/50 text-sm">
        Todavía no hay costos configurados. Da de alta al equipo y los pagos recurrentes en Finanzas y aquí aparece cuánto vale un día.
      </p>
    );
  }

  const { actual, filas, partidas } = resumen;
  const cuentaDelDia = partidas
    .filter((p) => incluirSocios || !p.esSocio)
    .map((p) => ({ label: p.concepto, value: p.mensual / DIAS_POR_MES, sub: `${money(p.mensual)}/mes` }));
  const ultimoCompleto = [...filas].reverse().find((f) => !f.enCurso && f.captura !== null);
  const seg = (activo: boolean) => `px-3 py-1.5 ${activo ? "bg-lgb-red text-white" : "text-white/50 hover:text-white"}`;

  const textoCubres = actual.cubre ? `Día ${actual.diaEquilibrio}`
    : actual.ritmo === "llega" ? `Día ${actual.diaProyectado}`
    : actual.ritmo === "pronto" ? "Aún es pronto" : "No alcanza";

  const cabecera = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-white/40 text-xs">Con el costo de hoy aplicado a cada mes. No cambia con los filtros de canal, tipo ni base.</p>
      <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs" role="group" aria-label="Qué cuenta como costo de operar">
        <button type="button" aria-pressed={incluirSocios} onClick={() => onIncluirSocios(true)} className={seg(incluirSocios)}>Operar + socios</button>
        <button type="button" aria-pressed={!incluirSocios} onClick={() => onIncluirSocios(false)} className={seg(!incluirSocios)}>Solo operar</button>
      </div>
    </div>
  );

  // "Solo operar" sin más costos que los sueldos de socios: no hay cuenta que comparar, pero se puede volver.
  if (resumen.costoMensual <= 0) {
    return (
      <div className="space-y-4">
        {cabecera}
        <p className="text-white/50 text-sm">Fuera de los sueldos de socios no hay costos de operación configurados. Activa «Operar + socios» para ver la cuenta completa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cabecera}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Un día de operación" value={money(resumen.costoDia)} accent sub={`${money(resumen.costoMensual)} al mes`} />
        <KpiCard
          label="Para pagarlo hay que vender"
          value={resumen.ventaPorDia === null ? "—" : money(resumen.ventaPorDia)}
          sub={`de cada $100 quedan $${Math.round(resumen.margen * 100)} tras músicos e impuestos`}
        />
        <KpiCard
          label="Este mes cubres la cuenta"
          value={textoCubres}
          sub={resumen.adelanto === null ? undefined : `${resumen.adelanto >= 0 ? "Vas" : "Te faltan"} ${money(Math.abs(resumen.adelanto))} ${resumen.adelanto >= 0 ? "por delante" : "para ir al corriente"}`}
        />
        <KpiCard
          label="Días de aire"
          value={resumen.diasDeAire === null ? "—" : String(Math.round(resumen.diasDeAire))}
          sub={resumen.diasDeAire === null ? "sin colchón registrado en Finanzas" : "que aguanta el colchón sin que entre nada"}
        />
      </div>

      <Panel title="Mes por mes: ¿alcanzó lo que entró?" hint="la raya marca lo que cuesta operar">
        <ul className="divide-y divide-white/5">{[...filas].reverse().map((f) => <MesRow key={f.mes} f={f} />)}</ul>
      </Panel>

      {ultimoCompleto && ultimoCompleto.captura !== null && (
        ultimoCompleto.captura < 0.8 ? (
          <p className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-2.5 text-sm text-amber-300">
            En {nombreMes(ultimoCompleto.mes)} se registraron {money(ultimoCompleto.registrado)} de gasto de operación, y operar cuesta alrededor de {money(ultimoCompleto.costo)} al mes
            ({Math.round(ultimoCompleto.captura * 100)}%). Probablemente faltan ≈ {money(ultimoCompleto.costo - ultimoCompleto.registrado)} por capturar: renta, servicios o nómina.
          </p>
        ) : (
          <p className="text-white/40 text-xs">
            Lo registrado en {nombreMes(ultimoCompleto.mes)} ({money(ultimoCompleto.registrado)}) cuadra con lo que cuesta operar ({Math.round(ultimoCompleto.captura * 100)}%).
          </p>
        )
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="¿A dónde se va el día?" hint="pesos por día">
          <HBars rows={cuentaDelDia} fmt={money} color={ROSA} />
        </Panel>
        <Panel title="Cuántos días de operación paga una venta" hint={periodLabel}>
          <HBars rows={porTipo} fmt={(n) => dias(n)} color={VERDE} />
        </Panel>
      </div>

      <p className="text-white/30 text-xs">
        El costo sale de lo configurado (pago del equipo, pagos recurrentes y sueldo de socios), no de los egresos capturados, porque ahí aún faltan meses por registrar.
        Lo que queda de cada peso descuenta músicos (según los últimos meses) e impuestos.
      </p>
    </div>
  );
}
