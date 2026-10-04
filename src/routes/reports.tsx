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
  const exportReport = () => {
    if (!r.data || !d.data) return;
    const cell = (value: string | number) => {
      const text = String(value).replace(/^[=+@-]/, "'$&");
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      [t("rep.exportSection"), t("common.name"), t("common.total"), t("status.failed")],
      ...r.data.byStatus.map((item) => [t("rep.status"), t(`status.${item.status}`), item.count, ""]),
      ...r.data.byApplication.map((item) => [t("rep.application"), item.applicationName, item.count, item.failed]),
      ...[...d.data.trend].reverse().map((item) => [t("rep.daily"), item.date, item.delivered + item.failed + item.pending, item.failed]),
    ];
    const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dolf-connect-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(t("rep.exported"));
  };

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
        actions={<Button size="sm" variant="outline" disabled={!r.data || !d.data} onClick={exportReport}><Download className="size-4" />{t("common.export")}</Button>} />
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
