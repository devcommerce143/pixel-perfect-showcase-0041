import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
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
import type { Channel, Provider, RoutingRule } from "@/lib/api/types";
import { formatNumber, formatPercent, formatTime } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/health")({
  head: () => pageHead("Provider Health", "Current health, latency and success rate of upstream communication providers."),
  component: () => <RequirePermission permission="platform.health"><Health /></RequirePermission>,
});

function Health() {
  const { t, locale, dir } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, refetch, isFetching } = useSuspenseQuery(queries.providers());
  const routingQuery = useQuery(queries.routing());
  const routingRules = routingQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<(typeof data)[number] | null>(null);
  const test = useMutation({
    mutationFn: (providerId: string) => api.testProviderConnection(providerId),
    onSuccess: async (result, providerId) => { toast.success(result.success ? t("health.testSuccess", { latency: result.latencyMs }) : t("health.testFailure")); await queryClient.invalidateQueries({ queryKey: ["providers"] }); const refreshed = await refetch(); setSelected(refreshed.data?.find((provider) => provider.id === providerId) ?? null); },
    onError: () => toast.error(t("health.testFailure")),
  });
  const visible = data.filter((provider) =>
    (channel === "all" || provider.channel === channel) &&
    (status === "all" || provider.status === status) &&
    (!search || `${provider.name} ${provider.dataRegion}`.toLowerCase().includes(search.toLowerCase())),
  );
  const impact = selected ? routingImpact(selected, data, routingRules) : null;
  return (
    <>
      <PageHeader title={t("health.title")} description={t("health.subtitle")} actions={<Button variant="outline" size="sm" disabled={isFetching} onClick={() => { void refetch().then(({ data: refreshed }) => { if (selected) setSelected(refreshed?.find((provider) => provider.id === selected.id) ?? null); }); void queryClient.invalidateQueries({ queryKey: ["routing"] }); }}><RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />{t("health.refresh")}</Button>} />
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
                    <dl className="grid grid-cols-2 gap-2 text-caption">
                      <div><dt>{t("prov.latency")}</dt><dd className="font-medium text-foreground tabular-nums">{p.latencyMs ? `${formatNumber(p.latencyMs, locale)} ms` : "—"}</dd></div>
                      <div><dt>{t("prov.success")}</dt><dd className="font-medium text-foreground tabular-nums">{p.successRate ? formatPercent(p.successRate, locale) : "—"}</dd></div>
                      <div><dt>{t("ten.region")}</dt><dd className="font-medium text-foreground">{t(`prov.region.${p.dataRegion}` as "prov.region.KSA-Central")}</dd></div>
                    </dl>
                    <p className="text-caption text-muted-foreground">{t(`health.reason.${p.health.reason}` as MessageKey)}</p>
                    <span className="text-caption">{t("health.checked", { time: formatTime(p.checkedAt, locale) })}</span>
                  </button></li>
                ))}
                {!visible.some((provider) => provider.channel === ch) && <li className="px-4 py-6 text-sm text-muted-foreground">{t("common.noResults")}</li>}
              </ul>
            </Section>
          ))}
        </div>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-md">{selected && impact && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader><div className="space-y-4 px-4 pb-5"><StatusBadge status={selected.status} /><p className="text-sm text-muted-foreground">{t(`health.reason.${selected.health.reason}` as MessageKey)}</p><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.region")}</dt><dd>{t(`prov.region.${selected.dataRegion}` as MessageKey)}</dd></div><div><dt className="text-label">{t("prov.latency")}</dt><dd>{formatNumber(selected.latencyMs, locale)} ms</dd></div><div><dt className="text-label">{t("prov.success")}</dt><dd>{formatPercent(selected.successRate, locale)}</dd></div><div><dt className="text-label">{t("health.requests24h")}</dt><dd>{formatNumber(selected.health.requests24h, locale)}</dd></div><div><dt className="text-label">{t("health.failures24h")}</dt><dd>{formatNumber(selected.health.failures24h, locale)}</dd></div><div><dt className="text-label">{t("health.failureRate")}</dt><dd>{selected.health.requests24h ? formatPercent(selected.health.failures24h / selected.health.requests24h * 100, locale) : "—"}</dd></div><div><dt className="text-label">{t("health.lastSuccessful")}</dt><dd>{selected.health.lastSuccessfulCheckAt ? formatTime(selected.health.lastSuccessfulCheckAt, locale) : "—"}</dd></div><div><dt className="text-label">{t("health.since")}</dt><dd>{selected.status !== "healthy" && selected.health.statusSince ? formatTime(selected.health.statusSince, locale) : "—"}</dd></div><div><dt className="text-label">{t("health.lastFailure")}</dt><dd>{selected.health.lastFailureAt ? formatTime(selected.health.lastFailureAt, locale) : "—"}</dd></div><div className="col-span-2"><dt className="text-label">{t("health.lastFailureReason")}</dt><dd>{selected.health.lastFailureReason ? t(`health.reason.${selected.health.lastFailureReason}` as MessageKey) : "—"}</dd></div></dl><p className="text-xs text-muted-foreground">{t("health.checked", { time: formatTime(selected.checkedAt, locale) })}</p>
        <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("health.routingImpact")}</h3><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("health.activeRules")}</dt><dd>{formatNumber(impact.rules.length, locale)}</dd></div><div><dt className="text-label">{t("health.routingRole")}</dt><dd>{[impact.isPrimary && t("health.primary"), impact.isFailover && t("health.failover")].filter(Boolean).join(" · ") || t("common.none")}</dd></div><div className="col-span-2"><dt className="text-label">{t("health.alternative")}</dt><dd>{impact.alternatives.length ? impact.alternatives.map(({ provider, available }) => `${provider.name} (${t(available ? "health.available" : "health.unavailable")})`).join(", ") : t("health.noAlternative")}</dd></div></dl><ul className="space-y-2 text-sm">{impact.handling.map(({ rule, state, alternative }) => <li key={rule.id} className={`rounded-md border px-3 py-2 ${["health.trafficNoFailover", "health.trafficUnprotected", "health.trafficDegraded", "health.trafficFailoverUnavailable"].includes(state) ? "border-warning/40 bg-warning-soft" : ""}`}><div className="text-xs text-muted-foreground">{rule.name}</div><p>{t(state, { provider: alternative ?? "" })}</p></li>)}</ul>{!impact.rules.length && <p className="text-sm text-muted-foreground">{t("health.noActiveRules")}</p>}</section>
        <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" disabled={test.isPending} onClick={() => test.mutate(selected.id)}><RefreshCw className="size-4" />{t("health.test")}</Button><Button variant="outline" onClick={() => void navigate({ to: "/platform/providers" as never, search: { providerId: selected.id } as never })}><ArrowUpRight className="size-4" />{t("health.viewProvider")}</Button></div></div></>}</SheetContent></Sheet>
    </>
  );
}

