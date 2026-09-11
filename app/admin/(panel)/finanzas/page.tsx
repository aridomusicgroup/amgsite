import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { getFinanzasERP } from "@/lib/erp-data";
import { StatCard, money } from "@/components/admin/ui";
import { RepartoTrimestral } from "@/components/admin/RepartoTrimestral";
import { NominaPanel } from "@/components/admin/NominaPanel";
import { NuevoEgresoForm } from "@/components/admin/NuevoEgresoForm";
import { EgresosList } from "@/components/admin/EgresosList";
import { NuevoIngresoForm } from "@/components/admin/NuevoIngresoForm";
import { IngresosList } from "@/components/admin/IngresosList";
import { PagosMusicoResumen } from "@/components/admin/PagosMusicoResumen";
import { ActividadFeed } from "@/components/admin/ActividadFeed";
import { NuevoGastoRecurrenteForm } from "@/components/admin/NuevoGastoRecurrenteForm";
import { GastosRecurrentesList } from "@/components/admin/GastosRecurrentesList";
import { FinanzasSecciones } from "@/components/admin/FinanzasSecciones";
import { getGastosRecurrentesParaPanel } from "@/lib/gastos-recurrentes-data";

export const dynamic = "force-dynamic";

/** Un bloque con título: el mismo encabezado en las tres pestañas. */
function Bloque({ titulo, desc, children }: { titulo: string; desc?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-coolvetica text-xl mb-1">{titulo}</h2>
      {desc && <p className="text-white/40 text-sm mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

export default async function FinanzasPage() {
  if (!(await getFullAdminEmail())) redirect("/admin"); // solo admins totales
  const [f, gastosRecurrentes] = await Promise.all([getFinanzasERP(), getGastosRecurrentesParaPanel()]);
  const utilidad = f.totals.ingresos - f.totals.costosDirectos - f.totals.gastosOperativos - f.totals.nomina;
  const otrosIngresos = f.ingresos.reduce((a, i) => a + i.monto_mxn, 0);

  // Lo que tiene fecha y no se ha pagado: es lo único urgente de la página.
  const recurrentesPorPagar = gastosRecurrentes.filter((g) => g.activo && g.pendiente);
  const musicosPorPagar = f.pagosMusico.filter((p) => !p.pagado).length;
  const avisos = [
    recurrentesPorPagar.length > 0 &&
      `${recurrentesPorPagar.length} pago${recurrentesPorPagar.length === 1 ? "" : "s"} recurrente${recurrentesPorPagar.length === 1 ? "" : "s"} por vencer o vencido${recurrentesPorPagar.length === 1 ? "" : "s"}`,
    f.totals.musicoPendiente > 0 && `${money(f.totals.musicoPendiente)} pendientes a músicos`,
  ].filter(Boolean) as string[];

  const resumen = (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          <StatCard label="Ingresos" value={money(f.totals.ingresos)} accent sub={otrosIngresos > 0 ? `incluye ${money(otrosIngresos)} de otros ingresos` : undefined} />
          <StatCard label="Costos + gastos" value={money(f.totals.costosDirectos + f.totals.gastosOperativos)} />
          <StatCard label="Nómina pagada" value={money(f.totals.nomina)} />
          <StatCard
            label="Utilidad histórica"
            value={money(utilidad)}
            sub={utilidad >= 0 ? "👍 en verde" : "⚠️ en rojo"}
          />
        </div>
        <p className="text-white/30 text-xs">
          Inversión en equipo (capex, no cuenta como gasto del mes): {money(f.totals.capex)}
          {f.totals.comisionStripe > 0 && <> · Comisión Stripe descontada (ya restada de costos): {money(f.totals.comisionStripe)}</>}
        </p>
      </div>

      {avisos.length > 0 && (
        <p className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-2.5 text-sm text-amber-200/90">
          ⏰ {avisos.join(" · ")} — están en la pestaña <b>Pagos</b>.
        </p>
      )}

      <RepartoTrimestral quarters={f.quarters} socios={f.socios} />
    </div>
  );

  // En el orden en que urgen: lo que tiene día fijo, lo que se le debe a gente
  // de fuera, y los sueldos de la semana.
  const pagos = (
    <div className="space-y-8">
      <Bloque
        titulo={`Pagos recurrentes (${gastosRecurrentes.length})`}
        desc="Renta, suscripciones… Regístralos a mano para que avise desde el primer ciclo, sin esperar a que se repitan solos dos veces."
      >
        <NuevoGastoRecurrenteForm />
        <GastosRecurrentesList gastos={gastosRecurrentes} />
      </Bloque>

      <PagosMusicoResumen pagos={f.pagosMusico} total={f.totals.musico} pendiente={f.totals.musicoPendiente} pendientes={musicosPorPagar} />

      <NominaPanel equipo={f.equipo} nomina={f.nomina} />
    </div>
  );

  const movimientos = (
    <div className="space-y-8">
      <Bloque titulo={`Egresos (${f.egresos.length})`}>
        <NuevoEgresoForm />
        <EgresosList egresos={f.egresos} />
      </Bloque>

      <Bloque
        titulo={`Otros ingresos (${f.ingresos.length})`}
        desc="Dinero sin cliente (YouTube, streaming, payouts). Cuenta en ingresos y en el reparto."
      >
        <NuevoIngresoForm />
        <IngresosList ingresos={f.ingresos} />
      </Bloque>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-coolvetica text-3xl">Finanzas</h1>
          <p className="text-white/40 text-sm mt-1">
            Ingresos, costos, nómina y reparto · todo en MXN
          </p>
        </div>
        {/* Campanita propia: incluye los avisos de gastos recurrentes por vencer. */}
        <ActividadFeed modulo="finanzas" titulo="Actividad de Finanzas" />
      </div>

      <FinanzasSecciones
        resumen={resumen}
        pagos={pagos}
        movimientos={movimientos}
        porPagar={recurrentesPorPagar.length + musicosPorPagar}
      />
    </div>
  );
}
