import { AlertTriangle, OctagonAlert } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { cn } from "@/lib/utils";

export function quotaTone(pct: number) {
  if (pct >= 100) return "danger" as const;
  if (pct >= 90) return "danger" as const;
  if (pct >= 80) return "warning" as const;
  return "success" as const;
}

const BAR: Record<string, string> = { success: "bg-primary", warning: "bg-warning", danger: "bg-danger" };

export function QuotaBar({ pct, className }: { pct: number; className?: string }) {
  const tone = quotaTone(pct);
  return (
    <div className={cn("relative h-2 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", BAR[tone])} style={{ width: `${Math.min(pct, 100)}%` }} />
      <div className="absolute inset-y-0 start-[80%] w-px bg-card" aria-hidden />
      <div className="absolute inset-y-0 start-[90%] w-px bg-card" aria-hidden />
    </div>
  );
}

export function QuotaMeter({ used, limit }: { used: number; limit: number }) {
  const { t, locale } = useI18n();
  const pct = (used / limit) * 100;
  const alertKey = pct >= 100 ? "dash.threshold100" : pct >= 90 ? "dash.threshold90" : pct >= 80 ? "dash.threshold80" : null;
  const tone = quotaTone(pct);
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-kpi">{formatPercent(pct, locale)}</span>
        <span className="text-caption tabular-nums">{formatNumber(used, locale)} / {formatNumber(limit, locale)}</span>
      </div>
      <QuotaBar pct={pct} />
      <dl className="grid grid-cols-3 gap-2 text-table">
        {[
          ["dash.used", used],
          ["dash.limit", limit],
          ["dash.remaining", Math.max(limit - used, 0)],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-caption">{t(k as never)}</dt>
            <dd className="font-medium tabular-nums">{formatNumber(v as number, locale)}</dd>
          </div>
        ))}
      </dl>
      {alertKey && (
        <div role="status" className={cn("flex items-start gap-2 rounded-md px-3 py-2 text-[0.8125rem]", tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
          {tone === "danger" ? <OctagonAlert className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
          <span>{t(alertKey)}</span>
        </div>
      )}
    </div>
  );
}
