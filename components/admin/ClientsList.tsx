"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { money } from "@/components/admin/ui";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  first_seen: string;
  tags: string[];
  orderCount: number;
  spent: number;
}

export function ClientsList({ customers }: { customers: Customer[] }) {
  const [q, setQ] = useState("");

  const filtered = customers.filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.email.toLowerCase().includes(s) ||
      (c.name?.toLowerCase().includes(s) ?? false) ||
      (c.phone?.includes(s) ?? false)
    );
  });

  return (
    <div>
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          className="input pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-white/30 text-sm py-16 text-center">
          {customers.length === 0
            ? "Aún no hay clientes. Aparecerán solos con cada venta."
            : "Sin resultados."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => {
            const phone = c.phone?.replace(/\D/g, "");
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="w-9 h-9 rounded-full bg-lgb-red/15 text-lgb-red flex items-center justify-center font-coolvetica text-sm shrink-0">
                  {(c.name || c.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">
                    {c.name || c.email}
                  </p>
                  <p className="text-white/40 text-xs truncate">{c.email}</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-white/40 text-[11px]">
                    {c.orderCount} {c.orderCount === 1 ? "compra" : "compras"}
                  </p>
                  <p className="text-white font-coolvetica text-sm">{money(c.spent)}</p>
                </div>
                {phone && (
                  <a
                    href={`https://wa.me/${phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#25D366] hover:scale-110 transition-transform shrink-0 p-1"
                    title="WhatsApp"
                  >
                    <WhatsappIcon size={17} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
