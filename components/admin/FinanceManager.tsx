"use client";
import { useState } from "react";
import { Plus, Trash2, TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { money } from "@/components/admin/ui";

interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  order_id: string | null;
}
interface Income {
  id: string;
  date: string;
  amount: number;
  currency: string;
  source: string;
  description: string | null;
}

const EXPENSE_CATEGORIES = [
  "Músicos",
  "Software",
  "Equipo",
  "Marketing",
  "Estudio/Renta",
  "Servicios",
  "Otro",
];
const INCOME_SOURCES = ["BeatStars", "Efectivo", "Transferencia", "PayPal", "Otro"];

export function FinanceManager({
  initialExpenses,
  initialIncome,
  orders,
}: {
  initialExpenses: Expense[];
  initialIncome: Income[];
  orders: { id: string; label: string }[];
}) {
  const [tab, setTab] = useState<"expenses" | "income">("expenses");
  const [expenses, setExpenses] = useState(initialExpenses);
  const [income, setIncome] = useState(initialIncome);

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("expenses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all cursor-pointer ${
            tab === "expenses"
              ? "bg-lgb-red border-lgb-red text-white"
              : "border-white/15 text-white/50 hover:border-white/30"
          }`}
        >
          <TrendingDown size={15} /> Egresos
        </button>
        <button
          onClick={() => setTab("income")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all cursor-pointer ${
            tab === "income"
              ? "bg-lgb-red border-lgb-red text-white"
              : "border-white/15 text-white/50 hover:border-white/30"
          }`}
        >
          <TrendingUp size={15} /> Ingresos manuales
        </button>
      </div>

      {tab === "expenses" ? (
        <ExpenseSection expenses={expenses} setExpenses={setExpenses} orders={orders} />
      ) : (
        <IncomeSection income={income} setIncome={setIncome} />
      )}
    </div>
  );
}

function ExpenseSection({
  expenses,
  setExpenses,
  orders,
}: {
  expenses: Expense[];
  setExpenses: (e: Expense[]) => void;
  orders: { id: string; label: string }[];
}) {
  const [form, setForm] = useState({ amount: "", category: "Músicos", description: "", order_id: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          kind: "expense",
          amount: Number(form.amount),
          category: form.category,
          description: form.description,
          order_id: form.order_id || null,
        }),
      });
      const data = await res.json();
      if (data.row) {
        setExpenses([data.row, ...expenses]);
        setForm({ amount: "", category: "Músicos", description: "", order_id: "" });
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", kind: "expense", id }),
    });
  };

  return (
    <div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 mb-5 grid sm:grid-cols-[120px_1fr_1.4fr_auto] gap-3 items-end">
        <Field label="Monto MXN">
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="input"
          />
        </Field>
        <Field label="Categoría">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input cursor-pointer"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} className="bg-lgb-dark">
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción / pedido (opcional)">
          <div className="flex gap-2">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej. tololochero del corrido de Juan"
              className="input flex-1"
            />
            {orders.length > 0 && (
              <select
                value={form.order_id}
                onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                className="input cursor-pointer max-w-[40%]"
                title="Ligar a un pedido"
              >
                <option value="" className="bg-lgb-dark">
                  Sin pedido
                </option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id} className="bg-lgb-dark">
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Field>
        <button
          onClick={add}
          disabled={saving}
          className="bg-lgb-red text-white h-[42px] px-5 rounded-xl flex items-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer text-sm"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Agregar
        </button>
      </div>

      <Table
        rows={expenses}
        empty="Aún no hay egresos. Captura el primero arriba."
        render={(e) => ({
          left: e.category,
          mid: e.description || (e.order_id ? "Ligado a un pedido" : "—"),
          date: e.date,
          amount: `- ${money(Number(e.amount))}`,
          amountClass: "text-red-300",
          id: e.id,
        })}
        onRemove={remove}
      />
    </div>
  );
}

function IncomeSection({
  income,
  setIncome,
}: {
  income: Income[];
  setIncome: (i: Income[]) => void;
}) {
  const [form, setForm] = useState({ amount: "", source: "BeatStars", description: "" });
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          kind: "income",
          amount: Number(form.amount),
          source: form.source,
          description: form.description,
        }),
      });
      const data = await res.json();
      if (data.row) {
        setIncome([data.row, ...income]);
        setForm({ amount: "", source: "BeatStars", description: "" });
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setIncome(income.filter((i) => i.id !== id));
    await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", kind: "income", id }),
    });
  };

  return (
    <div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 mb-5 grid sm:grid-cols-[120px_1fr_1.4fr_auto] gap-3 items-end">
        <Field label="Monto MXN">
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="input"
          />
        </Field>
        <Field label="Fuente">
          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="input cursor-pointer"
          >
            {INCOME_SOURCES.map((s) => (
              <option key={s} className="bg-lgb-dark">
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción (opcional)">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej. venta de beat en BeatStars"
            className="input"
          />
        </Field>
        <button
          onClick={add}
          disabled={saving}
          className="bg-lgb-red text-white h-[42px] px-5 rounded-xl flex items-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer text-sm"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Agregar
        </button>
      </div>

      <Table
        rows={income}
        empty="Aún no hay ingresos manuales. Registra ventas de BeatStars, efectivo, etc."
        render={(i) => ({
          left: i.source,
          mid: i.description || "—",
          date: i.date,
          amount: `+ ${money(Number(i.amount))}`,
          amountClass: "text-green-300",
          id: i.id,
        })}
        onRemove={remove}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-white/40 text-xs">{label}</span>
      {children}
    </label>
  );
}

interface RowView {
  left: string;
  mid: string;
  date: string;
  amount: string;
  amountClass: string;
  id: string;
}
function Table<T>({
  rows,
  render,
  empty,
  onRemove,
}: {
  rows: T[];
  render: (r: T) => RowView;
  empty: string;
  onRemove: (id: string) => void;
}) {
  if (rows.length === 0)
    return <p className="text-white/30 text-sm py-10 text-center">{empty}</p>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const v = render(r);
        return (
          <div
            key={v.id}
            className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
          >
            <span className="text-xs text-white/40 w-20 shrink-0">
              {new Date(v.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
            </span>
            <span className="text-sm text-white/80 w-28 shrink-0 truncate">{v.left}</span>
            <span className="text-sm text-white/50 flex-1 min-w-0 truncate">{v.mid}</span>
            <span className={`text-sm font-coolvetica shrink-0 ${v.amountClass}`}>{v.amount}</span>
            <button
              onClick={() => onRemove(v.id)}
              className="text-white/20 hover:text-red-400 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
