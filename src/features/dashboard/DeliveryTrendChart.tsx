import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/api/types";
import { formatCompact, formatNumber, formatShortDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";

const SERIES = [
  { key: "delivered", color: "var(--success)", label: "status.delivered" },
  { key: "pending", color: "var(--warning)", label: "status.pending" },
  { key: "failed", color: "var(--danger)", label: "status.failed" },
] as const;

export function DeliveryTrendChart({ data }: { data: TrendPoint[] }) {
  const { t, locale, dir } = useI18n();
  const rtl = dir === "rtl";
  return (
    <div className="px-2 pb-3 pt-2">
      <div className="mb-1 flex flex-wrap gap-4 px-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-caption">
            <span className="h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
            {t(s.label)}
          </span>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" reversed={rtl} tickFormatter={(d) => formatShortDay(d, locale)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis orientation={rtl ? "right" : "left"} tickFormatter={(v) => formatCompact(v, locale)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, boxShadow: "var(--shadow-overlay)" }}
              labelFormatter={(d) => formatShortDay(String(d), locale)}
              formatter={(v, name) => [formatNumber(Number(v), locale), t(`status.${name}` as never)]}
            />
            {SERIES.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.75} fill={s.color} fillOpacity={0.08} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
