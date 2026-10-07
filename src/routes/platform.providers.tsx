import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Lock, Plus, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import { createAdapterConfigInput, createBlankAdapterValues, getProviderAdapter, getProviderAdapters, type ProviderAdapterValues } from "@/lib/api/provider-catalog";
import type { Channel, Provider, ProviderAdapterId, ProviderConfigInput, ProviderTestOutcome, ProviderUsageBilling, ProviderUsageMetric, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDate, formatNumber, formatPercent, formatTime } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/providers")({
  head: () => pageHead("Gateways & Providers", "Upstream SMS, WhatsApp and Email providers configured on the Dolf Connect platform."),
  validateSearch: (search: Record<string, unknown>) => ({ providerId: typeof search["providerId"] === "string" ? search["providerId"] : undefined }),
  component: () => <RequirePermission permission="platform.providers"><Providers /></RequirePermission>,
});

const DATA_REGIONS = ["ksaCentral", "ksaWest", "middleEast", "europe", "global"] as const;

function Providers() {
  const { t, locale, dir } = useI18n();
  const { can, user } = useSession();
  const { providerId } = Route.useSearch();
  const queryClient = useQueryClient();
  const { data } = useQuery(queries.providers());
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const [selected, setSelected] = useState<Provider | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<"detail" | "form" | null>(null);
  const [enabledTarget, setEnabledTarget] = useState<{ provider: Provider; enabled: boolean } | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [adapterId, setAdapterId] = useState<ProviderAdapterId>("taqnyat");
  const [environment, setEnvironment] = useState<Provider["environment"]>("production");
  const [dataRegion, setDataRegion] = useState("KSA-Central");
  const [adapterValues, setAdapterValues] = useState<ProviderAdapterValues>(() => createBlankAdapterValues("taqnyat"));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const providerUsage = useQuery(queries.providerUsageBilling(actor, selected?.id));
  useEffect(() => {
    const provider = data?.find((item) => item.id === providerId);
    if (provider) {
      setSelected(provider);
      setActiveSheet("detail");
    }
  }, [data, providerId]);
  const editingProvider = data?.find((provider) => provider.id === editingId);
  const channelAdapters = getProviderAdapters(channel);
  const selectedAdapter = channelAdapters.find((candidate) => candidate.id === adapterId) ?? channelAdapters[0];
  const activeAdapterId = selectedAdapter?.id ?? adapterId;
  const adapter = getProviderAdapter(activeAdapterId);
  const sameAdapterEdit = !!editingProvider && editingProvider.adapterId === activeAdapterId;
  const adapterValuesValid = adapter?.fields.every((field) => {
    const value = adapterValues[field.key];
    if (!field.required || (field.secret && sameAdapterEdit && editingProvider.secretConfigured && !String(value ?? "").trim())) return true;
    return typeof value === "boolean" || String(value ?? "").trim().length > 0;
  }) ?? false;
  const save = useMutation({
    mutationFn: () => {
      const config: ProviderConfigInput = { name: name.trim(), channel, environment, dataRegion, adapterConfig: createAdapterConfigInput(activeAdapterId, adapterValues) };
      return editingId ? api.updateProvider(editingId, config) : api.createProvider(config);
    },
    onSuccess: async (provider) => {
      toast.success(t(editingId ? "prov.saved" : "prov.created"));
      await queryClient.invalidateQueries({ queryKey: ["providers"] });
      setSelected(provider);
      setActiveSheet("detail");
      setAdapterValues(createBlankAdapterValues(provider.adapterId));
    },
    onError: () => setError(t("prov.saveError")),
  });
  const test = useMutation({
    mutationFn: (provider: Provider) => api.testProviderConnection(provider.id),
    onSuccess: async (result, provider) => {
      const testMessage: Record<ProviderTestOutcome, MessageKey> = {
        success: "prov.testSuccess",
        authentication_failed: "prov.testAuthenticationFailed",
        timeout: "prov.testTimeout",
        provider_unavailable: "prov.testUnavailable",
      };
      (result.success ? toast.success : toast.error)(t(testMessage[result.outcome], { latency: result.latencyMs }));
      await queryClient.invalidateQueries({ queryKey: ["providers"] });
      setSelected({ ...provider, status: result.success ? "healthy" : result.outcome === "timeout" ? "degraded" : "unavailable", latencyMs: result.latencyMs, successRate: result.success ? 99.5 : result.outcome === "timeout" ? provider.successRate : 0, checkedAt: result.testedAt, lastConnectionTest: result });
    },
    onError: () => toast.error(t("prov.testFailure")),
  });
  const setEnabled = useMutation({
    mutationFn: ({ provider, enabled }: { provider: Provider; enabled: boolean }) => api.setProviderEnabled(provider.id, enabled),
    onSuccess: async (_, variables) => { toast.success(t(variables.enabled ? "prov.enabled" : "prov.disabled")); await queryClient.invalidateQueries({ queryKey: ["providers"] }); setEnabledTarget(null); setSelected({ ...variables.provider, enabled: variables.enabled }); setActiveSheet("detail"); },
  });
  const valid = name.trim().length > 1 && dataRegion.length > 0 && adapterValuesValid;
  const resetAdapter = (nextAdapterId: ProviderAdapterId) => { setAdapterId(nextAdapterId); setAdapterValues(createBlankAdapterValues(nextAdapterId)); };
  const openCreate = () => { setSelected(null); setEditingId(null); setName(""); setChannel("sms"); setAdapterId("taqnyat"); setEnvironment("production"); setDataRegion("ksaCentral"); setAdapterValues(createBlankAdapterValues("taqnyat")); setTouched(false); setError(""); setActiveSheet("form"); };
  const openEdit = (provider: Provider) => { setSelected(null); setEditingId(provider.id); setName(provider.name); setChannel(provider.channel); setAdapterId(provider.adapterId); setEnvironment(provider.environment); setDataRegion(provider.dataRegion); setAdapterValues({ ...createBlankAdapterValues(provider.adapterId), ...provider.adapterConfig.values }); setTouched(false); setError(""); setActiveSheet("form"); };
  const channelChanged = (nextChannel: Channel) => {
    setChannel(nextChannel);
    const firstAdapter = getProviderAdapters(nextChannel)[0];
    if (firstAdapter) resetAdapter(firstAdapter.id);
  };
  const columns: Column<Provider>[] = [
    { id: "name", header: t("common.name"), cell: (p) => (<div><div className="font-medium">{p.name}</div><div className="font-mono text-xs text-muted-foreground">{p.id}</div></div>) },
    { id: "channel", header: t("common.channel"), cell: (p) => <ChannelLabel channel={p.channel} /> },
    { id: "provider", header: t("prov.provider"), cell: (p) => getProviderAdapter(p.adapterId)?.name ?? p.adapterId },
    { id: "environment", header: t("common.environment"), cell: (p) => t(p.environment === "production" ? "common.production" : "common.sandbox") },
    { id: "region", header: t("ten.region"), cell: (p) => t(`prov.region.${p.dataRegion}` as MessageKey) },
    { id: "status", header: t("common.status"), cell: (p) => <StatusBadge status={p.status} /> },
    { id: "enabled", header: t("common.enabled"), cell: (p) => <StatusBadge status={p.enabled ? "active" : "disabled"} /> },
    { id: "lat", header: t("prov.latency"), cell: (p) => <span className="tabular-nums">{p.latencyMs ? `${formatNumber(p.latencyMs, locale)} ms` : "—"}</span> },
    { id: "succ", header: t("prov.success"), cell: (p) => <span className="tabular-nums">{p.successRate ? formatPercent(p.successRate, locale) : "—"}</span> },
  ];
  return (
    <>
      <PageHeader title={t("prov.title")} description={t("prov.subtitle")} actions={can("platform.providers.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("prov.add")}</Button>} />
      <PageBody>
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem] text-warning">
          <Lock className="size-4 shrink-0" />{t("prov.restricted")}
        </div>
        <Section><DataTable columns={columns} rows={data} loading={!data} rowKey={(p) => p.id} onRowClick={(provider) => { setSelected(provider); setActiveSheet("detail"); }} /></Section>
      </PageBody>
      <Sheet open={activeSheet !== null} onOpenChange={(value) => { if (!value && !save.isPending) { setActiveSheet(null); setSelected(null); } }}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className={`w-full overflow-y-auto ${activeSheet === "form" ? "sm:max-w-xl" : "sm:max-w-2xl"}`}>
          {activeSheet === "detail" && selected && <>
            <SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {getProviderAdapter(selected.adapterId)?.name} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              <Tabs defaultValue="overview" dir={dir} className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-3">
                  <TabsTrigger value="overview" className="px-2">{t("prov.tab.overview")}</TabsTrigger>
                  <TabsTrigger value="configuration" className="px-2">{t("prov.tab.configuration")}</TabsTrigger>
                  <TabsTrigger value="usage" className="px-2">{t("prov.usage.title")}</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={selected.enabled ? "active" : "disabled"} /></div>
                  <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-label">{t("prov.provider")}</dt><dd>{getProviderAdapter(selected.adapterId)?.name}</dd></div>
                    <div><dt className="text-label">{t("common.channel")}</dt><dd>{t(`channel.${selected.channel}`)}</dd></div>
                    <div><dt className="text-label">{t("common.environment")}</dt><dd>{t(selected.environment === "production" ? "common.production" : "common.sandbox")}</dd></div>
                    <div><dt className="text-label">{t("ten.region")}</dt><dd>{t(`prov.region.${selected.dataRegion}` as MessageKey)}</dd></div>
                    <div><dt className="text-label">{t("prov.credentialsConfigured")}</dt><dd>{t(selected.secretConfigured ? "prov.credentialsYes" : "prov.credentialsNo")}</dd></div>
                  </dl>
                </TabsContent>
                <TabsContent value="configuration" className="mt-4">
                  <dl className="grid grid-cols-1 divide-y text-sm sm:grid-cols-2 sm:divide-y-0 sm:gap-x-6">
                    {Object.entries(selected.adapterConfig.values).filter(([key]) => {
                      const field = getProviderAdapter(selected.adapterId)?.fields.find((candidate) => candidate.key === key);
                      return !!field && !field.secret;
                    }).map(([key, value]) => {
                      const field = getProviderAdapter(selected.adapterId)?.fields.find((candidate) => candidate.key === key);
                      return <div key={key} className="min-w-0 py-3"><dt className="text-label">{field ? t(field.label) : key}</dt><dd className="mt-1 break-all text-body">{String(value)}</dd></div>;
                    })}
                    <div className="py-3"><dt className="text-label">{t("prov.credentialsConfigured")}</dt><dd className="mt-1 text-body">{t(selected.secretConfigured ? "prov.credentialsYes" : "prov.credentialsNo")}</dd></div>
                  </dl>
                  <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t("prov.configurationSecretsOmitted")}</p>
                </TabsContent>
                <TabsContent value="usage" className="mt-4">
                  <ProviderUsageBillingPanel provider={selected} data={providerUsage.data ?? null} loading={providerUsage.isPending} error={providerUsage.isError} />
                </TabsContent>
              </Tabs>
              {can("platform.providers.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button><Button variant="outline" disabled={test.isPending} onClick={() => test.mutate(selected)}><PlugZap className="size-4" />{t("prov.test")}</Button><Button variant={selected.enabled ? "destructive" : "outline"} onClick={() => setEnabledTarget({ provider: selected, enabled: !selected.enabled })}>{t(selected.enabled ? "prov.disable" : "prov.enable")}</Button></div>}
            </div>
          </>}
          {activeSheet === "form" && <>
          <SheetHeader><SheetTitle>{t(editingId ? "prov.edit" : "prov.add")}</SheetTitle><SheetDescription>{t("prov.formDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid) save.mutate(); }} noValidate>
            <div className="space-y-1.5"><Label htmlFor="provider-name">{t("common.name")} *</Label><Input id="provider-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={touched && name.trim().length <= 1} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={channel} onValueChange={(value) => channelChanged(value as Channel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("prov.provider")}</Label><Select value={activeAdapterId} onValueChange={(value) => resetAdapter(value as ProviderAdapterId)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{channelAdapters.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>{t("common.environment")}</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as Provider["environment"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="production">{t("common.production")}</SelectItem><SelectItem value="sandbox">{t("common.sandbox")}</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("ten.region")}</Label><Select value={dataRegion} onValueChange={setDataRegion}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DATA_REGIONS.map((regionKey) => <SelectItem key={regionKey} value={regionKey}>{t(`prov.region.${regionKey}` as MessageKey)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <section className="space-y-3 border-t pt-4">
              <div><h3 className="text-sm font-semibold">{t("prov.adapterConfiguration")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("prov.adapterConfigurationHint")}</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {adapter?.fields.map((field) => {
                  const value = adapterValues[field.key];
                  const fieldId = `provider-config-${field.key}`;
                  const editingSecret = field.secret && sameAdapterEdit && editingProvider.secretConfigured;
                  return <div key={field.key} className="space-y-1.5">
                    {field.kind === "toggle" ? <label htmlFor={fieldId} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><Checkbox id={fieldId} checked={value === true} onCheckedChange={(checked) => setAdapterValues((current) => ({ ...current, [field.key]: checked === true }))} disabled={save.isPending} />{t(field.label)}</label> : <>
                      <Label htmlFor={fieldId}>{t(field.label)}{field.required ? " *" : ""}</Label>
                      {field.kind === "select" ? <Select value={String(value ?? "")} onValueChange={(nextValue) => setAdapterValues((current) => ({ ...current, [field.key]: nextValue }))}><SelectTrigger id={fieldId}><SelectValue /></SelectTrigger><SelectContent>{field.options?.map((option) => <SelectItem key={option.value} value={option.value}>{t(option.label)}</SelectItem>)}</SelectContent></Select> : <Input id={fieldId} type={field.kind === "url" ? "url" : field.kind === "number" ? "number" : field.kind === "password" ? "password" : "text"} autoComplete={field.secret ? "new-password" : undefined} value={typeof value === "boolean" ? "" : value ?? ""} placeholder={editingSecret ? t("prov.secretKeep") : ""} onChange={(event) => setAdapterValues((current) => ({ ...current, [field.key]: event.target.value }))} disabled={save.isPending} aria-invalid={touched && !!field.required && !String(value ?? "").trim() && !editingSecret} />}
                      {editingSecret && <p className="text-xs text-muted-foreground">{t("prov.secretKeep")}</p>}
                    </>}
                  </div>;
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t("prov.secretMasked")}</p>
            </section>
          {touched && !valid && <p className="text-xs text-danger">{t("prov.required")}</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setActiveSheet(null)} disabled={save.isPending}>{t("common.cancel")}</Button><Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? t("common.saving") : t(editingId ? "common.save" : "common.create")}</Button></div>
        </form>
          </>}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!enabledTarget} onOpenChange={(value) => !value && setEnabledTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(enabledTarget?.enabled ? "prov.enableTitle" : "prov.disableTitle")}</AlertDialogTitle><AlertDialogDescription>{t(enabledTarget?.enabled ? "prov.enableBody" : "prov.disableBody", { name: enabledTarget?.provider.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (enabledTarget) setEnabled.mutate(enabledTarget); }} disabled={setEnabled.isPending}>{t(enabledTarget?.enabled ? "prov.enable" : "prov.disable")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}

function ProviderUsageBillingPanel({ provider, data, loading, error }: { provider: Provider; data: ProviderUsageBilling | null; loading: boolean; error: boolean }) {
  const { t, locale } = useI18n();
  const formatMetric = (metric: ProviderUsageMetric) => `${formatNumber(metric.amount, locale)} ${t(`prov.usage.unit.${metric.unit}` as MessageKey)}`;
  const amountWithCurrency = (value: { amount: number; currency: string }) => `${formatNumber(value.amount, locale)} ${value.currency}`;
  const unavailable = t("prov.usage.notAvailable");
  if (loading) return <div className="h-32 animate-pulse rounded-sm bg-muted" aria-label={t("prov.usage.loading")} />;
  if (error) return <p role="alert" className="py-6 text-sm text-danger">{t("prov.usage.loadError")}</p>;
  if (!data) return <div className="flex min-h-40 flex-col justify-center gap-2 py-8 text-center"><h3 className="text-sm font-semibold">{t("prov.usage.notAvailable")}</h3><p className="text-sm text-muted-foreground">{t("prov.usage.noRecord", { channel: t(`channel.${provider.channel}`) })}</p></div>;
  const sourceKey: Record<ProviderUsageBilling["source"], MessageKey> = {
    development_sample: "prov.usage.source.sample",
    provider_api: "prov.usage.source.providerApi",
    internal_metering: "prov.usage.source.internal",
    manual: "prov.usage.source.manual",
  };
  return (
    <div className="space-y-5">
      <p className="rounded-sm border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">{t(sourceKey[data.source])}</p>
      <dl className="grid grid-cols-1 gap-3 border-b pb-4 text-sm sm:grid-cols-2">
        <div><dt className="text-label">{t("prov.usage.period")}</dt><dd className="mt-1">{formatDate(data.periodStart, locale)} – {formatDate(data.periodEnd, locale)}</dd></div>
        <div><dt className="text-label">{t("prov.usage.lastSynced")}</dt><dd className="mt-1">{data.lastSyncedAt ? `${formatDate(data.lastSyncedAt, locale)} · ${formatTime(data.lastSyncedAt, locale)}` : unavailable}</dd></div>
      </dl>
      <dl className="grid grid-cols-1 gap-x-6 divide-y text-sm sm:grid-cols-2 sm:divide-y-0">
        <div className="py-3"><dt className="text-label">{t("prov.usage.trafficRouted")}</dt><dd className="mt-1 font-medium tabular-nums">{data.trafficRouted ? formatMetric(data.trafficRouted) : unavailable}</dd></div>
        <div className="py-3"><dt className="text-label">{t("prov.usage.billableUsage")}</dt><dd className="mt-1 font-medium tabular-nums">{data.billableUsage ? formatMetric(data.billableUsage) : unavailable}</dd></div>
        <div className="py-3"><dt className="text-label">{t("prov.usage.accountBalance")}</dt><dd className="mt-1 font-medium tabular-nums">{data.accountBalance ? amountWithCurrency(data.accountBalance) : unavailable}</dd></div>
        <div className="py-3"><dt className="text-label">{t("prov.usage.estimatedCost")}</dt><dd className="mt-1 font-medium tabular-nums">{data.estimatedCost ? amountWithCurrency(data.estimatedCost) : unavailable}</dd></div>
      </dl>
      {data.allowance && <section className="border-t pt-4">
        <h3 className="text-sm font-semibold">{t("prov.usage.allowance")}</h3>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-label">{t("prov.usage.used")}</dt><dd className="mt-1 tabular-nums">{formatMetric({ amount: data.allowance.used, unit: data.allowance.unit })}</dd></div>
          <div><dt className="text-label">{t("prov.usage.total")}</dt><dd className="mt-1 tabular-nums">{formatMetric({ amount: data.allowance.total, unit: data.allowance.unit })}</dd></div>
          <div><dt className="text-label">{t("prov.usage.remaining")}</dt><dd className="mt-1 tabular-nums">{formatMetric({ amount: data.allowance.remaining, unit: data.allowance.unit })}</dd></div>
        </dl>
      </section>}
      {data.categories && <section className="border-t pt-4">
        <h3 className="text-sm font-semibold">{t("prov.usage.categoryUsage")}</h3>
        <ul className="mt-2 divide-y">{data.categories.map((category) => <li key={category.name} className="flex justify-between gap-3 py-2 text-sm"><span>{t(`prov.usage.category.${category.name}` as MessageKey)}</span><span className="tabular-nums">{formatNumber(category.messages, locale)} {t("prov.usage.unit.messages")}</span></li>)}</ul>
      </section>}
    </div>
  );
}
