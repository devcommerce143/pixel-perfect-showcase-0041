import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, FailoverTrigger, RoutingCategory, RoutingCondition, RoutingRule } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/routing")({
  head: () => pageHead("Routing", "Provider routing and failover rules."),
  component: () => <RequirePermission permission="platform.routing"><Routing /></RequirePermission>,
});

const ROUTING_CATEGORIES: RoutingCategory[] = ["authentication", "transactional", "marketing"];
const FAILOVER_TRIGGERS: FailoverTrigger[] = ["connection_timeout", "network_error", "http_5xx", "provider_unavailable", "rate_limited"];

function conditionSummary(condition: RoutingCondition, t: (key: MessageKey) => string) {
  return condition.mode === "all" ? t("rt.condition.all") : condition.categories.map((category) => t(`rt.category.${category}` as MessageKey)).join(", ");
}

function retrySummary(retry: RoutingRule["retryPolicy"]) {
  return `${retry.attempts} × ${retry.intervalSeconds}s`;
}

function triggerSummary(triggers: FailoverTrigger[], t: (key: MessageKey) => string) {
  return triggers.length ? triggers.map((trigger) => t(`rt.trigger.${trigger}` as MessageKey)).join(", ") : t("common.none");
}

function conditionsOverlap(left: RoutingCondition, right: RoutingCondition) {
  if (left.mode === "all" || right.mode === "all") return true;
  return left.categories.some((category) => right.categories.includes(category));
}

function conditionsEqual(left: RoutingCondition, right: RoutingCondition) {
  if (left.mode !== right.mode) return false;
  if (left.mode === "all" || right.mode === "all") return true;
  return left.categories.length === right.categories.length && left.categories.every((category) => right.categories.includes(category));
}

