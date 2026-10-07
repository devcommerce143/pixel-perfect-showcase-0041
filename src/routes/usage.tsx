import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { QuotaBar, QuotaMeter } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { QuotaPolicy, TenantUsageSortField, UsageQuotaStatus } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/usage")({
  validateSearch: (search: Record<string, unknown>) => ({ tenantId: typeof search["tenantId"] === "string" ? search["tenantId"] : undefined }),
  head: () => pageHead("Usage & Quotas", "Tenant message consumption against subscription entitlements for the current billing period."),
  component: () => <RequirePermission permission="usage.view"><Usage /></RequirePermission>,
});

function Usage() {
  const { t, locale } = useI18n();
  const { user, isPlatform } = useSession();
  const { tenantId: requestedTenantId } = Route.useSearch();
  const [tenantSearch, setTenantSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<UsageQuotaStatus | "all">("all");
  const [policyFilter, setPolicyFilter] = useState<QuotaPolicy | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<TenantUsageSortField>("usagePercent");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const actor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const selectedTenantId = isPlatform ? requestedTenantId : actor.tenantId ?? undefined;
  const tableQuery = { page, pageSize, search: tenantSearch, plan: planFilter, status: statusFilter, quotaPolicy: policyFilter, sortBy, sortDirection };
  const query = useQuery(queries.usage(actor, selectedTenantId, selectedTenantId ? undefined : tableQuery));
  const data = query.data;
  if (!data && query.isError) return <PageBody><Section><p role="alert" className="p-4 text-sm text-danger">{t("usage.loadError")}</p></Section></PageBody>;
  if (!data) return <PageBody><Section><div className="h-24 animate-pulse bg-muted" /></Section></PageBody>;
  const selectedTenant = isPlatform && selectedTenantId ? data.tenants[0] : !isPlatform ? data.tenants[0] : undefined;
  if (selectedTenantId && !selectedTenant) return <PageBody><Section><p className="p-4 text-sm text-muted-foreground">{t("usage.tenantNotFound")}</p></Section></PageBody>;

  if (selectedTenant) {
    const used = selectedTenant.channels.reduce((total, channel) => total + channel.used, 0);
    const limit = selectedTenant.channels.reduce((total, channel) => total + channel.limit, 0);
    return (
      <>
        <PageHeader title={selectedTenant.tenantName} description={selectedTenant.tenantId} actions={
          <div className="flex flex-wrap gap-2">
            {isPlatform && <Button asChild variant="outline" size="sm"><Link to="/usage" search={{ tenantId: undefined }}><ArrowLeft className="size-4 rtl:rotate-180" />{t("usage.allTenants")}</Link></Button>}
            {isPlatform && <Button asChild size="sm"><Link to="/platform/tenants">{t("usage.manageSubscription")}<ArrowUpRight className="size-4" /></Link></Button>}
          </div>
        } />
        <PageBody>
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title={t("usage.totalUsage")}><QuotaMeter used={used} limit={limit} platformView={isPlatform} /></Section>
            <Section title={t("usage.subscription")} className="lg:col-span-2">
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse">
                <div className="px-4 py-3"><dt className="text-label">{t("usage.plan")}</dt><dd className="mt-1 text-section-title">{selectedTenant.plan}</dd></div>
                <div className="px-4 py-3"><dt className="text-label">{t("usage.period")}</dt><dd className="mt-1 text-body">{formatDate(selectedTenant.periodStart, locale)} – {formatDate(selectedTenant.periodEnd, locale)}</dd></div>
                <div className="px-4 py-3"><dt className="text-label">{t("usage.renewal")}</dt><dd className="mt-1 text-body">{formatDate(selectedTenant.renewalDate, locale)}</dd></div>
                <div className="px-4 py-3"><dt className="text-label">{t("usage.quotaPolicy")}</dt><dd className="mt-1 text-body">{t(`usage.policy.${selectedTenant.quotaPolicy}`)}</dd></div>
                <div className="px-4 py-3"><dt className="text-label">{t("usage.tpsLimit")}</dt><dd className="mt-1 text-body">{formatNumber(selectedTenant.tpsLimit, locale)} {t("usage.messagesPerSecond")}</dd></div>
              </dl>
            </Section>
          </div>
          <Section title={t("usage.byChannel")}>
            <ul className="divide-y">
              {selectedTenant.channels.map((channel) => {
                const pct = channel.limit ? channel.used / channel.limit * 100 : 0;
                return <li key={channel.channel} className="grid items-center gap-3 px-4 py-3.5 md:grid-cols-[10rem_1fr_14rem]">
                  <ChannelLabel channel={channel.channel} className="font-medium" /><QuotaBar pct={pct} />
                  <div className="flex justify-between gap-3 text-table tabular-nums md:justify-end"><span>{formatNumber(channel.used, locale)} / {formatNumber(channel.limit, locale)}</span><span className="w-14 text-end font-medium">{formatPercent(pct, locale)}</span></div>
                </li>;
              })}
            </ul>
          </Section>
          <Section title={t("usage.byApplication")} description={`${selectedTenant.tenantName} → ${t("usage.applicationChannelUsage")}`}>
            <div className="divide-y">
              {selectedTenant.applications.map((application) => (
                <div key={application.applicationId} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(12rem,1fr)_2fr] sm:items-center">
                  <div><div className="font-medium">{application.applicationName}</div><div className="font-mono text-xs text-muted-foreground">{application.applicationId}</div></div>
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">{application.channels.map((channel) => <li key={channel.channel} className="flex items-center gap-2 text-sm"><ChannelLabel channel={channel.channel} /><span className="tabular-nums">{formatNumber(channel.used, locale)}</span></li>)}</ul>
                </div>
              ))}
            </div>
          </Section>
        </PageBody>
      </>
    );
  }

  const totals = data.tenants.flatMap((tenant) => tenant.channels);
  const totalUsed = totals.reduce((total, channel) => total + channel.used, 0);
  const tenantsAt = (threshold: number) => data.tenants.filter((tenant) => {
    const used = tenant.channels.reduce((total, channel) => total + channel.used, 0);
    const limit = tenant.channels.reduce((total, channel) => total + channel.limit, 0);
    return limit > 0 && used / limit * 100 >= threshold;
  });
  const tenantsAt80 = tenantsAt(80);
  const tenantsAt90 = tenantsAt(90);
  const tenantsAt100 = tenantsAt(100);
  const channels = (["sms", "whatsapp", "email"] as const).map((channel) => ({
    channel,
    used: totals.filter((item) => item.channel === channel).reduce((total, item) => total + item.used, 0),
    limit: totals.filter((item) => item.channel === channel).reduce((total, item) => total + item.limit, 0),
  }));
  const tenantTable = data.tenantTable;
  const pageCount = Math.max(1, Math.ceil(tenantTable.total / pageSize));
  const rangeStart = tenantTable.total ? (tenantTable.page - 1) * tenantTable.pageSize + 1 : 0;
  const rangeEnd = Math.min(tenantTable.page * tenantTable.pageSize, tenantTable.total);
  const visiblePages: (number | "startEllipsis" | "endEllipsis")[] = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [1, ...(tenantTable.page > 4 ? ["startEllipsis" as const] : []), ...Array.from({ length: 3 }, (_, index) => tenantTable.page + index - 1).filter((value) => value > 1 && value < pageCount), ...(tenantTable.page < pageCount - 3 ? ["endEllipsis" as const] : []), pageCount];
  const toggleSort = (field: TenantUsageSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "tenantName" ? "asc" : "desc");
    setSortBy(field);
    setPage(1);
  };
  const sortIcon = (field: TenantUsageSortField) => sortBy !== field ? <ArrowUpDown className="size-3.5" /> : sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  return (
    <>
      <PageHeader title={t("usage.title")} description={t("usage.platformSubtitle")} />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Section title={t("usage.totalUsage")}><div className="p-4"><div className="text-kpi tabular-nums">{formatNumber(totalUsed, locale)}</div><p className="mt-1 text-caption">{formatDate(data.periodStart, locale)} – {formatDate(data.periodEnd, locale)}</p></div></Section>
          {[["usage.at80", tenantsAt80.length], ["usage.at90", tenantsAt90.length], ["usage.at100", tenantsAt100.length]].map(([key, count]) => <Section key={key as string} title={t(key as never)}><div className="p-4"><div className="text-kpi tabular-nums">{formatNumber(count as number, locale)}</div><p className="mt-1 text-caption">{t("usage.tenants")}</p></div></Section>)}
        </div>
        <Section title={t("usage.byChannel")}>
          <ul className="divide-y">
            {channels.map((channel) => {
              const pct = channel.limit ? channel.used / channel.limit * 100 : 0;
              return (
                <li key={channel.channel} className="grid items-center gap-3 px-4 py-3.5 md:grid-cols-[10rem_1fr_14rem]">
                  <ChannelLabel channel={channel.channel} className="font-medium" />
                  <QuotaBar pct={pct} />
                  <div className="flex justify-between gap-3 text-table tabular-nums md:justify-end">
                    <span>{formatNumber(channel.used, locale)} / {formatNumber(channel.limit, locale)}</span>
                    <span className="w-14 text-end font-medium">{formatPercent(pct, locale)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section title={t("usage.approaching")}>
          {tenantsAt80.length ? <ul className="divide-y">{tenantsAt80.map((tenant) => {
            const used = tenant.channels.reduce((total, channel) => total + channel.used, 0);
            const limit = tenant.channels.reduce((total, channel) => total + channel.limit, 0);
            return <li key={tenant.tenantId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div><Link to="/usage" search={{ tenantId: tenant.tenantId }} className="font-medium text-primary hover:underline">{tenant.tenantName}</Link><p className="text-caption">{tenant.plan}</p></div>
              <div className="flex w-full items-center gap-3 sm:w-64"><QuotaBar pct={used / limit * 100} className="flex-1" /><span className="w-12 text-end text-sm tabular-nums">{formatPercent(used / limit * 100, locale)}</span></div>
            </li>;
          })}</ul> : <p className="p-4 text-sm text-muted-foreground">{t("usage.noneApproaching")}</p>}
        </Section>
        <Section title={t("usage.tenantUsage")}>
          <div className="flex flex-col gap-2 border-b px-4 py-3">
            <Input value={tenantSearch} onChange={(event) => { setTenantSearch(event.target.value); setPage(1); }} placeholder={t("usage.searchTenant")} aria-label={t("usage.searchTenant")} className="h-9 sm:max-w-sm" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Select value={planFilter} onValueChange={(value) => { setPlanFilter(value); setPage(1); }}>
                <SelectTrigger aria-label={t("usage.filterPlan")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("usage.allPlans")}</SelectItem>{data.planOptions.map((plan) => <SelectItem key={plan} value={plan}>{plan}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as UsageQuotaStatus | "all"); setPage(1); }}>
                <SelectTrigger aria-label={t("usage.filterStatus")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("usage.allStatuses")}</SelectItem>{(["normal", "approaching", "warning", "at_limit"] as UsageQuotaStatus[]).map((status) => <SelectItem key={status} value={status}>{t(`usage.status.${status}`)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={policyFilter} onValueChange={(value) => { setPolicyFilter(value as QuotaPolicy | "all"); setPage(1); }}>
                <SelectTrigger aria-label={t("usage.filterQuotaPolicy")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("usage.allPolicies")}</SelectItem><SelectItem value="hard_stop">{t("usage.policy.hard_stop")}</SelectItem><SelectItem value="soft_cap">{t("usage.policy.soft_cap")}</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 text-start text-sm">
              <thead className="border-b bg-surface-subtle text-label"><tr>
                <th aria-sort={sortBy === "tenantName" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-4 py-3"><button type="button" onClick={() => toggleSort("tenantName")} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground">{t("usage.tenant")}{sortIcon("tenantName")}</button></th>
                <th className="px-4 py-3">{t("usage.plan")}</th>
                <th aria-sort={sortBy === "used" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-4 py-3"><button type="button" onClick={() => toggleSort("used")} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground">{t("usage.used")}{sortIcon("used")}</button></th>
                <th className="px-4 py-3">{t("usage.limit")}</th>
                <th aria-sort={sortBy === "remaining" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-4 py-3"><button type="button" onClick={() => toggleSort("remaining")} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground">{t("usage.remaining")}{sortIcon("remaining")}</button></th>
                <th aria-sort={sortBy === "usagePercent" ? sortDirection === "asc" ? "ascending" : "descending" : "none"} className="px-4 py-3"><button type="button" onClick={() => toggleSort("usagePercent")} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground">{t("usage.percent")}{sortIcon("usagePercent")}</button></th>
                <th className="px-4 py-3">{t("usage.quotaPolicy")}</th><th className="px-4 py-3">{t("common.status")}</th>
              </tr></thead>
              <tbody className="divide-y">{tenantTable.items.map((tenant) => <tr key={tenant.tenantId} className="hover:bg-surface-subtle/60">
                <td className="px-4 py-3"><Link to="/usage" search={{ tenantId: tenant.tenantId }} className="font-medium text-primary hover:underline">{tenant.tenantName}</Link><div className="font-mono text-xs text-muted-foreground">{tenant.tenantId}</div></td>
                <td className="px-4 py-3">{tenant.plan}</td><td className="px-4 py-3 tabular-nums">{formatNumber(tenant.used, locale)}</td><td className="px-4 py-3 tabular-nums">{formatNumber(tenant.limit, locale)}</td><td className="px-4 py-3 tabular-nums">{formatNumber(tenant.remaining, locale)}</td><td className="px-4 py-3 tabular-nums">{formatPercent(tenant.usagePercent, locale)}</td>
                <td className="px-4 py-3">{t(`usage.policy.${tenant.quotaPolicy}`)}</td><td className="px-4 py-3"><span className={tenant.status === "at_limit" ? "font-medium text-danger" : tenant.status === "normal" ? "font-medium text-success" : "font-medium text-warning"}>{t(`usage.status.${tenant.status}`)}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
          {tenantTable.total === 0 ? <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><SearchX className="size-8 text-muted-foreground" aria-hidden /><p className="font-medium">{t("usage.noTenantMatches")}</p><p className="text-sm text-muted-foreground">{t("common.noResultsHint")}</p></div> : (
            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption">{t("usage.showingTenants", { start: formatNumber(rangeStart, locale), end: formatNumber(rangeEnd, locale), count: formatNumber(tenantTable.total, locale) })}</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-caption">{t("usage.pageSize")}<Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value) as 10 | 20 | 50); setPage(1); }}><SelectTrigger className="h-8 w-20" aria-label={t("usage.pageSize")}><SelectValue /></SelectTrigger><SelectContent>{([10, 20, 50] as const).map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></label>
                <nav aria-label={t("usage.pagination")} className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 gap-1 px-2" disabled={tenantTable.page <= 1} onClick={() => setPage(tenantTable.page - 1)}><ChevronLeft className="size-4 rtl:rotate-180" />{t("common.previous")}</Button>
                  {visiblePages.map((pageNumber) => typeof pageNumber === "number" ? <Button key={pageNumber} variant={pageNumber === tenantTable.page ? "outline" : "ghost"} size="icon" className="size-8" aria-label={t("usage.goToPage", { page: pageNumber })} aria-current={pageNumber === tenantTable.page ? "page" : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</Button> : <span key={pageNumber} className="px-1 text-muted-foreground" aria-hidden>…</span>)}
                  <Button variant="outline" size="sm" className="h-8 gap-1 px-2" disabled={tenantTable.page >= pageCount} onClick={() => setPage(tenantTable.page + 1)}>{t("common.next")}<ChevronRight className="size-4 rtl:rotate-180" /></Button>
                </nav>
              </div>
            </div>
          )}
        </Section>
      </PageBody>
    </>
  );
}
