import { TrendingUp } from "lucide-react";
import type { DashboardSummary } from "@/lib/api/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";

export function KpiStrip({ kpis }: { kpis: DashboardSummary["kpis"] }) {
  const { t, locale } = useI18n();
  const items: { key: MessageKey; value: string; accent: string; sub?: string }[] = [
    { key: "dash.kpi.total", value: formatNumber(kpis.total, locale), accent: "bg-primary", sub: `+${formatPercent(kpis.totalDeltaPct, locale)}` },
    { key: "dash.kpi.delivered", value: formatNumber(kpis.delivered, locale), accent: "bg-success" },
    { key: "dash.kpi.pending", value: formatNumber(kpis.pending, locale), accent: "bg-warning" },
    { key: "dash.kpi.failed", value: formatNumber(kpis.failed, locale), accent: "bg-danger" },
    { key: "dash.kpi.rate", value: formatPercent(kpis.deliveryRate, locale), accent: "bg-info" },
  ];
  return (
    <div className="panel grid grid-cols-2 divide-y sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x rtl:lg:divide-x-reverse">
      {items.map((it) => (
        <div key={it.key} className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", it.accent)} aria-hidden />
            <span className="text-label">{t(it.key)}</span>
          </div>
          <div className="mt-1 text-kpi">{it.value}</div>
          {it.sub ? (
            <div className="mt-0.5 flex items-center gap-1 text-caption">
              <TrendingUp className="size-3.5 text-success" aria-hidden />
              <span className="font-medium text-success">{it.sub}</span> {t("dash.vsPrev")}
            </div>
          ) : (
            <div className="mt-0.5 text-caption">{t("common.last14")}</div>
          )}
        </div>
      ))}
    </div>
  );
}
