import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { queries } from "@/lib/api/queries";
import type { Provider } from "@/lib/api/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/providers")({
  head: () => pageHead("Gateways & Providers", "Upstream SMS, WhatsApp and Email providers configured on the Dolf Connect platform."),
  component: () => <RequirePermission permission="platform.providers"><Providers /></RequirePermission>,
});

function Providers() {
  const { t, locale } = useI18n();
  const { data } = useSuspenseQuery(queries.providers());
  const columns: Column<Provider>[] = [
    { id: "name", header: t("common.name"), cell: (p) => (<div><div className="font-medium">{p.name}</div><div className="font-mono text-xs text-muted-foreground">{p.id}</div></div>) },
    { id: "channel", header: t("common.channel"), cell: (p) => <ChannelLabel channel={p.channel} /> },
    { id: "type", header: t("prov.type"), cell: (p) => p.type },
    { id: "prio", header: t("prov.priority"), cell: (p) => <span className="tabular-nums">{p.priority}</span> },
    { id: "status", header: t("common.status"), cell: (p) => <StatusBadge status={p.status} /> },
    { id: "lat", header: t("prov.latency"), cell: (p) => <span className="tabular-nums">{p.latencyMs ? `${formatNumber(p.latencyMs, locale)} ms` : "—"}</span> },
    { id: "succ", header: t("prov.success"), cell: (p) => <span className="tabular-nums">{p.successRate ? formatPercent(p.successRate, locale) : "—"}</span> },
  ];
  return (
    <>
      <PageHeader title={t("prov.title")} description={t("prov.subtitle")} />
      <PageBody>
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem] text-warning">
          <Lock className="size-4 shrink-0" />{t("prov.restricted")}
        </div>
        <Section><DataTable columns={columns} rows={data} rowKey={(p) => p.id} /></Section>
      </PageBody>
    </>
  );
}
