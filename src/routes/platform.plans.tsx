import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { TableSkeleton } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { queries } from "@/lib/api/queries";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/plans")({
  head: () => pageHead("Subscriptions & Plans", "Plan catalogue and tenant subscriptions."),
  component: () => <RequirePermission permission="platform.plans"><Plans /></RequirePermission>,
});

function Plans() {
  const { t, locale } = useI18n();
  const q = useQuery(queries.plans());
  return (
    <>
      <PageHeader title={t("plans.title")} description={t("plans.subtitle")} actions={<Button size="sm"><Plus className="size-4" />{t("plans.new")}</Button>} />
      <PageBody>
        {!q.data ? <TableSkeleton /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {q.data.map((p) => (
              <Section key={p.id} title={p.name} description={t("plans.tenants", { count: p.tenants })} actions={<StatusBadge status={p.status} />}>
                <div className="space-y-3 p-4">
                  <div className="text-label">{t("plans.monthly")}</div>
                  <ul className="space-y-1.5">{p.entitlements.map((e) => (
                    <li key={e.channel} className="flex items-center justify-between text-sm"><ChannelLabel channel={e.channel} /><span className="tabular-nums font-medium">{formatNumber(e.monthly, locale)}</span></li>))}</ul>
                  <ul className="space-y-1 border-t pt-3">{p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><Check className="size-3.5 text-success" />{f}</li>))}</ul>
                </div>
              </Section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
