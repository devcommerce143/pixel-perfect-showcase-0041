import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock, Plus, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, Provider, ProviderConfigInput } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/providers")({
  head: () => pageHead("Gateways & Providers", "Upstream SMS, WhatsApp and Email providers configured on the Dolf Connect platform."),
  component: () => <RequirePermission permission="platform.providers"><Providers /></RequirePermission>,
});

function Providers() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const { data } = useQuery(queries.providers());
  const [selected, setSelected] = useState<Provider | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [enabledTarget, setEnabledTarget] = useState<{ provider: Provider; enabled: boolean } | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [type, setType] = useState<Provider["type"]>("Primary");
  const [priority, setPriority] = useState("1");
  const [region, setRegion] = useState("");
  const [secret, setSecret] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const config: ProviderConfigInput = { name: name.trim(), channel, type, priority: Number(priority), region: region.trim() };
      return editingId ? api.updateProvider(editingId, { ...config, ...(secret ? { secret } : {}) }) : api.createProvider({ ...config, secret });
    },
    onSuccess: async (provider) => {
      toast.success(t(editingId ? "prov.saved" : "prov.created"));
      await queryClient.invalidateQueries({ queryKey: ["providers"] });
      setSelected(provider);
      setFormOpen(false);
      setSecret("");
    },
    onError: () => setError(t("prov.saveError")),
  });
  const test = useMutation({
    mutationFn: (provider: Provider) => api.testProviderConnection(provider.id),
    onSuccess: async (result, provider) => {
      toast.success(result.success ? t("prov.testSuccess", { latency: result.latencyMs }) : t("prov.testFailure"));
      await queryClient.invalidateQueries({ queryKey: ["providers"] });
      setSelected({ ...provider, status: result.success ? "healthy" : "unavailable", latencyMs: result.latencyMs, successRate: result.success ? 99.5 : 0, checkedAt: new Date().toISOString() });
    },
    onError: () => toast.error(t("prov.testFailure")),
  });
  const setEnabled = useMutation({
    mutationFn: ({ provider, enabled }: { provider: Provider; enabled: boolean }) => api.setProviderEnabled(provider.id, enabled),
    onSuccess: async (_, variables) => { toast.success(t(variables.enabled ? "prov.enabled" : "prov.disabled")); await queryClient.invalidateQueries({ queryKey: ["providers"] }); setEnabledTarget(null); setSelected({ ...variables.provider, enabled: variables.enabled }); },
  });
  const valid = name.trim().length > 1 && region.trim().length > 0 && Number(priority) > 0 && (editingId || secret.trim().length > 0);
  const openCreate = () => { setEditingId(null); setName(""); setChannel("sms"); setType("Primary"); setPriority("1"); setRegion(""); setSecret(""); setTouched(false); setError(""); setFormOpen(true); };
  const openEdit = (provider: Provider) => { setSelected(null); setEditingId(provider.id); setName(provider.name); setChannel(provider.channel); setType(provider.type); setPriority(String(provider.priority)); setRegion(provider.region); setSecret(""); setTouched(false); setError(""); setFormOpen(true); };
  const columns: Column<Provider>[] = [
    { id: "name", header: t("common.name"), cell: (p) => (<div><div className="font-medium">{p.name}</div><div className="font-mono text-xs text-muted-foreground">{p.id}</div></div>) },
    { id: "channel", header: t("common.channel"), cell: (p) => <ChannelLabel channel={p.channel} /> },
    { id: "type", header: t("prov.type"), cell: (p) => p.type },
    { id: "prio", header: t("prov.priority"), cell: (p) => <span className="tabular-nums">{p.priority}</span> },
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
        <Section><DataTable columns={columns} rows={data} loading={!data} rowKey={(p) => p.id} onRowClick={setSelected} /></Section>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">
          {selected && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><div className="flex items-center gap-2"><StatusBadge status={selected.status} /><StatusBadge status={selected.enabled ? "active" : "disabled"} /></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("prov.priority")}</dt><dd>{selected.priority}</dd></div><div><dt className="text-label">{t("ten.region")}</dt><dd>{selected.region}</dd></div><div><dt className="text-label">{t("prov.latency")}</dt><dd>{selected.latencyMs} ms</dd></div><div><dt className="text-label">{t("prov.success")}</dt><dd>{formatPercent(selected.successRate, locale)}</dd></div></dl><p className="text-xs text-muted-foreground">{t("prov.secretConfigured")}</p>{can("platform.providers.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button><Button variant="outline" disabled={test.isPending} onClick={() => test.mutate(selected)}><PlugZap className="size-4" />{t("prov.test")}</Button><Button variant={selected.enabled ? "destructive" : "outline"} onClick={() => setEnabledTarget({ provider: selected, enabled: !selected.enabled })}>{t(selected.enabled ? "prov.disable" : "prov.enable")}</Button></div>}</div></>}
        </SheetContent>
      </Sheet>
      <Sheet open={formOpen} onOpenChange={(value) => !save.isPending && setFormOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>{t(editingId ? "prov.edit" : "prov.add")}</SheetTitle><SheetDescription>{t("prov.formDescription")}</SheetDescription></SheetHeader><form className="space-y-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid) save.mutate(); }} noValidate>
          <div className="space-y-1.5"><Label htmlFor="provider-name">{t("common.name")} *</Label><Input id="provider-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={touched && name.trim().length <= 1} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={channel} onValueChange={(value) => setChannel(value as Channel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>{t("prov.type")}</Label><Select value={type} onValueChange={(value) => setType(value as Provider["type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Primary">{t("prov.primary")}</SelectItem><SelectItem value="Failover">{t("prov.failover")}</SelectItem></SelectContent></Select></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="provider-priority">{t("prov.priority")}</Label><Input id="provider-priority" type="number" min="1" step="1" value={priority} onChange={(event) => setPriority(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="provider-region">{t("ten.region")}</Label><Input id="provider-region" value={region} onChange={(event) => setRegion(event.target.value)} /></div></div>
          <div className="space-y-1.5"><Label htmlFor="provider-secret">{t("prov.secret")}{!editingId && " *"}</Label><Input id="provider-secret" type="password" autoComplete="new-password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={editingId ? t("prov.secretKeep") : ""} /><p className="text-xs text-muted-foreground">{t("prov.secretMasked")}</p></div>
          {touched && !valid && <p className="text-xs text-danger">{t("prov.required")}</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={save.isPending}>{t("common.cancel")}</Button><Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? t("common.saving") : t(editingId ? "common.save" : "common.create")}</Button></div>
        </form></SheetContent>
      </Sheet>
      <AlertDialog open={!!enabledTarget} onOpenChange={(value) => !value && setEnabledTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(enabledTarget?.enabled ? "prov.enableTitle" : "prov.disableTitle")}</AlertDialogTitle><AlertDialogDescription>{t(enabledTarget?.enabled ? "prov.enableBody" : "prov.disableBody", { name: enabledTarget?.provider.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (enabledTarget) setEnabled.mutate(enabledTarget); }} disabled={setEnabled.isPending}>{t(enabledTarget?.enabled ? "prov.enable" : "prov.disable")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
