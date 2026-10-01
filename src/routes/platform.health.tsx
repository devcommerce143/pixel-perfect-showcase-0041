import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { queries } from "@/lib/api/queries";
import type { Channel } from "@/lib/api/types";
import { formatNumber, formatPercent, formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/health")({
  head: () => pageHead("Provider Health", "Current health, latency and success rate of upstream communication providers."),
  component: () => <RequirePermission permission="platform.health"><Health /></RequirePermission>,
});

function Health() {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(queries.providers());
  return (
    <>
      <PageHeader title={t("health.title")} description={t("health.subtitle")} />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["sms", "whatsapp", "email"] as Channel[]).map((ch) => (
            <Section key={ch} title={t(`channel.${ch}`)}>
              <ul className="divide-y">
                {data.filter((p) => p.channel === ch).map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><ChannelLabel channel={p.channel} className="text-caption" /></div>
                      <StatusBadge status={p.status} />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-caption">
                      <div><dt>{t("prov.latency")}</dt><dd className="font-medium text-foreground tabular-nums">{p.latencyMs ? `${formatNumber(p.latencyMs, locale)} ms` : "—"}</dd></div>
                      <div><dt>{t("prov.success")}</dt><dd className="font-medium text-foreground tabular-nums">{p.successRate ? formatPercent(p.successRate, locale) : "—"}</dd></div>
                      <div><dt>{t("prov.type")}</dt><dd className="font-medium text-foreground">{p.type}</dd></div>
                    </dl>
                    <span className="text-caption">{t("health.checked", { time: formatTime(p.checkedAt, locale) })}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </div>
      </PageBody>
    </>
  );
}
