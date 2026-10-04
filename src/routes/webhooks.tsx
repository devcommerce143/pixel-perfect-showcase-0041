import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Webhook, WebhookEvent } from "@/lib/api/types";
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
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery(queries.webhooks());
  const apps = useQuery(queries.applications());
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [app, setApp] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["message.delivered", "message.failed"]);
  const [touched, setTouched] = useState(false);
  const urlOk = /^https:\/\/[^\s]+\.[^\s]+/.test(url);

  const create = useMutation({
    mutationFn: () => api.createWebhook({ url, events, applicationName: app }),
    onSuccess: () => { toast.success(t("wh.created")); void qc.invalidateQueries({ queryKey: ["webhooks"] }); setOpen(false); setUrl(""); setTouched(false); },
  });
  const test = useMutation({ mutationFn: (w: Webhook) => api.testWebhook(w.id), onSuccess: (_, w) => toast.success(t("wh.testSent", { url: w.url })) });

  const columns: Column<Webhook>[] = [
    { id: "url", header: t("wh.url"), cell: (w) => (<div><div dir="ltr" className="font-mono text-xs font-medium">{w.url}</div><div className="text-caption">{w.applicationName}</div></div>) },
    { id: "ev", header: t("wh.events"), className: "hidden xl:table-cell", cell: (w) => <div className="flex flex-wrap gap-1">{w.events.map((e) => <span key={e} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem]">{e}</span>)}</div> },
    { id: "status", header: t("common.status"), cell: (w) => <StatusBadge status={w.status} /> },
    { id: "rate", header: t("wh.successRate"), cell: (w) => <span className="tabular-nums">{formatPercent(w.successRate, locale)}</span> },
    { id: "last", header: t("wh.lastDelivery"), className: "hidden lg:table-cell", cell: (w) => <span className="tabular-nums text-muted-foreground">{w.lastDeliveryAt ? formatDateTime(w.lastDeliveryAt, locale) : t("common.never")}</span> },
    { id: "act", header: <span className="sr-only">{t("common.actions")}</span>, className: "text-end", cell: (w) =>
      can("webhooks.manage") && w.status === "active" ? <Button variant="outline" size="sm" className="h-7" disabled={test.isPending} onClick={() => test.mutate(w)}>{t("wh.test")}</Button> : null },
  ];

  return (
    <>
      <PageHeader title={t("wh.title")} description={t("wh.subtitle")}
        actions={can("webhooks.manage") && <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" />{t("wh.new")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />{t("wh.signing")}
        </div>
        <Section><DataTable columns={columns} rows={q.data} loading={q.isLoading} rowKey={(w) => w.id} /></Section>
      </PageBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("wh.new")}</DialogTitle></DialogHeader>
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
            <Button disabled={create.isPending} onClick={() => { setTouched(true); if (urlOk && events.length && app) create.mutate(); }}>{t("common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
