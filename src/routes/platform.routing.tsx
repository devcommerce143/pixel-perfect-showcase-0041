import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { queries } from "@/lib/api/queries";
import type { RoutingRule } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/routing")({
  head: () => pageHead("Routing", "Provider routing and failover rules."),
  component: () => <RequirePermission permission="platform.routing"><Routing /></RequirePermission>,
});

function Routing() {
  const { t } = useI18n();
  const q = useQuery(queries.routing());
  const columns: Column<RoutingRule>[] = [
    { id: "p", header: t("prov.priority"), cell: (r) => <span className="tabular-nums font-medium">{r.priority}</span> },
    { id: "n", header: t("rt.rule"), cell: (r) => (<div><div className="font-medium">{r.name}</div><div className="font-mono text-xs text-muted-foreground">{r.id}</div></div>) },
    { id: "c", header: t("common.channel"), cell: (r) => <ChannelLabel channel={r.channel} /> },
    { id: "cond", header: t("rt.condition"), className: "hidden lg:table-cell", cell: (r) => <code dir="ltr" className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{r.condition}</code> },
    { id: "pr", header: t("rt.primary"), cell: (r) => r.primaryProvider },
    { id: "f", header: t("rt.failover"), cell: (r) => r.failoverProvider ?? "—" },
    { id: "rt", header: t("rt.retry"), className: "hidden xl:table-cell", cell: (r) => <span className="text-muted-foreground">{r.retry}</span> },
    { id: "s", header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <PageHeader title={t("rt.title")} description={t("rt.subtitle")} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem] text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />{t("prov.restricted")}
        </div>
        <Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(r) => r.id} /></Section>
      </PageBody>
    </>
  );
}
