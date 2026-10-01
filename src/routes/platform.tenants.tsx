import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { QuotaBar } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import type { Tenant } from "@/lib/api/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/tenants")({
  head: () => pageHead("Clients / Tenants", "All tenant organizations on the Dolf Connect platform with plan, volume and quota status."),
  component: () => <RequirePermission permission="platform.tenants"><Tenants /></RequirePermission>,
});

function Tenants() {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const q = useQuery(queries.tenants({ search, status, pageSize: 50 }));
  const columns: Column<Tenant>[] = [
    { id: "name", header: t("common.name"), cell: (r) => (<div><div className="font-medium">{r.name}</div><div className="font-mono text-xs text-muted-foreground">{r.id}</div></div>) },
    { id: "plan", header: t("ten.plan"), cell: (r) => r.plan },
    { id: "status", header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
    { id: "users", header: t("ten.users"), cell: (r) => <span className="tabular-nums">{r.users}</span>, className: "hidden md:table-cell" },
    { id: "vol", header: t("ten.volume"), cell: (r) => <span className="tabular-nums">{formatNumber(r.messages30d, locale)}</span> },
    { id: "quota", header: t("ten.quota"), cell: (r) => (
      <div className="flex w-36 items-center gap-2"><QuotaBar pct={r.quotaPct} className="flex-1" /><span className="w-10 text-end text-xs tabular-nums">{formatPercent(r.quotaPct, locale, 0)}</span></div>) },
    { id: "region", header: t("ten.region"), cell: (r) => <span className="text-muted-foreground">{r.region}</span>, className: "hidden lg:table-cell" },
  ];
  return (
    <>
      <PageHeader title={t("ten.title")} description={t("ten.subtitle")} actions={<Button size="sm"><Plus className="size-4" />{t("ten.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("common.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={setStatus}
              options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "trial", "suspended"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(r) => r.id} />
        </Section>
      </PageBody>
    </>
  );
}
