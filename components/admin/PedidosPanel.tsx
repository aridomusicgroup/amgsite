"use client";
import { useState } from "react";
import type { OrderRow } from "@/lib/admin-data";
import type { AlmacenamientoTipoRow, ProyectoAlmacenamientoRow } from "@/lib/almacenamiento-data";
import { OrdersList } from "@/components/admin/OrdersList";
import { AlmacenamientoPanel } from "@/components/admin/AlmacenamientoPanel";

interface Props {
  orders: OrderRow[];
  isAdmin: boolean;
  almacenamientoTipos: AlmacenamientoTipoRow[];
  almacenamientoProyectos: ProyectoAlmacenamientoRow[];
}

export function PedidosPanel({ orders, isAdmin, almacenamientoTipos, almacenamientoProyectos }: Props) {
  const [tab, setTab] = useState<"pedidos" | "almacenamiento">("pedidos");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => setTab("pedidos")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === "pedidos" ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
        >
          Pedidos <span className="opacity-60">({orders.length})</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("almacenamiento")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === "almacenamiento" ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
          >
            Almacenamiento
          </button>
        )}
      </div>

      {tab === "pedidos" && <OrdersList initialOrders={orders} isAdmin={isAdmin} />}
      {tab === "almacenamiento" && isAdmin && (
        <AlmacenamientoPanel tipos={almacenamientoTipos} proyectos={almacenamientoProyectos} />
      )}
    </div>
  );
}
