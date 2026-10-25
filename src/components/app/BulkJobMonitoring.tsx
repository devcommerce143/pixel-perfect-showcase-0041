import { MessageAlert } from "@/components/app/MessageAlert";
import { RecordReference } from "@/components/app/RecordReference";
import { EntityName } from "@/components/app/EntityName";
import { MessageHistoryApplicationFilter } from "./MessageHistoryApplicationFilter";
import type { HistoryApplicationSelection } from "@/lib/api/history-application-options";
import { useQuery } from "@tanstack/react-query";
import { BulkJobCancellation } from "./BulkJobCancellation";
import { useState, type ReactNode } from "react";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { PageBody, PageHeader, Section } from "./PageHeader";
import { ErrorState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { ChannelLabel } from "./ChannelLabel";
import { FilterSelect } from "./FilterSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queries } from "@/lib/api/queries";
import { BULK_HISTORY_STATUSES, BULK_HISTORY_STATES } from "@/lib/api/bulk-job-history-types";
import type {
  BulkHistoryJob,
  BulkHistoryQuery,
  BulkHistoryItem,
} from "@/lib/api/bulk-job-history-types";
import { bulkHistoryQueryString } from "@/lib/api/http/bulk-job-history-mapper";
import type { SenderIdentityActor, Channel } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";

export function BulkJobMonitoring({ headerActions }: { headerActions?: ReactNode } = {}) {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t, locale } = useI18n();
  const actor: SenderIdentityActor = {
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    userId: user?.id ?? "",
    name: user?.name ?? "",
  };
  const allTenants = actor.role === "super_admin" && !tenantId;
  const [range, setRange] = useState(() => {
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
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<HistoryApplicationSelection>();
  const applicationId = selectedApplication?.id ?? "";
  const [jobId, setJobId] = useState("");
  const [selected, setSelected] = useState<BulkHistoryJob | null>(null);
  let query: BulkHistoryQuery | null = null;
  try {
    const candidate: BulkHistoryQuery = {
      createdFrom: `${range.from}T00:00:00.000Z`,
      createdTo: new Date(Date.parse(`${range.through}T00:00:00.000Z`) + 86400000).toISOString(),
      page,
      pageSize,
      ...(status !== "all" ? { status: status as BulkHistoryJob["status"] } : {}),
      ...(channel !== "all" ? { channel: channel as Channel } : {}),
      ...(applicationId.trim() ? { applicationId: applicationId.trim() } : {}),
      ...(jobId.trim() ? { jobId: jobId.trim() } : {}),
    };
    bulkHistoryQueryString(candidate);
    query = candidate;
  } catch {
    /* Invalid input disables requests until corrected. */
  }
  const jobs = useQuery(queries.bulkHistoryList(actor, query, allTenants, tenantId));
  const columns: Column<BulkHistoryJob>[] = [
    {
      id: "id",
      header: t("bulk.job"),
      cell: (j) => (
        <button className="font-mono text-primary underline" onClick={() => setSelected(j)}>
          {j.applicationName} / {formatDateTime(j.createdAt, locale)}
        </button>
      ),
    },
    ...(allTenants
      ? [
          {
            id: "tenant",
            header: t("common.tenant"),
            cell: (j: BulkHistoryJob) => <div>{j.tenantName}</div>,
          },
        ]
      : []),
    { id: "app", header: t("common.application"), cell: (j) => j.applicationName },
    {
      id: "channel",
      header: t("common.channel"),
      cell: (j) => <ChannelLabel channel={j.channel} />,
    },
    { id: "status", header: t("common.status"), cell: (j) => <StatusBadge status={j.status} /> },
    { id: "total", header: t("common.total"), cell: (j) => formatNumber(j.itemCount, locale) },
    {
      id: "accepted",
      header: t("bulkHistory.accepted"),
      cell: (j) => formatNumber(j.acceptedCount, locale),
    },
    {
      id: "created",
      header: t("bulk.createdAt"),
      cell: (j) => formatDateTime(j.createdAt, locale),
    },
  ];
  return (
    <>
      <PageHeader
        title={t("bulkHistory.title")}
        description={t("bulkHistory.description")}
        actions={headerActions}
      />
      <PageBody>
        <Section
          title={t("bulk.jobs")}
          actions={
            <Button
              variant="outline"
              disabled={!query || jobs.isFetching}
              onClick={() => void jobs.refetch()}
            >
              {t("bulkHistory.refresh")}
            </Button>
          }
        >
          <div className="flex flex-wrap items-end gap-3 border-b p-4">
            <label className="text-sm">
              {t("bulkHistory.from")}
              <Input
                type="date"
                value={range.from}
                onChange={(e) => {
                  setRange({ ...range, from: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <label className="text-sm">
              {t("bulkHistory.through")}
              <Input
                type="date"
                value={range.through}
                onChange={(e) => {
                  setRange({ ...range, through: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <MessageHistoryApplicationFilter
              actor={actor}
              tenantId={tenantId}
              allTenants={allTenants}
              selected={selectedApplication}
              onChange={(selection) => {
                setSelectedApplication(selection);
                setPage(1);
              }}
            />
            <label className="text-sm">
              {t("bulkHistory.jobId")}
              <Input
                dir="ltr"
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <FilterSelect
              label={t("common.status")}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("common.allStatuses") },
                ...BULK_HISTORY_STATUSES.map((s) => ({
                  value: s,
                  label: t(`status.${s}` as MessageKey),
                })),
              ]}
            />
            <FilterSelect
              label={t("common.channel")}
              value={channel}
              onChange={(v) => {
                setChannel(v);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("common.allChannels") },
                ...(["sms", "email", "whatsapp"] as const).map((c) => ({
                  value: c,
                  label: t(`channel.${c}`),
                })),
              ]}
            />
          </div>
          {!query ? (
            <MessageAlert className="p-4 text-danger">
              {t("bulkHistory.invalidFilters")}
            </MessageAlert>
          ) : jobs.isError ? (
            <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={jobs.data?.items}
                loading={jobs.isPending}
                rowKey={(j) => j.id}
              />
              {jobs.data && (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={jobs.data.total}
                  onPage={setPage}
                  onPageSizeChange={(v) => {
                    setPageSize(v);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </Section>
        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t("bulk.jobDetails")}</DialogTitle>
              <DialogDescription>{selected?.applicationName ?? t("entity.job")}</DialogDescription>
            </DialogHeader>
            {selected && (
              <BulkDetails
                key={`${selected.tenantId}:${selected.id}`}
                actor={actor}
                job={selected}
              />
            )}
          </DialogContent>
        </Dialog>
      </PageBody>
    </>
  );
}

function BulkDetails({ actor, job }: { actor: SenderIdentityActor; job: BulkHistoryJob }) {
  const { t, locale } = useI18n();
  const targetTenant = actor.role === "super_admin" ? job.tenantId : undefined;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [state, setState] = useState("all");
  const detail = useQuery(queries.bulkHistoryDetail(actor, job.id, targetTenant));
  const items = useQuery(
    queries.bulkHistoryItems(
      actor,
      job.id,
      { page, pageSize, ...(state !== "all" ? { state: state as BulkHistoryItem["state"] } : {}) },
      targetTenant,
    ),
  );
  const columns: Column<BulkHistoryItem>[] = [
    { id: "row", header: t("bulkHistory.row"), cell: (i) => formatNumber(i.rowNumber, locale) },
    { id: "state", header: t("common.status"), cell: (i) => <StatusBadge status={i.state} /> },
    {
      id: "code",
      header: t("bulkHistory.failureCode"),
      cell: (i) => (i.errorCode ? t(`bulkHistory.code.${i.errorCode}` as MessageKey) : "—"),
    },
    {
      id: "message",
      header: t("entity.message"),
      cell: (i) => (
        <span className="font-mono text-xs">
          <RecordReference value={i.messageId} label={t("entity.message")} />
        </span>
      ),
    },
  ];
  return (
    <>
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : !detail.data ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status={detail.data.status} />
            <span>{t(`bulkHistory.result.${detail.data.result}` as MessageKey)}</span>
          </div>
          <p className="text-sm">
            {detail.data.applicationName} ·{" "}
            <EntityName kind="tenant" id={job.tenantId} name={job.tenantName} />
          </p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-label">{t("bulkHistory.mode")}</dt>
              <dd>{t(`bulkHistory.mode.${detail.data.mode}`)}</dd>
            </div>
            <div>
              <dt className="text-label">{t("bulk.createdAt")}</dt>
              <dd>{formatDateTime(detail.data.createdAt, locale)}</dd>
            </div>
            <div>
              <dt className="text-label">{t("bulkHistory.completedAt")}</dt>
              <dd>
                {detail.data.completedAt ? formatDateTime(detail.data.completedAt, locale) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-label">{t("bulkHistory.cancelledAt")}</dt>
              <dd>
                {detail.data.cancelledAt ? formatDateTime(detail.data.cancelledAt, locale) : "—"}
              </dd>
            </div>
          </dl>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                "itemCount",
                "pendingCount",
                "acceptedCount",
                "invalidCount",
                "skippedCount",
                "failedCount",
              ] as const
            ).map((key) => (
              <div key={key}>
                <dt className="text-label">{t(`bulkHistory.${key}`)}</dt>
                <dd>{formatNumber(detail.data[key], locale)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">
            {t("bulkHistory.resolved")}:{" "}
            {formatNumber(detail.data.itemCount - detail.data.pendingCount, locale)} /{" "}
            {formatNumber(detail.data.itemCount, locale)}
          </p>
          <p className="text-caption">{t("bulkHistory.acceptedHint")}</p>
          <BulkJobCancellation actor={actor} job={detail.data} />
        </>
      )}
      <FilterSelect
        label={t("common.status")}
        value={state}
        onChange={(v) => {
          setState(v);
          setPage(1);
        }}
        options={[
          { value: "all", label: t("common.allStatuses") },
          ...BULK_HISTORY_STATES.map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) })),
        ]}
      />
      {items.isError ? (
        <ErrorState error={items.error} onRetry={() => void items.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items.data?.items}
            loading={items.isPending}
            rowKey={(i) => String(i.rowNumber)}
          />
          {items.data && (
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={items.data.total}
              onPage={setPage}
              onPageSizeChange={(v) => {
                setPageSize(v);
                setPage(1);
              }}
            />
          )}
        </>
      )}
      <Button
        variant="outline"
        onClick={() => {
          void detail.refetch();
          void items.refetch();
        }}
      >
        {t("bulkHistory.refresh")}
      </Button>
    </>
  );
}
