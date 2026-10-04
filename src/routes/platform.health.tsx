import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
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
  const { t, locale, dir } = useI18n();
  const queryClient = useQueryClient();
  const { data, refetch, isFetching } = useSuspenseQuery(queries.providers());
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null);
  const test = useMutation({
    mutationFn: (providerId: string) => api.testProviderConnection(providerId),
    onSuccess: async (result) => { toast.success(result.success ? t("health.testSuccess", { latency: result.latencyMs }) : t("health.testFailure")); await queryClient.invalidateQueries({ queryKey: ["providers"] }); await refetch(); },
    onError: () => toast.error(t("health.testFailure")),
  });
  const visible = data.filter((provider) =>
    (channel === "all" || provider.channel === channel) &&
    (status === "all" || provider.status === status) &&
    (!search || `${provider.name} ${provider.region}`.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <>
      <PageHeader title={t("health.title")} description={t("health.subtitle")} actions={<Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />{t("health.refresh")}</Button>} />
      <PageBody>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("health.search")} aria-label={t("health.search")} className="h-8 sm:max-w-xs" /><FilterSelect label={t("common.channel")} value={channel} onChange={setChannel} options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((item) => ({ value: item, label: t(`channel.${item}`) }))]} /><FilterSelect label={t("common.status")} value={status} onChange={setStatus} options={[{ value: "all", label: t("common.allStatuses") }, ...(["healthy", "degraded", "unavailable"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} /></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["sms", "whatsapp", "email"] as Channel[]).map((ch) => (
            <Section key={ch} title={t(`channel.${ch}`)}>
              <ul className="divide-y">
                {visible.filter((p) => p.channel === ch).map((p) => (
                  <li key={p.id}><button type="button" className="flex w-full flex-col gap-2 px-4 py-3 text-start transition-colors hover:bg-accent/50" onClick={() => setSelected(p)}>
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
                  </button></li>
                ))}
                {!visible.some((provider) => provider.channel === ch) && <li className="px-4 py-6 text-sm text-muted-foreground">{t("common.noResults")}</li>}
              </ul>
            </Section>
          ))}
        </div>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><StatusBadge status={selected.status} /><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.region")}</dt><dd>{selected.region}</dd></div><div><dt className="text-label">{t("prov.type")}</dt><dd>{selected.type}</dd></div><div><dt className="text-label">{t("prov.priority")}</dt><dd>{selected.priority}</dd></div><div><dt className="text-label">{t("prov.latency")}</dt><dd>{selected.latencyMs} ms</dd></div><div><dt className="text-label">{t("prov.success")}</dt><dd>{formatPercent(selected.successRate, locale)}</dd></div></dl><p className="text-xs text-muted-foreground">{t("health.checked", { time: formatTime(selected.checkedAt, locale) })}</p><Button variant="outline" disabled={test.isPending} onClick={() => test.mutate(selected.id)}><RefreshCw className="size-4" />{t("health.test")}</Button></div></>}</SheetContent></Sheet>
    </>
  );
}
