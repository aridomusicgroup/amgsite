export const money = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-MX");

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-lgb-red/40 bg-lgb-red/5"
          : "border-white/8 bg-white/[0.03]"
      }`}
    >
      <p className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className="text-white font-coolvetica text-3xl leading-none">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-2">{sub}</p>}
    </div>
  );
}

export function Bars({ data }: { data: { label: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end justify-between gap-3 h-40">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex items-end justify-center h-32">
            <div
              className="w-full max-w-[44px] bg-gradient-to-t from-lgb-red/60 to-lgb-red rounded-t-lg transition-all"
              style={{ height: `${Math.max((d.total / max) * 100, 2)}%` }}
              title={money(d.total)}
            />
          </div>
          <span className="text-white/40 text-[11px] capitalize">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
