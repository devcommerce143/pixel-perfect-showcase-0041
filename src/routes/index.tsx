import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  DashboardRecordedHealth,
  DashboardRecentAudit,
} from "@/features/dashboard/RecordedOperations";
import { DashboardCsvButton } from "@/features/dashboard/DashboardCsvButton";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { Button } from "@/components/ui/button";
import { ChannelDistribution } from "@/features/dashboard/ChannelDistribution";
import { DeliveryTrendChart } from "@/features/dashboard/DeliveryTrendChart";
import { KpiStrip } from "@/features/dashboard/KpiStrip";
import { LiveQuotaWarnings } from "@/features/dashboard/QuotaWarnings";
import { LiveRecentMessages } from "@/features/dashboard/RecentMessagesTable";
import { MessageTable } from "@/features/messages/MessageTable";
import { QuotaMeter } from "@/features/usage/QuotaMeter";
import { isLiveDashboardUnavailable } from "@/lib/api/dashboard-availability";
import { dashboardQuotaSource } from "@/lib/api/dashboard-quota";
import { recentDashboardMessagesSource } from "@/lib/api/dashboard-recent";
import { queries } from "@/lib/api/queries";
import { apiMode } from "@/lib/api/client";
import type { DashboardSummary, Message, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";

function deriveScopedDashboardSummary(base: DashboardSummary, tenantMessages: Message[], tenantUsage?: { tenantId: string; tenantName: string; channels: { channel: "sms" | "whatsapp" | "email"; used: number; limit: number }[] } | undefined): DashboardSummary {
  if (!tenantMessages.length) {
    return {
      ...base,
      kpis: { total: 0, delivered: 0, pending: 0, failed: 0, deliveryRate: 0, totalDeltaPct: 0 },
      trend: [],
      channels: [],
      quota: {
        used: tenantUsage ? tenantUsage.channels.reduce((sum, channel) => sum + channel.used, 0) : 0,
        limit: tenantUsage ? tenantUsage.channels.reduce((sum, channel) => sum + channel.limit, 0) : 0,
      },
    };
  }

  const totals = tenantMessages.reduce((acc, message) => {
    if (message.status === "delivered" || message.status === "read") acc.delivered += 1;
    else if (message.status === "failed" || message.status === "rejected" || message.status === "expired" || message.status === "cancelled") acc.failed += 1;
    else acc.pending += 1;

    acc.channels[message.channel] = (acc.channels[message.channel] ?? 0) + 1;
    return acc;
  }, { delivered: 0, failed: 0, pending: 0, channels: { sms: 0, whatsapp: 0, email: 0 } as Record<"sms" | "whatsapp" | "email", number> });

  const trackedDays = new Map<string, { delivered: number; failed: number; pending: number }>();
  for (const message of tenantMessages) {
    const day = message.createdAt.slice(0, 10);
    const entry = trackedDays.get(day) ?? { delivered: 0, failed: 0, pending: 0 };
    if (message.status === "delivered" || message.status === "read") entry.delivered += 1;
    else if (message.status === "failed" || message.status === "rejected" || message.status === "expired" || message.status === "cancelled") entry.failed += 1;
    else entry.pending += 1;
    trackedDays.set(day, entry);
  }
  const orderedDates = [...trackedDays.keys()].sort();
  const trend = orderedDates.slice(-14).map((date) => ({
    date,
    delivered: trackedDays.get(date)?.delivered ?? 0,
    failed: trackedDays.get(date)?.failed ?? 0,
    pending: trackedDays.get(date)?.pending ?? 0,
  }));

  const channelEntries = (Object.keys(totals.channels) as Array<"sms" | "whatsapp" | "email">).map((channel) => ({ channel, count: totals.channels[channel] }));
  const total = totals.delivered + totals.failed + totals.pending;
  const quotaUsed = tenantUsage ? tenantUsage.channels.reduce((sum, channel) => sum + channel.used, 0) : 0;
  const quotaLimit = tenantUsage ? tenantUsage.channels.reduce((sum, channel) => sum + channel.limit, 0) : 0;

  return {
    ...base,
    kpis: {
      total,
      delivered: totals.delivered,
      failed: totals.failed,
      pending: totals.pending,
      deliveryRate: total ? (totals.delivered / total) * 100 : 0,
      totalDeltaPct: base.kpis.totalDeltaPct,
    },
    trend,
    channels: channelEntries.filter((entry) => entry.count > 0),
    quota: { used: quotaUsed, limit: quotaLimit },
  };
}

export const Route = createFileRoute("/")({
  head: () => pageHead("Dashboard", "Operational overview of message volume, delivery outcomes, channel usage and quota for Dolf Connect."),
  loader: async ({ context }) => {
    // Live tokens are client-owned. AuthBoundary mounts the dashboard after profile restoration.
    if (apiMode === "live") return;
    try {
      await context.queryClient.ensureQueryData(queries.dashboard());
    } catch (error) {
      if (!isLiveDashboardUnavailable(error)) throw error;
    }
  },
  component: Dashboard,
});

function Dashboard() {
  const { t, locale } = useI18n();
  const { user, isPlatform, can, mode } = useSession();
  const live = mode === "live";
  const liveMessages = recentDashboardMessagesSource(mode) === "live-endpoint";
  const liveQuota = dashboardQuotaSource(mode) === "live-endpoint";
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const dashboardQuery = useQuery(queries.dashboard());
  const data = dashboardQuery.data;
  const dashboardReady = !!data;
  const scopeMessageQuery = useQuery({
    ...queries.messages({ page: 1, pageSize: 500, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) }, actor),
    enabled: !live && dashboardReady && isPlatform && !!selectedTenantId,
  });
  const recent = useQuery({ ...queries.messages({ page: 1, pageSize: 8, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) }, actor), enabled: !liveMessages && dashboardReady });
  const liveRecent = useQuery({ ...queries.dashboardMessages(), enabled: liveMessages && dashboardReady });
  const activity = useQuery({ ...queries.audit({ page: 1, pageSize: 6 }, actor), enabled: !live && dashboardReady && can("audit.view") });
  const providers = useQuery({ ...queries.providers(), enabled: !live && dashboardReady && isPlatform });
  const usage = useQuery({ ...queries.usage(actor, scopedTenantId), enabled: !live && dashboardReady && (isPlatform || !!scopedTenantId) });
  const quotaWarnings = useQuery({ ...queries.dashboardQuota(), enabled: liveQuota && dashboardReady });

  const dashboardData = useMemo(() => {
    if (!data) return null;
    if (live || !isPlatform || !selectedTenantId) return data;
    const scopedTenant = usage.data?.tenants.find((tenant) => tenant.tenantId === selectedTenantId);
    return deriveScopedDashboardSummary(data, scopeMessageQuery.data?.items ?? [], scopedTenant);
  }, [data, isPlatform, live, scopeMessageQuery.data?.items, selectedTenantId, usage.data?.tenants]);

  const summaryScope = live
    ? (data?.scope === "tenant" ? (user?.tenantName ?? "") : t("header.allTenants"))
    : isPlatform
      ? (selectedTenantId ? usage.data?.tenants.find((tenant) => tenant.tenantId === selectedTenantId)?.tenantName ?? selectedTenantId : t("header.allTenants"))
      : (user?.tenantName ?? "");

  if (isLiveDashboardUnavailable(dashboardQuery.error)) {
    return (
      <>
        <PageHeader title={t("dash.title")} description={t("dash.unavailableBody")} />
        <PageBody>
          <div className="panel">
            <EmptyState title={t("dash.unavailableTitle")} body={t("dash.unavailableBody")} />
          </div>
        </PageBody>
      </>
    );
  }
  if (dashboardQuery.error) throw dashboardQuery.error;
  if (!data || !dashboardData) {
    return (
      <>
        <PageHeader title={t("dash.title")} description={t("dash.subtitle", { scope: summaryScope })} />
        <PageBody>
          <div className="h-28 animate-pulse rounded-md bg-muted" role="status" />
        </PageBody>
      </>
    );
  }

  const quotaTenants = usage.data?.tenants ?? [];
  const tenantsAt80 = quotaTenants.filter((tenant) => tenant.status !== "normal").length;
  const tenantsAt90 = quotaTenants.filter((tenant) => tenant.status === "warning" || tenant.status === "at_limit").length;
  const tenantsAt100 = quotaTenants.filter((tenant) => tenant.status === "at_limit").length;
  const usageLink = { to: "/usage" as const, search: { tenantId: scopedTenantId } };

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        description={t("dash.subtitle", { scope: summaryScope })}
        actions={
          <>
            <span className="text-caption me-2">{t("common.last14")}</span>
            <DashboardCsvButton
              summary={dashboardData}
              tenantId={user?.tenantId ?? undefined}
              disabled={dashboardQuery.isFetching}
            />
          </>
        }
      />
      <PageBody>
        <KpiStrip kpis={dashboardData.kpis} />
        <div className="grid gap-4 xl:grid-cols-3">
          <Section title={t("dash.trend")} description={t("dash.trendHint")} className="xl:col-span-2">
            <DeliveryTrendChart data={dashboardData.trend} />
          </Section>
          <div className="flex flex-col gap-4">
            <Section title={(liveQuota ? isPlatform : isPlatform && !selectedTenantId) ? t("dash.quotaStatus") : t("dash.quota")} actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link {...usageLink}>{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}>
              {liveQuota ? (
                <LiveQuotaWarnings data={quotaWarnings.data} isError={quotaWarnings.isError} onRetry={() => void quotaWarnings.refetch()} />
              ) : isPlatform && !selectedTenantId ? (
                usage.isLoading ? <div className="m-4 h-20 animate-pulse bg-muted" /> : usage.isError ? <p role="alert" className="p-4 text-sm text-danger">{t("usage.loadError")}</p> : (
                  <dl className="grid grid-cols-3 divide-x rtl:divide-x-reverse">
                    {[["usage.at80", tenantsAt80], ["usage.at90", tenantsAt90], ["usage.at100", tenantsAt100]].map(([key, count]) => (
                      <div key={key as string} className="px-3 py-4 text-center">
                        <dt className="text-caption">{t(key as never)}</dt>
                        <dd className="mt-1 text-kpi tabular-nums">{count}</dd>
                        <dd className="text-caption">{t("usage.tenants")}</dd>
                      </div>
                    ))}
                  </dl>
                )
              ) : usage.isLoading ? <div className="m-4 h-28 animate-pulse bg-muted" /> : usage.isError ? <p role="alert" className="p-4 text-sm text-danger">{t("usage.loadError")}</p> : dashboardData.quota ? (
                <QuotaMeter used={dashboardData.quota.used} limit={dashboardData.quota.limit} />
              ) : <EmptyState title={t("dash.quotaUnavailableTitle")} body={t("dash.quotaUnavailableBody")} />}
            </Section>
            <Section title={t("dash.distribution")}><ChannelDistribution channels={dashboardData.channels} /></Section>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Section
            title={t("dash.recentMessages")}
            className="xl:col-span-2"
            actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link to="/messages">{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}
          >
            {liveMessages ? <LiveRecentMessages data={liveRecent.data} isError={liveRecent.isError} onRetry={() => void liveRecent.refetch()} /> : <MessageTable rows={recent.data?.items} loading={recent.isLoading} compact showTenant={isPlatform && !selectedTenantId} />}
          </Section>

          {isPlatform ? (
            <Section title={t("dash.platformHealth")} actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link to="/platform/health">{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}>
              {live ? (
                <DashboardRecordedHealth actor={actor} />
              ) : (
              <ul className="divide-y">
                {providers.data?.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-table">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <ChannelLabel channel={p.channel} className="text-caption" />
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
              )}
            </Section>
          ) : can("audit.view") ? (
            <Section title={t("dash.recentActivity")} actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link to="/audit">{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}>
              {live ? (
                <DashboardRecentAudit actor={actor} />
              ) : (
              <ul className="divide-y">
                {activity.data?.items.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{a.action}</div>
                      <div className="truncate text-caption">{a.actor} · {a.resource}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={a.result} />
                      <span className="text-caption tabular-nums">{formatDateTime(a.at, locale)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </Section>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
