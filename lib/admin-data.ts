import { supabaseAdmin } from "@/lib/supabase/admin";

export interface OrderRow {
  id: string;
  type: "beat" | "servicio";
  status: string;
  total: number;
  currency: string;
  summary: string | null;
  note: string | null;
  utm_source: string | null;
  created_at: string;
  customers: { name: string | null; email: string; phone: string | null } | null;
}

const MXN_PER_USD = 18; // aproximado para unificar métricas; ajustable

/** Normaliza todo a MXN para sumar métricas mixtas */
export function toMXN(amount: number, currency: string): number {
  return currency?.toUpperCase() === "USD" ? amount * MXN_PER_USD : amount;
}

export const ORDER_STATUSES = [
  "nuevo",
  "en_produccion",
  "revision",
  "entregado",
  "cancelado",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  en_produccion: "En producción",
  revision: "En revisión",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Clasifica un ingreso manual como beat (licencia/exclusiva) o producción/servicio */
function classifyIncome(desc: string): "beat" | "servicio" {
  return /licencia|exclusiv/i.test(desc) ? "beat" : "servicio";
}

interface Sale {
  date: string; // ISO
  amount: number; // MXN ya normalizado
  type: "beat" | "servicio";
  source: string;
}

export async function getDashboard() {
  const sb = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [ordersRes, incomeRes, custRes] = await Promise.all([
    sb
      .from("orders")
      .select("type, total, currency, utm_source, created_at, status")
      .neq("status", "cancelado"),
    sb.from("manual_income").select("amount, currency, source, description, date"),
    sb.from("customers").select("*", { count: "exact", head: true }),
  ]);

  // Unifica ventas Stripe + ingresos manuales históricos
  const sales: Sale[] = [];
  for (const o of ordersRes.data ?? []) {
    sales.push({
      date: o.created_at,
      amount: toMXN(Number(o.total), o.currency),
      type: o.type === "servicio" ? "servicio" : "beat",
      source: o.utm_source || "directo",
    });
  }
  for (const i of incomeRes.data ?? []) {
    sales.push({
      date: new Date(i.date).toISOString(),
      amount: toMXN(Number(i.amount), i.currency),
      type: classifyIncome(i.description ?? ""),
      source: (i.source || "Otro").toLowerCase(),
    });
  }

  const sum = (rows: Sale[]) => rows.reduce((a, s) => a + s.amount, 0);
  const month = sales.filter((s) => new Date(s.date) >= monthStart);

  const months: { label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const rows = sales.filter((s) => {
      const d = new Date(s.date);
      return d >= start && d < end;
    });
    months.push({
      label: start.toLocaleDateString("es-MX", { month: "short" }),
      total: sum(rows),
    });
  }

  const sources = new Map<string, number>();
  for (const s of sales) sources.set(s.source, (sources.get(s.source) ?? 0) + 1);

  return {
    monthTotal: sum(month),
    monthCount: month.length,
    allTotal: sum(sales),
    allCount: sales.length,
    beatsTotal: sum(sales.filter((s) => s.type === "beat")),
    serviciosTotal: sum(sales.filter((s) => s.type === "servicio")),
    avgTicket: sales.length ? sum(sales) / sales.length : 0,
    months,
    sources: [...sources.entries()].sort((a, b) => b[1] - a[1]),
    customerCount: custRes.count ?? 0,
  };
}

export async function getOrders(): Promise<OrderRow[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("orders")
    .select(
      "id, type, status, total, currency, summary, note, utm_source, created_at, customers(name, email, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as unknown as OrderRow[]) ?? [];
}

export async function getFinance() {
  const sb = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthStartDate = monthStart.slice(0, 10);

  const [ordersRes, expRes, incRes] = await Promise.all([
    sb.from("orders").select("total, currency, created_at, type").neq("status", "cancelado"),
    sb.from("expenses").select("id, date, amount, currency, category, description, order_id").order("date", { ascending: false }).limit(100),
    sb.from("manual_income").select("id, date, amount, currency, source, description").order("date", { ascending: false }).limit(100),
  ]);

  const orders = ordersRes.data ?? [];
  const expenses = expRes.data ?? [];
  const manualIncome = incRes.data ?? [];

  const stripeIncome = orders.reduce((a, o) => a + toMXN(Number(o.total), o.currency), 0);
  const stripeIncomeMonth = orders
    .filter((o) => o.created_at >= monthStart)
    .reduce((a, o) => a + toMXN(Number(o.total), o.currency), 0);
  const manualTotal = manualIncome.reduce((a, i) => a + toMXN(Number(i.amount), i.currency), 0);
  const manualMonth = manualIncome
    .filter((i) => i.date >= monthStartDate)
    .reduce((a, i) => a + toMXN(Number(i.amount), i.currency), 0);
  const expenseTotal = expenses.reduce((a, e) => a + toMXN(Number(e.amount), e.currency), 0);
  const expenseMonth = expenses
    .filter((e) => e.date >= monthStartDate)
    .reduce((a, e) => a + toMXN(Number(e.amount), e.currency), 0);

  const totalIncome = stripeIncome + manualTotal;
  const totalIncomeMonth = stripeIncomeMonth + manualMonth;

  return {
    totalIncome,
    expenseTotal,
    profit: totalIncome - expenseTotal,
    incomeMonth: totalIncomeMonth,
    expenseMonth,
    profitMonth: totalIncomeMonth - expenseMonth,
    stripeIncome,
    manualTotal,
    expenses,
    manualIncome,
  };
}

export async function getCustomers() {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("customers")
    .select("id, name, email, phone, first_seen, tags, orders(total, currency, type)")
    .order("first_seen", { ascending: false })
    .limit(300);

  return (data ?? []).map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders = (c.orders as any[]) ?? [];
    const spent = orders.reduce((a, o) => a + toMXN(Number(o.total), o.currency), 0);
    return {
      id: c.id as string,
      name: c.name as string | null,
      email: c.email as string,
      phone: c.phone as string | null,
      first_seen: c.first_seen as string,
      tags: (c.tags as string[]) ?? [],
      orderCount: orders.length,
      spent,
    };
  });
}
