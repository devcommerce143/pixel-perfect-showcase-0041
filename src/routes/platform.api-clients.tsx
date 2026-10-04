import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { queries } from "@/lib/api/queries";
import type { PlatformApiClient } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/api-clients")({
  head: () => pageHead("API Clients", "Machine identities across tenants."),
  component: () => <RequirePermission permission="platform.apiClients"><ApiClients /></RequirePermission>,
});

function ApiClients() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const q = useQuery(queries.platformClients({ search, status, pageSize: 50 }));
  const columns: Column<PlatformApiClient>[] = [
    { id: "c", header: t("cred.clientId"), cell: (c) => <span className="font-mono text-xs font-medium">{c.clientId}</span> },
    { id: "t", header: t("nav.tenants"), cell: (c) => (<div><div>{c.tenantName}</div><div className="text-caption">{c.applicationName}</div></div>) },
    { id: "s", header: t("common.status"), cell: (c) => <StatusBadge status={c.status} /> },
    { id: "r", header: t("apc.rateLimit"), cell: (c) => <span className="tabular-nums">{formatNumber(c.rateLimit, locale)}</span> },
    { id: "u", header: t("common.lastUsed"), className: "hidden md:table-cell", cell: (c) => <span className="tabular-nums text-muted-foreground">{c.lastUsedAt ? formatDateTime(c.lastUsedAt, locale) : t("common.never")}</span> },
  ];
  return (
    <>
      <PageHeader title={t("apc.title")} description={t("apc.subtitle")} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("apc.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={setStatus}
              options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "revoked", "expired"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(c) => c.id} />
        </Section>
      </PageBody>
    </>
  );
}
