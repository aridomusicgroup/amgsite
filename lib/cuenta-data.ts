import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUS_LABEL } from "@/lib/admin-data";
import { emailsDeCliente } from "@/lib/cuenta-cliente";
import { carpetaDe, descargasDeBeat, itemsOrdenados, licenciaDeRenglon, mapaDeCarpetas, type Descarga } from "@/lib/beat-descarga";

export interface CustomerItem {
  description: string;
  amount: number;
  downloads: Descarga[];
}
export interface CustomerOrder {
  id: string;
  type: "beat" | "servicio";
  status: string;
  statusLabel: string;
  total: number;
  currency: string;
  date: string;
  items: CustomerItem[];
}

export async function getCustomerOrders(email: string): Promise<{
  name: string | null;
  orders: CustomerOrder[];
}> {
  const sb = supabaseAdmin();
  // Todos los correos ligados a esta cuenta (principal + adicionales) → sus pedidos.
  const emails = await emailsDeCliente(email);
  // `license_id` es columna nueva (supabase-beat-ficha.sql): si todavía no
  // existe, la consulta entera fallaría y el cliente no vería NINGUNA compra.
  const consulta = (select: string) => sb.from("customers").select(select).in("email", emails);
  const conLicencia = await consulta("name, orders(id, type, status, total, currency, created_at, order_items(description, amount, license_id))");
  const data = conLicencia.error
    ? (await consulta("name, orders(id, type, status, total, currency, created_at, order_items(description, amount))")).data
    : conLicencia.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customers = data as any[] | null;

  if (!customers || !customers.length) return { name: null, orders: [] };
  const nombre = (customers.find((c) => c.name)?.name as string | null) ?? null;

  const carpetas = await mapaDeCarpetas(sb);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = customers.flatMap((c) => (c.orders as any[]) ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const orders: CustomerOrder[] = raw.map((o) => {
    // Mismo orden que el token de descarga (ver itemsOrdenados).
    const items = itemsOrdenados(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((o.order_items as any[]) ?? []).map((it) => ({
        description: String(it.description),
        amount: Number(it.amount),
        license_id: (it.license_id as string | null | undefined) ?? null,
      })),
    );
    return {
      id: o.id,
      type: o.type === "servicio" ? "servicio" : "beat",
      status: o.status,
      statusLabel: STATUS_LABEL[o.status] ?? o.status,
      total: Number(o.total),
      currency: o.currency,
      date: o.created_at,
      items: items.map((it, idx) => {
        const carpeta = o.type === "beat" ? carpetaDe(carpetas, it.description) : undefined;
        return {
          description: it.description,
          amount: it.amount,
          downloads: carpeta
            ? descargasDeBeat({ orderId: o.id, idx, carpeta, monto: it.amount, licencia: licenciaDeRenglon(it) })
            : [],
        };
      }),
    };
  });

  return { name: nombre, orders };
}
