import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Download } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { Button } from "@/components/ui/button";
import { ChannelDistribution } from "@/features/dashboard/ChannelDistribution";
import { DeliveryTrendChart } from "@/features/dashboard/DeliveryTrendChart";
import { KpiStrip } from "@/features/dashboard/KpiStrip";
import { MessageTable } from "@/features/messages/MessageTable";
import { QuotaMeter } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead("Dashboard", "Operational overview of message volume, delivery outcomes, channel usage and quota for Dolf Connect."),
  loader: ({ context }) => context.queryClient.ensureQueryData(queries.dashboard()),
  component: Dashboard,
});

function Dashboard() {
  const { t, locale } = useI18n();
  const { user, isPlatform, can } = useSession();
  const { data } = useSuspenseQuery(queries.dashboard());
  const recent = useQuery(queries.messages({ page: 1, pageSize: 8 }));
  const activity = useQuery({ ...queries.audit({ page: 1, pageSize: 6 }), enabled: can("audit.view") });
  const providers = useQuery({ ...queries.providers(), enabled: isPlatform });

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        description={t("dash.subtitle", { scope: isPlatform ? t("header.allTenants") : (user.tenantName ?? "") })}
        actions={
          <>
            <span className="text-caption me-2">{t("common.last14")}</span>
            <Button variant="outline" size="sm"><Download className="size-4" />{t("common.export")}</Button>
          </>
        }
      />
      <PageBody>
        <KpiStrip kpis={data.kpis} />
        <div className="grid gap-4 xl:grid-cols-3">
          <Section title={t("dash.trend")} description={t("dash.trendHint")} className="xl:col-span-2">
            <DeliveryTrendChart data={data.trend} />
          </Section>
          <div className="flex flex-col gap-4">
            <Section title={t("dash.quota")}><QuotaMeter used={data.quota.used} limit={data.quota.limit} /></Section>
            <Section title={t("dash.distribution")}><ChannelDistribution channels={data.channels} /></Section>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Section
            title={t("dash.recentMessages")}
            className="xl:col-span-2"
            actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link to="/messages">{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}
          >
            <MessageTable rows={recent.data?.items} loading={recent.isLoading} compact />
          </Section>

          {isPlatform ? (
            <Section title={t("dash.platformHealth")} actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link to="/platform/health">{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}>
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
            </Section>
          ) : can("audit.view") ? (
            <Section title={t("dash.recentActivity")} actions={<Button asChild variant="ghost" size="sm" className="h-7 text-primary"><Link to="/audit">{t("dash.viewAll")}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link></Button>}>
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
            </Section>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
