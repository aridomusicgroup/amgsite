import { requireModule } from "@/lib/supabase/auth-server";
import { getOrders } from "@/lib/admin-data";
import { getAlmacenamientoTipos, getProyectosActivosAlmacenamiento } from "@/lib/almacenamiento-data";
import { PedidosPanel } from "@/components/admin/PedidosPanel";
import { SyncPedidosButton } from "@/components/admin/SyncPedidosButton";

export const dynamic = "force-dynamic";

export default async function PedidosPage() {
  const session = await requireModule("/admin/pedidos");
  const isAdmin = session.role === "admin";
  const [orders, almacenamientoTipos, almacenamientoProyectos] = await Promise.all([
    getOrders(),
    isAdmin ? getAlmacenamientoTipos() : Promise.resolve([]),
    isAdmin ? getProyectosActivosAlmacenamiento() : Promise.resolve([]),
  ]);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-coolvetica text-3xl">Pedidos</h1>
          <p className="text-white/40 text-sm mt-1">
            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} · mueve cada uno por su etapa
          </p>
        </div>
        {isAdmin && <SyncPedidosButton />}
      </div>
      <PedidosPanel
        orders={orders}
        isAdmin={isAdmin}
        almacenamientoTipos={almacenamientoTipos}
        almacenamientoProyectos={almacenamientoProyectos}
      />
    </div>
  );
}
