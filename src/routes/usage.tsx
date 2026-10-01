import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { QuotaBar, QuotaMeter } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/usage")({
  head: () => pageHead("Usage & Subscription", "Message consumption against plan entitlements per channel for the current billing period."),
  loader: ({ context }) => context.queryClient.ensureQueryData(queries.usage()),
  component: () => <RequirePermission permission="usage.view"><Usage /></RequirePermission>,
});

function Usage() {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(queries.usage());
  const used = data.channels.reduce((a, c) => a + c.used, 0);
  const limit = data.channels.reduce((a, c) => a + c.limit, 0);
  return (
    <>
      <PageHeader title={t("usage.title")} description={t("usage.subtitle")} />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title={t("dash.quota")}><QuotaMeter used={used} limit={limit} /></Section>
          <Section title={t("usage.plan")} className="lg:col-span-2">
            <dl className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse">
              <div className="px-4 py-4"><dt className="text-label">{t("usage.plan")}</dt><dd className="mt-1 text-section-title">{data.plan}</dd></div>
              <div className="px-4 py-4"><dt className="text-label">{t("usage.period")}</dt><dd className="mt-1 text-body">{formatDate(data.periodStart, locale)} – {formatDate(data.periodEnd, locale)}</dd></div>
              <div className="px-4 py-4"><dt className="text-label">{t("usage.renewal")}</dt><dd className="mt-1 text-body">{formatDate(data.periodEnd, locale)}</dd></div>
            </dl>
            <p className="flex items-center gap-1.5 border-t bg-surface-subtle px-4 py-2.5 text-caption"><Info className="size-3.5" />{t("usage.contact")}</p>
          </Section>
        </div>
        <Section title={t("usage.byChannel")}>
          <ul className="divide-y">
            {data.channels.map((c) => {
              const pct = (c.used / c.limit) * 100;
              return (
                <li key={c.channel} className="grid items-center gap-3 px-4 py-3.5 md:grid-cols-[10rem_1fr_14rem]">
                  <ChannelLabel channel={c.channel} className="font-medium" />
                  <QuotaBar pct={pct} />
                  <div className="flex justify-between gap-3 text-table tabular-nums md:justify-end">
                    <span>{formatNumber(c.used, locale)} / {formatNumber(c.limit, locale)}</span>
                    <span className="w-14 text-end font-medium">{formatPercent(pct, locale)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      </PageBody>
    </>
  );
}
