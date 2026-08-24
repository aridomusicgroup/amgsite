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
import { getGastosRecurrentesParaPanel } from "@/lib/gastos-recurrentes-data";

export const dynamic = "force-dynamic";

export default async function FinanzasPage() {
  if (!(await getFullAdminEmail())) redirect("/admin"); // solo admins totales
  const [f, gastosRecurrentes] = await Promise.all([getFinanzasERP(), getGastosRecurrentesParaPanel()]);
  const utilidad = f.totals.ingresos - f.totals.costosDirectos - f.totals.gastosOperativos - f.totals.nomina;
  const otrosIngresos = f.ingresos.reduce((a, i) => a + i.monto_mxn, 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-coolvetica text-3xl">Finanzas</h1>
          <p className="text-white/40 text-sm mt-1">
            Ingresos, costos, nómina y reparto · todo en MXN
          </p>
        </div>
        {/* Campanita propia: incluye los avisos de gastos recurrentes por vencer. */}
        <ActividadFeed modulo="finanzas" titulo="Actividad de Finanzas" />
      </div>

      {/* KPIs históricos */}
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
      <p className="text-white/30 text-xs mb-8">
        Inversión en equipo (capex, no cuenta como gasto del mes): {money(f.totals.capex)}
        {f.totals.comisionStripe > 0 && <> · Comisión Stripe descontada (ya restada de costos): {money(f.totals.comisionStripe)}</>}
      </p>

      {/* Reparto + Nómina */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <RepartoTrimestral quarters={f.quarters} socios={f.socios} />
        <NominaPanel equipo={f.equipo} nomina={f.nomina} />
      </div>

      {/* Otros ingresos (sin cliente: YouTube, streaming, payouts…) */}
      <div className="mb-8">
        <h2 className="font-coolvetica text-xl mb-1">Otros ingresos ({f.ingresos.length})</h2>
        <p className="text-white/40 text-sm mb-3">Dinero sin cliente (YouTube, streaming, payouts). Cuenta en ingresos y en el reparto.</p>
        <NuevoIngresoForm />
        <IngresosList ingresos={f.ingresos} />
      </div>

      {/* Pagos a músicos (COGS itemizado, ligado a ventas) */}
      <div className="mb-8">
        <PagosMusicoResumen pagos={f.pagosMusico} total={f.totals.musico} pendiente={f.totals.musicoPendiente} />
      </div>

      {/* Pagos recurrentes (renta, suscripciones…) */}
      <div className="mb-8">
        <h2 className="font-coolvetica text-xl mb-1">Pagos recurrentes ({gastosRecurrentes.length})</h2>
        <p className="text-white/40 text-sm mb-3">
          Registra a mano lo que se paga cada mes (renta, suscripciones) para que avise desde el primer ciclo, sin esperar a que se repita solo dos veces.
        </p>
        <NuevoGastoRecurrenteForm />
        <GastosRecurrentesList gastos={gastosRecurrentes} />
      </div>

      {/* Egresos */}
      <div>
        <h2 className="font-coolvetica text-xl mb-3">Egresos ({f.egresos.length})</h2>
        <NuevoEgresoForm />
        <EgresosList egresos={f.egresos} />
      </div>
    </div>
  );
}
