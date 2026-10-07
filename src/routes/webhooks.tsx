import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { SenderIdentityActor, Webhook, WebhookEvent } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/webhooks")({
  head: () => pageHead("Webhooks", "Configure delivery status callbacks to your systems."),
  component: () => <RequirePermission permission="webhooks.view"><Webhooks /></RequirePermission>,
});

const EVENTS: WebhookEvent[] = ["message.sent", "message.delivered", "message.failed", "message.read", "bulk_job.completed", "template.status_changed"];

function Webhooks() {
  const { t, locale } = useI18n();
  const { can, user } = useSession();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const qc = useQueryClient();
  const q = useQuery(queries.webhooks());
  const apps = useQuery(queries.applications(actor));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Webhook | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ webhook: Webhook; status: Webhook["status"] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [url, setUrl] = useState("");
  const [app, setApp] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["message.delivered", "message.failed"]);
  const [touched, setTouched] = useState(false);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const urlOk = /^https:\/\/[^\s]+\.[^\s]+/.test(url);

  const create = useMutation({
    mutationFn: () => api.createWebhook({ url, events, applicationName: app }),
    onSuccess: async (result) => { toast.success(t("wh.created")); await qc.invalidateQueries({ queryKey: ["webhooks"] }); setOpen(false); setUrl(""); setTouched(false); setSigningSecret(result.signingSecret); setCopied(false); },
  });
  const update = useMutation({
    mutationFn: () => api.updateWebhook(editingId!, { url, events, applicationName: app }),
    onSuccess: async (webhook) => { toast.success(t("wh.updated")); await qc.invalidateQueries({ queryKey: ["webhooks"] }); setOpen(false); setSelected(webhook); },
    onError: () => toast.error(t("wh.updateError")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { webhook: Webhook; status: Webhook["status"] }) => api.setWebhookStatus(input.webhook.id, input.status),
    onSuccess: async (_, input) => { toast.success(t("wh.statusChanged")); await qc.invalidateQueries({ queryKey: ["webhooks"] }); setSelected({ ...input.webhook, status: input.status }); setPendingStatus(null); },
  });
  const remove = useMutation({
    mutationFn: (webhook: Webhook) => api.deleteWebhook(webhook.id),
    onSuccess: async () => { toast.success(t("wh.deleted")); await qc.invalidateQueries({ queryKey: ["webhooks"] }); setSelected(null); setDeleteTarget(null); },
  });
  const test = useMutation({
    mutationFn: (webhook: Webhook) => api.testWebhook(webhook.id),
    onSuccess: async (delivery, webhook) => { toast.success(t("wh.testSent", { url: webhook.url })); await qc.invalidateQueries({ queryKey: ["webhooks"] }); setSelected((current) => current?.id === webhook.id ? { ...current, lastDeliveryAt: delivery.at, deliveries: [delivery, ...current.deliveries] } : current); },
    onError: () => toast.error(t("wh.testError")),
  });
  const openCreate = () => { setEditingId(null); setUrl(""); setApp(""); setEvents(["message.delivered", "message.failed"]); setTouched(false); setOpen(true); };
  const openEdit = (webhook: Webhook) => { setSelected(null); setEditingId(webhook.id); setUrl(webhook.url); setApp(webhook.applicationName); setEvents([...webhook.events]); setTouched(false); setOpen(true); };

  const columns: Column<Webhook>[] = [
    { id: "url", header: t("wh.url"), cell: (w) => (<div><div dir="ltr" className="font-mono text-xs font-medium">{w.url}</div><div className="text-caption">{w.applicationName}</div></div>) },
    { id: "ev", header: t("wh.events"), className: "hidden xl:table-cell", cell: (w) => <div className="flex flex-wrap gap-1">{w.events.map((e) => <span key={e} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem]">{e}</span>)}</div> },
    { id: "status", header: t("common.status"), cell: (w) => <StatusBadge status={w.status} /> },
    { id: "rate", header: t("wh.successRate"), cell: (w) => <span className="tabular-nums">{formatPercent(w.successRate, locale)}</span> },
    { id: "last", header: t("wh.lastDelivery"), className: "hidden lg:table-cell", cell: (w) => <span className="tabular-nums text-muted-foreground">{w.lastDeliveryAt ? formatDateTime(w.lastDeliveryAt, locale) : t("common.never")}</span> },
    { id: "act", header: <span className="sr-only">{t("common.actions")}</span>, className: "text-end", cell: (w) =>
      can("webhooks.manage") && w.status === "active" ? <Button variant="outline" size="sm" className="h-7" disabled={test.isPending} onClick={(event) => { event.stopPropagation(); test.mutate(w); }}>{t("wh.test")}</Button> : null },
  ];

  return (
    <>
      <PageHeader title={t("wh.title")} description={t("wh.subtitle")}
        actions={can("webhooks.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("wh.new")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />{t("wh.signing")}
        </div>
        <Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(w) => w.id} onRowClick={setSelected} /></Section>
      </PageBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t(editingId ? "wh.edit" : "wh.new")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="wu">{t("wh.url")}</Label>
              <Input id="wu" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              {touched && !urlOk && <p className="text-xs text-danger">{t("wh.invalidUrl")}</p>}</div>
            <div className="space-y-1.5"><Label>{t("common.application")}</Label>
              <Select value={app} onValueChange={setApp}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(apps.data ?? []).map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{t("wh.events")}</Label>
              <div className="grid gap-2 sm:grid-cols-2">{EVENTS.map((e) => (
                <label key={e} className="flex items-center gap-2 font-mono text-xs">
                  <Checkbox checked={events.includes(e)} onCheckedChange={(c) => setEvents((s) => c ? [...s, e] : s.filter((x) => x !== e))} />{e}
                </label>))}</div>
              {touched && !events.length && <p className="text-xs text-danger">{t("wh.selectEvents")}</p>}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={create.isPending || update.isPending} onClick={() => { setTouched(true); if (urlOk && events.length && app) { if (editingId) update.mutate(); else create.mutate(); } }}>{create.isPending || update.isPending ? t("common.saving") : t(editingId ? "common.save" : "common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent className="w-full sm:max-w-lg">{selected && <><SheetHeader><SheetTitle>{selected.url}</SheetTitle><SheetDescription>{selected.id} · {selected.applicationName}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><div className="flex items-center gap-2"><StatusBadge status={selected.status} /><span className="text-xs text-muted-foreground">{t(selected.signingConfigured ? "wh.signingConfigured" : "wh.signingNotConfigured")}</span></div><div><h3 className="mb-2 text-sm font-semibold">{t("wh.events")}</h3><div className="flex flex-wrap gap-1">{selected.events.map((event) => <span key={event} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">{event}</span>)}</div></div><div><h3 className="mb-2 text-sm font-semibold">{t("wh.deliveries")}</h3>{selected.deliveries.length ? <ul className="divide-y">{selected.deliveries.slice(0, 5).map((delivery) => <li key={delivery.id} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="font-mono">{delivery.event}</span><span className="text-muted-foreground">{formatDateTime(delivery.at, locale)}</span><span>{delivery.statusCode} · {t(`status.${delivery.result}`)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">{t("wh.noDeliveries")}</p>}</div>{can("webhooks.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{selected.status === "active" && <Button variant="outline" disabled={test.isPending} onClick={() => test.mutate(selected)}>{t("wh.test")}</Button>}<Button variant="outline" onClick={() => setPendingStatus({ webhook: selected, status: selected.status === "active" ? "disabled" : "active" })}>{t(selected.status === "active" ? "wh.disable" : "wh.enable")}</Button><Button variant="destructive" onClick={() => setDeleteTarget(selected)}>{t("wh.delete")}</Button></div>}</div></>}</SheetContent></Sheet>
      <AlertDialog open={!!pendingStatus} onOpenChange={(value) => !value && setPendingStatus(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(pendingStatus?.status === "disabled" ? "wh.disableTitle" : "wh.enableTitle")}</AlertDialogTitle><AlertDialogDescription>{t(pendingStatus?.status === "disabled" ? "wh.disableBody" : "wh.enableBody", { url: pendingStatus?.webhook.url ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (pendingStatus) changeStatus.mutate(pendingStatus); }}>{t(pendingStatus?.status === "disabled" ? "wh.disable" : "wh.enable")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(value) => !value && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("wh.deleteTitle")}</AlertDialogTitle><AlertDialogDescription>{t("wh.deleteBody", { url: deleteTarget?.url ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (deleteTarget) remove.mutate(deleteTarget); }} disabled={remove.isPending}>{t("wh.delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <Dialog open={!!signingSecret} onOpenChange={(value) => { if (!value) { setSigningSecret(null); setCopied(false); } }}><DialogContent><DialogHeader><DialogTitle>{t("wh.secretTitle")}</DialogTitle><DialogDescription>{t("wh.secretWarning")}</DialogDescription></DialogHeader>{signingSecret && <div className="space-y-3"><code dir="ltr" className="block break-all rounded-md border bg-surface-subtle p-3 text-xs">{signingSecret}</code><Button variant="outline" disabled={copied} onClick={async () => { try { await navigator.clipboard.writeText(signingSecret); setCopied(true); toast.success(t("wh.secretCopied")); } catch { toast.error(t("wh.secretCopyFailed")); } }}><Copy className="size-4" />{copied ? t("wh.secretCopied") : t("wh.copySecret")}</Button></div>}<DialogFooter><Button onClick={() => { setSigningSecret(null); setCopied(false); }}>{t("cred.done")}</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}
