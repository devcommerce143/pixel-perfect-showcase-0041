import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { ChannelConfig } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useSession } from "@/lib/auth/session";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/channels")({
  head: () => pageHead("Channels", "Platform channel configuration."),
  component: () => <RequirePermission permission="platform.channels"><Channels /></RequirePermission>,
});

const CAPABILITIES = {
  sms: ["ch.capability.smsSegments", "ch.capability.smsSenderIds", "ch.capability.smsFailover"],
  whatsapp: ["ch.capability.whatsappApproval", "ch.capability.whatsappStatus", "ch.capability.whatsappFailover"],
  email: ["ch.capability.emailSubject", "ch.capability.emailEvents", "ch.capability.emailFailover"],
} as const;

function Channels() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery(queries.channels());
  const [selected, setSelected] = useState<ChannelConfig | null>(null);
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
    { id: "e", header: t("common.enabled"), className: "text-end", cell: (c) => <Switch checked={c.enabled} disabled={!can("platform.channels.manage") || toggle.isPending} onClick={(event) => event.stopPropagation()} onCheckedChange={() => toggle.mutate(c)} aria-label={t("common.enabled")} /> },
  ];
  return (
    <>
      <PageHeader title={t("ch.title")} description={t("ch.subtitle")} />
      <PageBody><Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(c) => c.channel} onRowClick={setSelected} /></Section></PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{t(`channel.${selected.channel}`)}</SheetTitle><SheetDescription>{t("ch.capabilitiesDescription")}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><div className="flex items-center gap-2">{t("common.status")}<span>{t(selected.enabled ? "ch.enabled" : "ch.disabled")}</span></div><dl className="grid grid-cols-2 gap-3 text-sm">{[["ch.providers", selected.providers], ["ch.tenants", selected.tenants], ["ch.senders", selected.senderIds], ["ch.volume", selected.volume30d]].map(([key, count]) => <div key={String(key)}><dt className="text-label">{t(key as "ch.providers")}</dt><dd>{formatNumber(count as number, locale)}</dd></div>)}</dl><div><h3 className="mb-2 text-sm font-semibold">{t("ch.capabilities")}</h3><ul className="list-disc space-y-1 ps-5 text-sm">{CAPABILITIES[selected.channel].map((key) => <li key={key}>{t(key)}</li>)}</ul></div></div></>}</SheetContent></Sheet>
    </>
  );
}
