import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { TableSkeleton } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, Plan } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/plans")({
  head: () => pageHead("Subscriptions & Plans", "Plan catalogue and tenant subscriptions."),
  component: () => <RequirePermission permission="platform.plans"><Plans /></RequirePermission>,
});

function Plans() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const q = useQuery(queries.plans());
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ plan: Plan; status: Plan["status"] } | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    description: "",
    status: "active" as Plan["status"],
    tpsLimit: "",
    sms: "",
    whatsapp: "",
    email: "",
    bulkMessaging: false,
    apiAccess: true,
    webhooks: false,
    reporting: true,
  });
  const save = useMutation({
    mutationFn: (input: Omit<Plan, "id" | "tenants">) => editingId ? api.updatePlan(editingId, input) : api.createPlan(input),
    onSuccess: async (plan) => {
      toast.success(t(editingId ? "plans.saved" : "plans.created"));
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      setOpen(false);
      setError("");
      setSelected(plan);
    },
    onError: () => setError(t("plans.codeExists")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { plan: Plan; status: Plan["status"] }) => api.setPlanStatus(input.plan.id, input.status),
    onSuccess: async (_, input) => { toast.success(t(input.status === "archived" ? "plans.archived" : "plans.statusChanged")); await queryClient.invalidateQueries({ queryKey: ["plans"] }); setSelected({ ...input.plan, status: input.status }); setStatusTarget(null); },
  });
  const normalizedCode = draft.code.trim().toUpperCase();
  const numberValues = [draft.sms, draft.whatsapp, draft.email, draft.tpsLimit].map(Number);
  const validCode = /^[A-Z0-9-]{2,32}$/.test(normalizedCode);
  const validNumbers = [draft.sms, draft.whatsapp, draft.email, draft.tpsLimit].every((value) => value !== "") && numberValues.every((value) => Number.isFinite(value) && value >= 0) && Number(draft.tpsLimit) > 0;
  const valid = validCode && draft.name.trim().length > 0 && validNumbers;
  const toggleFeature = (key: "bulkMessaging" | "apiAccess" | "webhooks" | "reporting", checked: boolean) =>
    setDraft((current) => ({ ...current, [key]: checked }));
  const submit = () => {
    setTouched(true);
    setError("");
    if (!valid) return;
    save.mutate({
      code: normalizedCode,
      name: draft.name.trim(),
      description: draft.description.trim(),
      status: draft.status,
      tpsLimit: Number(draft.tpsLimit),
      entitlements: (["sms", "whatsapp", "email"] as Channel[]).map((channel) => ({
        channel,
        monthly: Number(draft[channel]),
      })),
      bulkMessaging: draft.bulkMessaging,
      apiAccess: draft.apiAccess,
      webhooks: draft.webhooks,
      reporting: draft.reporting,
      features: [],
    });
  };
  const openCreate = () => {
    setEditingId(null);
    setDraft({ code: "", name: "", description: "", status: "active", tpsLimit: "", sms: "", whatsapp: "", email: "", bulkMessaging: false, apiAccess: true, webhooks: false, reporting: true });
    setTouched(false);
    setError("");
    setOpen(true);
  };
  const openEdit = (plan: Plan) => {
    setSelected(null);
    setEditingId(plan.id);
    setDraft({ code: plan.code, name: plan.name, description: plan.description, status: plan.status === "archived" ? "inactive" : plan.status, tpsLimit: String(plan.tpsLimit), sms: String(plan.entitlements.find((item) => item.channel === "sms")?.monthly ?? 0), whatsapp: String(plan.entitlements.find((item) => item.channel === "whatsapp")?.monthly ?? 0), email: String(plan.entitlements.find((item) => item.channel === "email")?.monthly ?? 0), bulkMessaging: plan.bulkMessaging, apiAccess: plan.apiAccess, webhooks: plan.webhooks, reporting: plan.reporting });
    setTouched(false);
    setError("");
    setOpen(true);
  };
  const features = [
    ["bulkMessaging", "plans.bulkMessaging"],
    ["apiAccess", "plans.apiAccess"],
    ["webhooks", "plans.webhooks"],
    ["reporting", "plans.reporting"],
  ] as const;
  return (
    <>
      <PageHeader title={t("plans.title")} description={t("plans.subtitle")} actions={can("platform.plans.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("plans.new")}</Button>} />
      <PageBody>
        {!q.data ? <TableSkeleton /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {q.data.map((p) => (
              <Section key={p.id} title={p.name} description={t("plans.tenants", { count: p.tenants })} actions={<div className="flex items-center gap-2"><StatusBadge status={p.status} /><Button variant="ghost" size="sm" onClick={() => setSelected(p)}>{t("common.view")}</Button></div>}>
                <div className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.code} · {t("plans.tps")}: {formatNumber(p.tpsLimit, locale)}</p>
                  <div className="text-label">{t("plans.monthly")}</div>
                  <ul className="space-y-1.5">{p.entitlements.map((e) => (
                    <li key={e.channel} className="flex items-center justify-between text-sm"><ChannelLabel channel={e.channel} /><span className="tabular-nums font-medium">{formatNumber(e.monthly, locale)}</span></li>))}</ul>
                  <ul className="space-y-1 border-t pt-3">{[[p.bulkMessaging, "plans.bulkMessaging"], [p.apiAccess, "plans.apiAccess"], [p.webhooks, "plans.webhooks"], [p.reporting, "plans.reporting"]].filter(([enabled]) => enabled).map(([, key]) => <li key={String(key)} className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><Check className="size-3.5 text-success" />{t(key as MessageKey)}</li>)}{p.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><Check className="size-3.5 text-success" />{feature}</li>)}</ul>
                </div>
              </Section>
            ))}
          </div>
        )}
      </PageBody>
      <Sheet open={open} onOpenChange={(value) => !save.isPending && setOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t(editingId ? "plans.editTitle" : "plans.createTitle")}</SheetTitle>
            <SheetDescription>{t(editingId ? "plans.editDescription" : "plans.createDescription")}</SheetDescription>
          </SheetHeader>
          <form className="flex flex-col gap-5 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("plans.details")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-code">{t("plans.code")} <span className="text-danger">*</span></Label>
                  <Input id="plan-code" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} aria-invalid={touched && !validCode} autoCapitalize="characters" />
                  {touched && !validCode && <p className="text-xs text-danger">{t("plans.invalidCode")}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-name">{t("plans.name")} <span className="text-danger">*</span></Label>
                  <Input id="plan-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={touched && !draft.name.trim()} />
                  {touched && !draft.name.trim() && <p className="text-xs text-danger">{t("plans.required")}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-description">{t("common.description")}</Label>
                <Textarea id="plan-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} />
              </div>
              <div className="space-y-1.5"><Label>{t("common.status")}</Label><Select value={draft.status === "archived" ? "inactive" : draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as Plan["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t("status.active")}</SelectItem><SelectItem value="draft">{t("status.draft")}</SelectItem><SelectItem value="inactive">{t("status.inactive")}</SelectItem></SelectContent></Select></div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("plans.entitlements")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["sms", "whatsapp", "email"] as Channel[]).map((channel) => (
                  <div className="space-y-1.5" key={channel}>
                    <Label htmlFor={`plan-${channel}`}>{t(`channel.${channel}`)} {t("plans.monthly")}</Label>
                    <Input id={`plan-${channel}`} type="number" min="0" step="1" value={draft[channel]} onChange={(event) => setDraft({ ...draft, [channel]: event.target.value })} aria-invalid={touched && (!draft[channel] || Number(draft[channel]) < 0)} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="plan-tps">{t("plans.tps")} <span className="text-danger">*</span></Label>
                  <Input id="plan-tps" type="number" min="1" step="1" value={draft.tpsLimit} onChange={(event) => setDraft({ ...draft, tpsLimit: event.target.value })} aria-invalid={touched && (!draft.tpsLimit || Number(draft.tpsLimit) <= 0)} />
                </div>
              </div>
              {touched && !validNumbers && <p className="text-xs text-danger">{t("plans.invalidNumber")}</p>}
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("plans.features")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {features.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={draft[key]} onCheckedChange={(checked) => toggleFeature(key, checked === true)} />
                    {t(label as MessageKey)}
                  </label>
                ))}
              </div>
            </section>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "common.create")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {selected.code}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><div className="flex items-center gap-2"><StatusBadge status={selected.status} /><span>{t("plans.tenants", { count: selected.tenants })}</span></div><p className="text-sm text-muted-foreground">{selected.description}</p><dl className="grid grid-cols-2 gap-3 text-sm">{selected.entitlements.map((item) => <div key={item.channel}><dt className="text-label">{t(`channel.${item.channel}`)}</dt><dd>{formatNumber(item.monthly, locale)} / {t("plans.monthly")}</dd></div>)}<div><dt className="text-label">{t("plans.tps")}</dt><dd>{selected.tpsLimit}</dd></div></dl>{can("platform.plans.manage") && selected.status !== "archived" && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{selected.status === "active" ? <Button variant="outline" onClick={() => setStatusTarget({ plan: selected, status: "inactive" })}>{t("plans.deactivate")}</Button> : <Button variant="outline" onClick={() => setStatusTarget({ plan: selected, status: "active" })}>{t("plans.activate")}</Button>}<Button variant="destructive" onClick={() => setStatusTarget({ plan: selected, status: "archived" })}>{t("plans.archive")}</Button></div>}</div></>}</SheetContent></Sheet>
      <AlertDialog open={!!statusTarget} onOpenChange={(value) => !value && setStatusTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(statusTarget?.status === "archived" ? "plans.archiveTitle" : "plans.statusTitle")}</AlertDialogTitle><AlertDialogDescription>{t(statusTarget?.status === "archived" ? "plans.archiveBody" : "plans.statusBody", { name: statusTarget?.plan.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (statusTarget) changeStatus.mutate(statusTarget); }} disabled={changeStatus.isPending}>{t(statusTarget?.status === "archived" ? "plans.archive" : statusTarget?.status === "active" ? "plans.activate" : "plans.deactivate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
