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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, RoutingRule } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/routing")({
  head: () => pageHead("Routing", "Provider routing and failover rules."),
  component: () => <RequirePermission permission="platform.routing"><Routing /></RequirePermission>,
});

function Routing() {
  const { t, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const q = useQuery(queries.routing());
  const providerQuery = useQuery(queries.providers());
  const [selected, setSelected] = useState<RoutingRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"save" | { rule: RoutingRule; status: RoutingRule["status"] } | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Omit<RoutingRule, "id">>({ name: "", channel: "sms", priority: 10, condition: "*", primaryProvider: "", failoverProvider: null, retry: "3 × 60s", status: "active" });
  const save = useMutation({
    mutationFn: () => editingId ? api.updateRoutingRule(editingId, draft) : api.createRoutingRule(draft),
    onSuccess: async () => { toast.success(t(editingId ? "rt.saved" : "rt.created")); await queryClient.invalidateQueries({ queryKey: ["routing"] }); setFormOpen(false); setConfirmAction(null); },
    onError: () => setError(t("rt.saveError")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { rule: RoutingRule; status: RoutingRule["status"] }) => api.setRoutingRuleStatus(input.rule.id, input.status),
    onSuccess: async (_, input) => { toast.success(t("rt.statusChanged")); await queryClient.invalidateQueries({ queryKey: ["routing"] }); setSelected({ ...input.rule, status: input.status }); setConfirmAction(null); },
  });
  const valid = draft.name.trim().length > 1 && draft.condition.trim().length > 0 && draft.primaryProvider.length > 0 && Number(draft.priority) > 0 && draft.retry.trim().length > 0;
  const availableProviders = (providerQuery.data ?? []).filter((provider) => provider.channel === draft.channel && provider.enabled);
  const openCreate = () => { setEditingId(null); setDraft({ name: "", channel: "sms", priority: 10, condition: "*", primaryProvider: "", failoverProvider: null, retry: "3 × 60s", status: "active" }); setTouched(false); setError(""); setFormOpen(true); };
  const openEdit = (rule: RoutingRule) => { setSelected(null); setEditingId(rule.id); setDraft({ ...rule }); setTouched(false); setError(""); setFormOpen(true); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); setTouched(true); if (valid) setConfirmAction("save"); };
  const confirm = () => {
    if (confirmAction === "save") save.mutate();
    else if (confirmAction) changeStatus.mutate(confirmAction);
  };
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
      <PageHeader title={t("rt.title")} description={t("rt.subtitle")} actions={can("platform.routing.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("rt.add")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem] text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />{t("prov.restricted")}
        </div>
        <Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(r) => r.id} onRowClick={setSelected} /></Section>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><StatusBadge status={selected.status} /><dl className="grid gap-3 text-sm"><div><dt className="text-label">{t("rt.condition")}</dt><dd dir="ltr" className="font-mono">{selected.condition}</dd></div><div><dt className="text-label">{t("rt.primary")}</dt><dd>{selected.primaryProvider}</dd></div><div><dt className="text-label">{t("rt.failover")}</dt><dd>{selected.failoverProvider ?? "—"}</dd></div><div><dt className="text-label">{t("rt.retry")}</dt><dd>{selected.retry}</dd></div><div><dt className="text-label">{t("prov.priority")}</dt><dd>{selected.priority}</dd></div></dl>{can("platform.routing.manage") && <div className="flex gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button><Button variant={selected.status === "active" ? "destructive" : "outline"} onClick={() => setConfirmAction({ rule: selected, status: selected.status === "active" ? "disabled" : "active" })}>{t(selected.status === "active" ? "rt.disable" : "rt.enable")}</Button></div>}</div></>}</SheetContent></Sheet>
      <Sheet open={formOpen} onOpenChange={(value) => !save.isPending && setFormOpen(value)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>{t(editingId ? "rt.edit" : "rt.add")}</SheetTitle><SheetDescription>{t("rt.formDescription")}</SheetDescription></SheetHeader><form className="space-y-4 px-4 pb-6" onSubmit={submit} noValidate>
        <div className="space-y-1.5"><Label htmlFor="rule-name">{t("rt.rule")} *</Label><Input id="rule-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={touched && draft.name.trim().length < 2} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={draft.channel} onValueChange={(value) => setDraft({ ...draft, channel: value as Channel, primaryProvider: "", failoverProvider: null })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((channel) => <SelectItem key={channel} value={channel}>{t(`channel.${channel}`)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="rule-priority">{t("prov.priority")}</Label><Input id="rule-priority" type="number" min="1" step="1" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></div></div>
        <div className="space-y-1.5"><Label htmlFor="rule-condition">{t("rt.condition")}</Label><Input id="rule-condition" dir="ltr" value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>{t("rt.primary")}</Label><Select value={draft.primaryProvider} onValueChange={(value) => setDraft({ ...draft, primaryProvider: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availableProviders.map((provider) => <SelectItem key={provider.id} value={provider.name}>{provider.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>{t("rt.failover")}</Label><Select value={draft.failoverProvider ?? "__none"} onValueChange={(value) => setDraft({ ...draft, failoverProvider: value === "__none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">{t("common.none")}</SelectItem>{availableProviders.filter((provider) => provider.name !== draft.primaryProvider).map((provider) => <SelectItem key={provider.id} value={provider.name}>{provider.name}</SelectItem>)}</SelectContent></Select></div></div>
        <div className="space-y-1.5"><Label htmlFor="rule-retry">{t("rt.retry")}</Label><Input id="rule-retry" dir="ltr" value={draft.retry} onChange={(event) => setDraft({ ...draft, retry: event.target.value })} /></div>
        {touched && !valid && <p className="text-xs text-danger">{t("rt.required")}</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={!valid || save.isPending}>{t(editingId ? "common.save" : "common.create")}</Button></div>
      </form></SheetContent></Sheet>
      <AlertDialog open={!!confirmAction} onOpenChange={(value) => !value && setConfirmAction(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("rt.confirmTitle")}</AlertDialogTitle><AlertDialogDescription>{t(confirmAction === "save" ? "rt.confirmBody" : "rt.confirmStatus", { name: confirmAction === "save" ? draft.name : confirmAction?.rule.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); confirm(); }} disabled={save.isPending || changeStatus.isPending}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