function Routing() {
  const { t, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const q = useQuery(queries.routing());
  const providerQuery = useQuery(queries.providers());
  const providers = providerQuery.data ?? [];
  const [selected, setSelected] = useState<RoutingRule | null>(null);
  const [activeSheet, setActiveSheet] = useState<"detail" | "form" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"save" | { rule: RoutingRule; status: RoutingRule["status"] } | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Omit<RoutingRule, "id">>({ name: "", channel: "sms", priority: 10, condition: { mode: "all" }, primaryProvider: "", failoverProvider: null, retryPolicy: { attempts: 3, intervalSeconds: 60 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable"], status: "active" });
  const save = useMutation({
    mutationFn: () => editingId ? api.updateRoutingRule(editingId, draft) : api.createRoutingRule(draft),
    onSuccess: async (rule) => { toast.success(t(editingId ? "rt.saved" : "rt.created")); await queryClient.invalidateQueries({ queryKey: ["routing"] }); setSelected(rule); setActiveSheet("detail"); setConfirmAction(null); },
    onError: () => setError(t("rt.saveError")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { rule: RoutingRule; status: RoutingRule["status"] }) => api.setRoutingRuleStatus(input.rule.id, input.status),
    onSuccess: async (_, input) => { toast.success(t("rt.statusChanged")); await queryClient.invalidateQueries({ queryKey: ["routing"] }); setSelected({ ...input.rule, status: input.status }); setActiveSheet("detail"); setConfirmAction(null); },
    onError: () => { toast.error(t("rt.saveError")); setConfirmAction(null); },
  });
  const availableProviders = providers.filter((provider) => provider.channel === draft.channel && provider.enabled && provider.status !== "unavailable");
  const providerByName = (name: string) => providers.find((provider) => provider.name === name);
  const providerIsEligible = (name: string) => availableProviders.some((provider) => provider.name === name);
  const primaryProvider = providerByName(draft.primaryProvider);
  const failoverProvider = draft.failoverProvider ? providerByName(draft.failoverProvider) : null;
  const stalePrimary = !!draft.primaryProvider && !providerIsEligible(draft.primaryProvider);
  const staleFailover = !!draft.failoverProvider && !providerIsEligible(draft.failoverProvider);
  const duplicateRule = (q.data ?? []).some((rule) => rule.id !== editingId && rule.channel === draft.channel && conditionsEqual(rule.condition, draft.condition));
  const priorityConflict = (q.data ?? []).some((rule) => rule.id !== editingId && rule.channel === draft.channel && rule.priority === draft.priority && conditionsOverlap(rule.condition, draft.condition));
  const valid = draft.name.trim().length > 1 && (draft.condition.mode === "all" || draft.condition.categories.length > 0) && Number.isInteger(draft.priority) && draft.priority > 0 && Number.isInteger(draft.retryPolicy.attempts) && draft.retryPolicy.attempts >= 1 && draft.retryPolicy.attempts <= 10 && Number.isInteger(draft.retryPolicy.intervalSeconds) && draft.retryPolicy.intervalSeconds >= 1 && draft.retryPolicy.intervalSeconds <= 3600 && !!draft.primaryProvider && !stalePrimary && (!draft.failoverProvider || (!staleFailover && draft.failoverProvider !== draft.primaryProvider && draft.failoverTriggers.length > 0)) && !duplicateRule && !priorityConflict;
  const withReferencedProvider = (selectedName: string) => {
    if (!selectedName || availableProviders.some((provider) => provider.name === selectedName)) return availableProviders;
    const referenced = providerByName(selectedName);
    return referenced ? [referenced, ...availableProviders] : availableProviders;
  };
  const providerOptionLabel = (providerName: string, channel = draft.channel) => {
    const provider = providerByName(providerName);
    if (!provider) return `${providerName} · ${t("rt.providerMissing")}`;
    if (provider.channel !== channel) return `${providerName} · ${t("rt.providerWrongChannel")}`;
    if (!provider.enabled) return `${providerName} · ${t("rt.providerDisabled")}`;
    if (provider.status === "unavailable") return `${providerName} · ${t("rt.providerUnavailable")}`;
    return providerName;
  };
  const setCategory = (category: RoutingCategory, checked: boolean) => setDraft((current) => {
    const existing = current.condition.mode === "categories" ? current.condition.categories : [];
    const categories = checked ? [...new Set([...existing, category])] : existing.filter((item) => item !== category);
    return { ...current, condition: { mode: "categories", categories } };
  });
  const openCreate = () => { setSelected(null); setEditingId(null); setDraft({ name: "", channel: "sms", priority: 10, condition: { mode: "all" }, primaryProvider: "", failoverProvider: null, retryPolicy: { attempts: 3, intervalSeconds: 60 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable"], status: "active" }); setTouched(false); setError(""); setActiveSheet("form"); };
  const openEdit = (rule: RoutingRule) => { setSelected(null); setEditingId(rule.id); setDraft({ ...rule, condition: rule.condition.mode === "all" ? { mode: "all" } : { mode: "categories", categories: [...rule.condition.categories] }, retryPolicy: { ...rule.retryPolicy }, failoverTriggers: [...rule.failoverTriggers] }); setTouched(false); setError(""); setActiveSheet("form"); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); setTouched(true); if (valid) setConfirmAction("save"); };
  const confirm = () => {
    if (confirmAction === "save") save.mutate();
    else if (confirmAction) changeStatus.mutate(confirmAction);
  };
  const columns: Column<RoutingRule>[] = [
    { id: "p", header: t("rt.priority"), cell: (r) => <span className="tabular-nums font-medium">{r.priority}</span> },
    { id: "n", header: t("rt.rule"), cell: (r) => (<div><div className="font-medium">{r.name}</div><div className="font-mono text-xs text-muted-foreground">{r.id}</div></div>) },
    { id: "c", header: t("common.channel"), cell: (r) => <ChannelLabel channel={r.channel} /> },
    { id: "cond", header: t("rt.condition"), className: "hidden lg:table-cell", cell: (r) => conditionSummary(r.condition, t) },
    { id: "pr", header: t("rt.primary"), cell: (r) => providerOptionLabel(r.primaryProvider, r.channel) },
    { id: "f", header: t("rt.failover"), cell: (r) => r.failoverProvider ? providerOptionLabel(r.failoverProvider, r.channel) : t("common.none") },
    { id: "rt", header: t("rt.retry"), className: "hidden xl:table-cell", cell: (r) => <span className="text-muted-foreground">{retrySummary(r.retryPolicy)}</span> },
    { id: "triggers", header: t("rt.failoverTriggers"), className: "hidden xl:table-cell", cell: (r) => <span className="text-muted-foreground">{triggerSummary(r.failoverTriggers, t)}</span> },
    { id: "s", header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <PageHeader title={t("rt.title")} description={t("rt.subtitle")} actions={can("platform.routing.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("rt.add")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem] text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />{t("prov.restricted")}
        </div>
        <Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={(rule) => { setSelected(rule); setActiveSheet("detail"); }} /></Section>
      </PageBody>
      <Sheet open={activeSheet !== null} onOpenChange={(value) => { if (!value && !save.isPending) { setSelected(null); setActiveSheet(null); } }}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className={`w-full overflow-y-auto ${activeSheet === "form" ? "sm:max-w-xl" : "sm:max-w-md"}`}>
          {activeSheet === "detail" && selected && <>
            <SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader>
            <div className="space-y-4 px-4">
              <StatusBadge status={selected.status} />
              <dl className="grid gap-3 text-sm">
                <div><dt className="text-label">{t("rt.condition")}</dt><dd>{conditionSummary(selected.condition, t)}</dd></div>
                <div><dt className="text-label">{t("rt.priority")}</dt><dd>{selected.priority}</dd></div>
                <div><dt className="text-label">{t("rt.primary")}</dt><dd>{providerOptionLabel(selected.primaryProvider, selected.channel)}</dd></div>
                <div><dt className="text-label">{t("rt.failover")}</dt><dd>{selected.failoverProvider ? providerOptionLabel(selected.failoverProvider, selected.channel) : t("common.none")}</dd></div>
                <div><dt className="text-label">{t("rt.retry")}</dt><dd>{retrySummary(selected.retryPolicy)}</dd></div>
                <div><dt className="text-label">{t("rt.failoverTriggers")}</dt><dd>{triggerSummary(selected.failoverTriggers, t)}</dd></div>
              </dl>
              {can("platform.routing.manage") && <div className="flex gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button><Button variant={selected.status === "active" ? "destructive" : "outline"} onClick={() => setConfirmAction({ rule: selected, status: selected.status === "active" ? "disabled" : "active" })}>{t(selected.status === "active" ? "rt.disable" : "rt.enable")}</Button></div>}
            </div>
          </>}
          {activeSheet === "form" && <>
          <SheetHeader><SheetTitle>{t(editingId ? "rt.edit" : "rt.add")}</SheetTitle><SheetDescription>{t("rt.formDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-4 px-4 pb-6" onSubmit={submit} noValidate>
            <div className="space-y-1.5"><Label htmlFor="rule-name">{t("rt.rule")} *</Label><Input id="rule-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={touched && draft.name.trim().length < 2} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={draft.channel} onValueChange={(value) => setDraft({ ...draft, channel: value as Channel, primaryProvider: "", failoverProvider: null })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((channel) => <SelectItem key={channel} value={channel}>{t(`channel.${channel}`)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="rule-priority">{t("rt.priority")}</Label><Input id="rule-priority" type="number" min="1" max="9999" step="1" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} aria-invalid={touched && (!Number.isInteger(draft.priority) || draft.priority < 1)} /></div>
            </div>

            <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{t("rt.condition")}</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={draft.condition.mode === "all"} onCheckedChange={(checked) => setDraft((current) => ({ ...current, condition: checked === true ? { mode: "all" } : { mode: "categories", categories: current.condition.mode === "categories" && current.condition.categories.length ? current.condition.categories : ["authentication"] } }))} />{t("rt.condition.all")}</label>
              <div className="grid gap-2 ps-6 sm:grid-cols-3">
                {ROUTING_CATEGORIES.map((category) => <label key={category} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={draft.condition.mode === "categories" && draft.condition.categories.includes(category)} disabled={draft.condition.mode === "all"} onCheckedChange={(checked) => setCategory(category, checked === true)} />{t(`rt.category.${category}` as MessageKey)}</label>)}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>{t("rt.primary")}</Label><Select value={draft.primaryProvider} onValueChange={(value) => setDraft((current) => ({ ...current, primaryProvider: value, failoverProvider: current.failoverProvider === value ? null : current.failoverProvider }))}><SelectTrigger aria-invalid={touched && (!draft.primaryProvider || stalePrimary)}><SelectValue placeholder={t("rt.selectProvider")} /></SelectTrigger><SelectContent>{withReferencedProvider(draft.primaryProvider).map((provider) => <SelectItem key={provider.id} value={provider.name} disabled={provider.channel !== draft.channel || !provider.enabled || provider.status === "unavailable"}>{providerOptionLabel(provider.name)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("rt.failover")}</Label><Select value={draft.failoverProvider ?? "__none"} onValueChange={(value) => setDraft({ ...draft, failoverProvider: value === "__none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">{t("common.none")}</SelectItem>{withReferencedProvider(draft.failoverProvider ?? "").filter((provider) => provider.name !== draft.primaryProvider).map((provider) => <SelectItem key={provider.id} value={provider.name} disabled={provider.channel !== draft.channel || !provider.enabled || provider.status === "unavailable"}>{providerOptionLabel(provider.name)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {draft.primaryProvider && availableProviders.every((provider) => provider.name === draft.primaryProvider) && <p className="text-xs text-muted-foreground">{t("rt.noFailoverProvider")}</p>}
            {(stalePrimary || staleFailover) && <p role="alert" className="text-xs text-danger">{t("rt.staleProviderCorrection")}</p>}
            {draft.failoverProvider && <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{t("rt.failoverTriggers")}</legend>
              <p className="text-xs text-muted-foreground">{t("rt.failoverTriggersHint")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FAILOVER_TRIGGERS.map((trigger) => <label key={trigger} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={draft.failoverTriggers.includes(trigger)} onCheckedChange={(checked) => setDraft((current) => ({ ...current, failoverTriggers: checked === true ? [...new Set([...current.failoverTriggers, trigger])] : current.failoverTriggers.filter((item) => item !== trigger) }))} />{t(`rt.trigger.${trigger}` as MessageKey)}</label>)}
              </div>
              {touched && draft.failoverTriggers.length === 0 && <p className="text-xs text-danger">{t("rt.failoverTriggersRequired")}</p>}
            </fieldset>}

            <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{t("rt.retry")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="retry-attempts">{t("rt.retryAttempts")}</Label><Input id="retry-attempts" type="number" min="1" max="10" step="1" value={draft.retryPolicy.attempts} onChange={(event) => setDraft({ ...draft, retryPolicy: { ...draft.retryPolicy, attempts: Number(event.target.value) } })} aria-invalid={touched && (!Number.isInteger(draft.retryPolicy.attempts) || draft.retryPolicy.attempts < 1 || draft.retryPolicy.attempts > 10)} /></div>
                <div className="space-y-1.5"><Label htmlFor="retry-interval">{t("rt.retryInterval")}</Label><Input id="retry-interval" type="number" min="1" max="3600" step="1" value={draft.retryPolicy.intervalSeconds} onChange={(event) => setDraft({ ...draft, retryPolicy: { ...draft.retryPolicy, intervalSeconds: Number(event.target.value) } })} aria-invalid={touched && (!Number.isInteger(draft.retryPolicy.intervalSeconds) || draft.retryPolicy.intervalSeconds < 1 || draft.retryPolicy.intervalSeconds > 3600)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">{t("rt.retrySummary", { summary: retrySummary(draft.retryPolicy) })}</p>
            </fieldset>

            {duplicateRule && <p role="alert" className="text-xs text-danger">{t("rt.duplicateCondition")}</p>}
            {priorityConflict && <p role="alert" className="text-xs text-danger">{t("rt.priorityConflict")}</p>}
            {touched && !valid && !duplicateRule && !priorityConflict && <p role="alert" className="text-xs text-danger">{t("rt.required")}</p>}
            {error && <p role="alert" className="text-sm text-danger">{t(error as MessageKey)}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setActiveSheet(null)}>{t("common.cancel")}</Button><Button type="submit" disabled={!valid || save.isPending}>{t(editingId ? "common.save" : "common.create")}</Button></div>
          </form>
          </>}
        </SheetContent>
      </Sheet>
      <AlertDialog open={!!confirmAction} onOpenChange={(value) => !value && setConfirmAction(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("rt.confirmTitle")}</AlertDialogTitle><AlertDialogDescription>{t(confirmAction === "save" ? "rt.confirmBody" : "rt.confirmStatus", { name: confirmAction === "save" ? draft.name : confirmAction?.rule.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); confirm(); }} disabled={save.isPending || changeStatus.isPending}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
