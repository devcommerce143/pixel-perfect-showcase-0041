import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { TableSkeleton } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { QuotaBar } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import type { TrendPoint } from "@/lib/api/types";
import { formatNumber, formatPercent, formatShortDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/reports")({
  head: () => pageHead("Reports", "Delivery and usage reporting across channels and applications."),
  component: () => <RequirePermission permission="reports.view"><Reports /></RequirePermission>,
});

function Reports() {
  const { t, locale } = useI18n();
  const r = useQuery(queries.report());
  const d = useQuery(queries.dashboard());
  const total = r.data?.sampleSize ?? 1;

  const daily: Column<TrendPoint>[] = [
    { id: "d", header: t("common.date"), cell: (p) => <span className="tabular-nums">{formatShortDay(p.date, locale)}</span> },
    { id: "dl", header: t("status.delivered"), cell: (p) => <span className="tabular-nums">{formatNumber(p.delivered, locale)}</span> },
    { id: "f", header: t("status.failed"), cell: (p) => <span className="tabular-nums">{formatNumber(p.failed, locale)}</span> },
    { id: "p", header: t("status.pending"), cell: (p) => <span className="tabular-nums">{formatNumber(p.pending, locale)}</span> },
    { id: "t", header: t("common.total"), cell: (p) => <span className="font-medium tabular-nums">{formatNumber(p.delivered + p.failed + p.pending, locale)}</span> },
    { id: "fr", header: t("rep.failRate"), cell: (p) => <span className="tabular-nums">{formatPercent((p.failed / (p.delivered + p.failed + p.pending)) * 100, locale)}</span> },
  ];

  return (
    <>
      <PageHeader title={t("rep.title")} description={t("rep.subtitle")}
        actions={<Button size="sm" variant="outline" onClick={() => toast.success(t("rep.exported"))}><Download className="size-4" />{t("common.export")}</Button>} />
      <PageBody>
        {!r.data ? <TableSkeleton /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={t("rep.byStatus")} description={t("rep.sample", { count: formatNumber(total, locale) })}>
              <ul className="divide-y">{r.data.byStatus.map((s) => (
                <li key={s.status} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-32"><StatusBadge status={s.status} /></div>
                  <QuotaBar pct={(s.count / total) * 100} className="flex-1" />
                  <span className="w-20 text-end text-sm tabular-nums">{formatPercent((s.count / total) * 100, locale)}</span>
                </li>))}</ul>
            </Section>
            <Section title={t("rep.byApp")}>
              <table className="w-full text-table">
                <thead className="bg-surface-subtle"><tr className="border-b">
                  <th className="px-4 py-2 text-start text-label">{t("common.application")}</th>
                  <th className="px-4 py-2 text-end text-label">{t("common.total")}</th>
                  <th className="px-4 py-2 text-end text-label">{t("rep.failRate")}</th></tr></thead>
                <tbody className="divide-y">{r.data.byApplication.map((a) => (
                  <tr key={a.applicationName}><td className="px-4 py-2.5">{a.applicationName}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{formatNumber(a.count, locale)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{formatPercent((a.failed / a.count) * 100, locale)}</td></tr>))}</tbody>
              </table>
            </Section>
          </div>
        )}
        <Section title={t("rep.daily")}>
          <DataTable dense columns={daily} rows={d.data ? [...d.data.trend].reverse() : undefined} loading={d.isLoading} rowKey={(p) => p.date} />
        </Section>
      </PageBody>
    </>
  );
}
