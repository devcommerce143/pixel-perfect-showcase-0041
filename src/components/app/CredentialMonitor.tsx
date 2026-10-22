import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import type { SenderIdentityActor } from "@/lib/api/types";
import type { MonitoredCredential, MonitoredCredentialStatus } from "@/lib/api/credential-monitor";
import { isTenantUuid } from "@/lib/api/http/tenant-mapper";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { ErrorState } from "./States";
import { StatusBadge } from "./StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CredentialMonitor({
  actor,
  tenantId,
}: {
  actor: SenderIdentityActor;
  tenantId?: string | undefined;
}) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [search, setSearch] = useState("");
  const [application, setApplication] = useState("");
  const [status, setStatus] = useState<MonitoredCredentialStatus | "all">("all");
  const [applied, setApplied] = useState({
    search: "",
    application: "",
    status: "all" as MonitoredCredentialStatus | "all",
  });
  const invalidApplication = application !== "" && !isTenantUuid(application);
  const list = useQuery(
    queries.credentialMonitor(actor, {
      page,
      pageSize,
      ...(tenantId ? { tenantId } : {}),
      ...(applied.application ? { applicationId: applied.application } : {}),
      ...(applied.search ? { search: applied.search } : {}),
      ...(applied.status !== "all" ? { status: applied.status } : {}),
    }),
  );
  const date = (value: string | null) =>
    value === null ? t("ten.unavailable") : formatDateTime(value, locale);
  const columns: Column<MonitoredCredential>[] = [
    {
      id: "client",
      header: t("cred.clientId"),
      cell: (row) => (
        <div className="font-mono text-xs">
          {row.clientId}
          <p className="text-caption">{row.id}</p>
        </div>
      ),
    },
    {
      id: "tenant",
      header: t("nav.tenants"),
      cell: (row) => (
        <div>
          {row.tenantName}
          <p className="font-mono text-xs">{row.tenantId}</p>
        </div>
      ),
    },
    {
      id: "application",
      header: t("common.application"),
      cell: (row) => (
        <div>
          {row.applicationName}
          <p className="font-mono text-xs">{row.applicationId}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: t("monitorCred.effectiveStatus"),
      cell: (row) => <StatusBadge status={row.effectiveStatus.toLowerCase()} />,
    },
    {
      id: "stored",
      header: t("monitorCred.storedStatus"),
      cell: (row) => <StatusBadge status={row.status.toLowerCase()} />,
    },
    { id: "created", header: t("common.createdAt"), cell: (row) => date(row.createdAt) },
    { id: "expires", header: t("cred.expiresAt"), cell: (row) => date(row.expiresAt) },
    {
      id: "used",
      header: t("common.lastUsed"),
      cell: (row) => (row.lastUsedAt === null ? t("common.never") : date(row.lastUsedAt)),
    },
    {
      id: "rate",
      header: t("monitorCred.storedRate"),
      cell: (row) =>
        row.rateLimitPerSecondOverride === null
          ? t("ten.unavailable")
          : formatNumber(row.rateLimitPerSecondOverride, locale),
    },
    {
      id: "manage",
      header: t("common.actions"),
      cell: (row) => (
        <Link
          className="underline"
          to="/credentials"
          search={{ tenantId: row.tenantId, applicationId: row.applicationId }}
        >
          {t("monitorCred.manage")}
        </Link>
      ),
    },
  ];
  return (
    <>
      <PageHeader title={t("apc.title")} description={t("monitorCred.description")} />
      <PageBody>
        <Section>
          <div className="space-y-3 p-4">
            <p className="text-sm text-subtle">{t("monitorCred.rateNotice")}</p>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (invalidApplication) return;
                setApplied({ search: search.trim(), application, status });
                setPage(1);
              }}
            >
              <div className="grid gap-1">
                <Label htmlFor="credential-monitor-search">{t("cred.clientId")}</Label>
                <Input
                  id="credential-monitor-search"
                  value={search}
                  maxLength={100}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="credential-monitor-application">
                  {t("monitorCred.applicationId")}
                </Label>
                <Input
                  id="credential-monitor-application"
                  dir="ltr"
                  value={application}
                  aria-invalid={invalidApplication}
                  onChange={(event) => setApplication(event.target.value.trim())}
                />
                {invalidApplication && (
                  <p role="alert" className="text-danger">
                    {t("monitorCred.invalidApplication")}
                  </p>
                )}
              </div>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger className="w-48" aria-label={t("common.status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                  {(["ACTIVE", "EXPIRED", "REVOKED"] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`status.${value.toLowerCase() as "active" | "expired" | "revoked"}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={invalidApplication || list.isFetching}>
                {t("monitorCred.apply")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={list.isFetching}
                onClick={() => void list.refetch()}
              >
                {t("common.refresh")}
              </Button>
            </form>
          </div>
          {list.isError ? (
            <ErrorState onRetry={() => void list.refetch()} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={list.data?.items}
                loading={list.isPending}
                rowKey={(row) => row.id}
              />
              {list.data && (
                <ListPagination
                  page={list.data.page}
                  pageSize={list.data.pageSize}
                  total={list.data.total}
                  onPage={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </Section>
      </PageBody>
    </>
  );
}
