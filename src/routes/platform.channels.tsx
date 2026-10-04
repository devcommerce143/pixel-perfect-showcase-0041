import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { ChannelConfig } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/channels")({
  head: () => pageHead("Channels", "Platform channel configuration."),
  component: () => <RequirePermission permission="platform.channels"><Channels /></RequirePermission>,
});

function Channels() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const q = useQuery(queries.channels());
  const toggle = useMutation({
    mutationFn: (c: ChannelConfig) => api.setChannelEnabled(c.channel, !c.enabled),
    onSuccess: () => { toast.success(t("ch.toggled")); void qc.invalidateQueries({ queryKey: ["channels"] }); },
  });
  const n = (v: number) => <span className="tabular-nums">{formatNumber(v, locale)}</span>;
  const columns: Column<ChannelConfig>[] = [
    { id: "c", header: t("common.channel"), cell: (c) => <ChannelLabel channel={c.channel} /> },
    { id: "p", header: t("ch.providers"), cell: (c) => n(c.providers) },
    { id: "t", header: t("ch.tenants"), cell: (c) => n(c.tenants) },
    { id: "s", header: t("ch.senders"), cell: (c) => n(c.senderIds), className: "hidden md:table-cell" },
    { id: "v", header: t("ch.volume"), cell: (c) => n(c.volume30d) },
    { id: "e", header: t("common.enabled"), className: "text-end", cell: (c) => <Switch checked={c.enabled} disabled={toggle.isPending} onCheckedChange={() => toggle.mutate(c)} aria-label={t("common.enabled")} /> },
  ];
  return (
    <>
      <PageHeader title={t("ch.title")} description={t("ch.subtitle")} />
      <PageBody><Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(c) => c.channel} /></Section></PageBody>
    </>
  );
}