function routingImpact(provider: Provider, providers: Provider[], rules: RoutingRule[]) {
  const related = rules.filter((rule) => rule.status === "active" && (rule.primaryProvider === provider.name || rule.failoverProvider === provider.name));
  const isPrimary = related.some((rule) => rule.primaryProvider === provider.name);
  const isFailover = related.some((rule) => rule.failoverProvider === provider.name);
  const alternatives = related.flatMap((rule) => {
    const name = rule.primaryProvider === provider.name ? rule.failoverProvider : rule.primaryProvider;
    const alternative = name ? providers.find((item) => item.name === name) : undefined;
    return alternative ? [alternative] : [];
  }).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index).map((item) => ({ provider: item, available: item.enabled && item.status !== "unavailable" }));
  const handling = related.map((rule) => {
    const primary = rule.primaryProvider === provider.name;
    const alternativeName = primary ? rule.failoverProvider : rule.primaryProvider;
    const alternative = alternativeName ? providers.find((item) => item.name === alternativeName) : undefined;
    const alternativeAvailable = !!alternative && alternative.enabled && alternative.status !== "unavailable";
    let state: MessageKey;
    if (primary && (provider.status === "unavailable" || !provider.enabled)) state = alternativeAvailable ? "health.trafficProtected" : alternativeName ? "health.trafficFailoverUnavailable" : "health.trafficUnprotected";
    else if (primary && provider.status === "degraded") state = alternativeAvailable ? "health.trafficDegradedProtected" : alternativeName ? "health.trafficFailoverUnavailable" : "health.trafficDegraded";
    else if (primary) state = !alternativeName ? "health.trafficNoFailover" : alternativeAvailable ? "health.trafficPrimary" : "health.trafficFailoverUnavailable";
    else state = provider.status === "unavailable" || !provider.enabled ? "health.failoverUnavailable" : "health.failoverReady";
    return { rule, state, alternative: alternativeAvailable ? alternative?.name ?? null : null };
  });
  return { rules: related, isPrimary, isFailover, alternatives, handling };
}
