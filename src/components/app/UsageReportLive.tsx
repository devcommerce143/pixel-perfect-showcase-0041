import { useState } from "react";
import { MonitoringCsvButton } from "./MonitoringCsvButton";
import { useQuery } from "@tanstack/react-query";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { PageBody, PageHeader, Section } from "./PageHeader";
import { EmptyState, ErrorState } from "./States";
import { StatusBadge } from "./StatusBadge";
import { ChannelLabel } from "./ChannelLabel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { queries } from "@/lib/api/queries";
import { usageReportCsv } from "@/lib/api/usage-report";
import type { LiveUsageReport, UsageReportRange } from "@/lib/api/usage-report";
import { usageRangeQuery } from "@/lib/api/http/usage-report-mapper";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";
import { formatNumber, formatDate } from "@/lib/format";
import type { SenderIdentityActor } from "@/lib/api/types";

export function UsageReportLive({ view }: { view: "usage" | "reports" }) {
  const { user, isPlatform } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t, locale } = useI18n();
  const actor: SenderIdentityActor = {
    role: user?.role ?? "viewer",
    userId: user?.id ?? "",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const [dates, setDates] = useState(() => {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      from: new Date(end.getTime() - 31 * 86400000).toISOString().slice(0, 10),
      through: new Date(end.getTime() - 86400000).toISOString().slice(0, 10),
    };
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  let range: UsageReportRange | null = null;
  try {
    const candidate = {
      acceptedFrom: `${dates.from}T00:00:00.000Z`,
      acceptedTo: new Date(Date.parse(`${dates.through}T00:00:00.000Z`) + 86400000).toISOString(),
    };
    usageRangeQuery(candidate);
    range = candidate;
  } catch {
    /* Invalid dates disable requests. */
  }
  const report = useQuery(queries.usageReport(actor, range, tenantId));
  const title = t(view === "usage" ? "liveUsage.title" : "liveUsage.reportTitle");
  if (isPlatform && !tenantId)
    return (
      <>
        <PageHeader title={title} />
        <PageBody>
          <Section>
            <EmptyState title={t("registry.chooseTenant")} body={t("liveUsage.chooseTenant")} />
          </Section>
        </PageBody>
      </>
    );
  const data = report.data;
  const statusColumns: Column<LiveUsageReport["messageCounts"]["byStatus"][number]>[] = [
    {
      id: "status",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "count",
      header: t("liveUsage.messages"),
      cell: (row) => formatNumber(row.count, locale),
    },
  ];
  const channelColumns: Column<LiveUsageReport["messageCounts"]["byChannel"][number]>[] = [
    {
      id: "channel",
      header: t("common.channel"),
      cell: (row) => <ChannelLabel channel={row.channel} />,
    },
    {
      id: "count",
      header: t("liveUsage.messages"),
      cell: (row) => formatNumber(row.count, locale),
    },
  ];
  const applicationColumns: Column<LiveUsageReport["messageCounts"]["byApplication"][number]>[] = [
    {
      id: "app",
      header: t("common.applicationId"),
      cell: (row) => (
        <span className="font-mono text-xs" dir="ltr">
          {row.applicationId}
        </span>
      ),
    },
    {
      id: "channel",
      header: t("common.channel"),
      cell: (row) => <ChannelLabel channel={row.channel} />,
    },
    {
      id: "status",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "count",
      header: t("liveUsage.messages"),
      cell: (row) => formatNumber(row.count, locale),
    },
  ];
  const quotaColumns: Column<LiveUsageReport["quota"][number]>[] = [
    {
      id: "month",
      header: t("liveUsage.month"),
      cell: (row) => formatDate(`${row.periodStart}T00:00:00.000Z`, locale),
    },
    {
      id: "scope",
      header: t("liveUsage.scope"),
      cell: (row) =>
        row.counterScope === "AGGREGATE" ? (
          t("liveUsage.aggregate")
        ) : (
          <ChannelLabel channel={row.counterScope.toLowerCase() as "sms" | "email" | "whatsapp"} />
        ),
    },
    {
      id: "reserved",
      header: t("liveUsage.reserved"),
      cell: (row) => formatNumber(row.reservedCount, locale),
    },
    {
      id: "committed",
      header: t("liveUsage.committed"),
      cell: (row) => formatNumber(row.committedCount, locale),
    },
  ];
  const exportLoaded = () => {
    if (!data || report.isError || !range) return;
    const url = URL.createObjectURL(
      new Blob([usageReportCsv(data)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dolf-usage-${dates.from}-${dates.through}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageHeader
        title={title}
        description={t("liveUsage.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!data || report.isError || !range}
              onClick={exportLoaded}
            >
              {t("liveUsage.export")}
            </Button>
            <MonitoringCsvButton
              actor={actor}
              tenantId={tenantId}
              request={range ? { kind: "usage", range } : null}
              disabled={report.isError}
            />
          </div>
        }
      />
      <PageBody>
        <Section>
          <p className="p-4 text-subtle">{t("monitoringExport.usageNote")}</p>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-sm">
              {t("bulkHistory.from")}
              <Input
                type="date"
                value={dates.from}
                onChange={(e) => {
                  setDates({ ...dates, from: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <label className="text-sm">
              {t("bulkHistory.through")}
              <Input
                type="date"
                value={dates.through}
                onChange={(e) => {
                  setDates({ ...dates, through: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <Button
              variant="outline"
              disabled={!range || report.isFetching}
              onClick={() => void report.refetch()}
            >
              {t("registry.refresh")}
            </Button>
          </div>
        </Section>
        {!range ? (
          <p role="alert" className="text-danger">
            {t("liveUsage.invalidRange")}
          </p>
        ) : report.isError ? (
          <Section>
            <ErrorState onRetry={() => void report.refetch()} />
          </Section>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("liveUsage.statusHint")}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title={t("liveUsage.byStatus")}>
                <DataTable
                  columns={statusColumns}
                  rows={data?.messageCounts.byStatus}
                  loading={report.isPending}
                  rowKey={(row) => row.status}
                />
              </Section>
              <Section title={t("liveUsage.byChannel")}>
                <DataTable
                  columns={channelColumns}
                  rows={data?.messageCounts.byChannel}
                  loading={report.isPending}
                  rowKey={(row) => row.channel}
                />
              </Section>
            </div>
            <Section title={t("liveUsage.byApplication")} description={t("liveUsage.groupHint")}>
              <DataTable
                columns={applicationColumns}
                rows={data?.messageCounts.byApplication.slice(
                  (page - 1) * pageSize,
                  page * pageSize,
                )}
                loading={report.isPending}
                rowKey={(row) => `${row.applicationId}:${row.channel}:${row.status}`}
              />
              {data && (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={data.messageCounts.byApplication.length}
                  onPage={setPage}
                  onPageSizeChange={(value) => {
                    setPageSize(value);
                    setPage(1);
                  }}
                />
              )}
            </Section>
            <Section title={t("liveUsage.quota")} description={t("liveUsage.quotaHint")}>
              <DataTable
                columns={quotaColumns}
                rows={data?.quota}
                loading={report.isPending}
                rowKey={(row) => `${row.periodStart}:${row.counterScope}`}
              />
            </Section>
          </>
        )}
      </PageBody>
    </>
  );
}
