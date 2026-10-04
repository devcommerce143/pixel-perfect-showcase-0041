import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { QuotaBar } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import type { Channel, Tenant } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/tenants")({
  head: () => pageHead("Clients / Tenants", "All tenant organizations on the Dolf Connect platform with plan, volume and quota status."),
  component: () => <RequirePermission permission="platform.tenants"><Tenants /></RequirePermission>,
});

function Tenants() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["sms"]);
  const [form, setForm] = useState({
    name: "", code: "", status: "trial" as Tenant["status"], plan: "", region: "KSA-Central",
    contactName: "", contactEmail: "", defaultLanguage: "en" as Tenant["defaultLanguage"], timezone: "Asia/Riyadh",
    sms: "", whatsapp: "", email: "", tpsLimit: "", notes: "",
  });
  const q = useQuery(queries.tenants({ search, status, pageSize: 50 }));
  const plans = useQuery(queries.plans());
  const save = useMutation({
    mutationFn: (input: Omit<Tenant, "id" | "users" | "applications" | "messages30d" | "quotaPct" | "createdAt">) => editingId ? api.updateTenant(editingId, input) : api.createTenant(input),
    onSuccess: async (tenant) => {
      toast.success(t(editingId ? "ten.saved" : "ten.created"));
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setOpen(false);
      setError("");
      setSelected(tenant);
    },
    onError: (error) => setError(error instanceof Error && error.message.includes("email") ? t("ten.emailExists") : t("ten.codeExists")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { tenant: Tenant; status: Tenant["status"] }) => api.setTenantStatus(input.tenant.id, input.status),
    onSuccess: async (_, input) => { toast.success(t(input.status === "suspended" ? "ten.suspended" : "ten.reactivated")); await queryClient.invalidateQueries({ queryKey: ["tenants"] }); setSelected({ ...input.tenant, status: input.status }); setSuspendTarget(null); },
  });
  const normalizedCode = form.code.trim().toUpperCase();
  const validCode = /^[A-Z0-9-]{2,32}$/.test(normalizedCode);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim());
  const limits = [form.sms, form.whatsapp, form.email, form.tpsLimit];
  const validLimits = limits.every((value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) && Number(form.tpsLimit) > 0;
  const valid = form.name.trim().length > 0 && validCode && form.plan.length > 0 && form.contactName.trim().length > 0 && validEmail && channels.length > 0 && validLimits;
  const openOnboarding = () => {
    setEditingId(null);
    const plan = plans.data?.find((item) => item.status === "active");
    const entitlement = (channel: Channel) => String(plan?.entitlements.find((item) => item.channel === channel)?.monthly ?? 0);
    setForm({
      name: "", code: "", status: "trial", plan: plan?.name ?? "", region: "KSA-Central", contactName: "", contactEmail: "",
      defaultLanguage: "en", timezone: "Asia/Riyadh", sms: entitlement("sms"), whatsapp: entitlement("whatsapp"), email: entitlement("email"), tpsLimit: String(plan?.tpsLimit ?? 1), notes: "",
    });
    setChannels(["sms"]);
    setTouched(false);
    setError("");
    setOpen(true);
  };
  const openEdit = (tenant: Tenant) => {
    setSelected(null);
    setEditingId(tenant.id);
    setForm({ name: tenant.name, code: tenant.code, status: tenant.status, plan: tenant.plan, region: tenant.region, contactName: tenant.contactName, contactEmail: tenant.contactEmail, defaultLanguage: tenant.defaultLanguage, timezone: tenant.timezone, sms: String(tenant.quotas.sms), whatsapp: String(tenant.quotas.whatsapp), email: String(tenant.quotas.email), tpsLimit: String(tenant.tpsLimit), notes: tenant.notes });
    setChannels([...tenant.enabledChannels]);
    setTouched(false);
    setError("");
    setOpen(true);
  };
  const selectPlan = (name: string) => {
    const plan = plans.data?.find((item) => item.name === name);
    setForm((current) => ({
      ...current,
      plan: name,
      sms: String(plan?.entitlements.find((item) => item.channel === "sms")?.monthly ?? 0),
      whatsapp: String(plan?.entitlements.find((item) => item.channel === "whatsapp")?.monthly ?? 0),
      email: String(plan?.entitlements.find((item) => item.channel === "email")?.monthly ?? 0),
      tpsLimit: String(plan?.tpsLimit ?? 1),
    }));
  };
  const submit = () => {
    setTouched(true);
    if (!valid) return;
    save.mutate({
      code: normalizedCode, name: form.name.trim(), status: form.status, plan: form.plan, region: form.region.trim(),
      contactName: form.contactName.trim(), contactEmail: form.contactEmail.trim(), enabledChannels: channels,
      defaultLanguage: form.defaultLanguage, timezone: form.timezone.trim(),
      quotas: { sms: Number(form.sms), whatsapp: Number(form.whatsapp), email: Number(form.email) }, tpsLimit: Number(form.tpsLimit), notes: form.notes.trim(),
    });
  };
  const columns: Column<Tenant>[] = [
    { id: "name", header: t("common.name"), cell: (r) => (<div><div className="font-medium">{r.name}</div><div className="font-mono text-xs text-muted-foreground">{r.id}</div></div>) },
    { id: "plan", header: t("ten.plan"), cell: (r) => r.plan },
    { id: "status", header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
    { id: "users", header: t("ten.users"), cell: (r) => <span className="tabular-nums">{r.users}</span>, className: "hidden md:table-cell" },
    { id: "vol", header: t("ten.volume"), cell: (r) => <span className="tabular-nums">{formatNumber(r.messages30d, locale)}</span> },
    { id: "quota", header: t("ten.quota"), cell: (r) => (
      <div className="flex w-36 items-center gap-2"><QuotaBar pct={r.quotaPct} className="flex-1" /><span className="w-10 text-end text-xs tabular-nums">{formatPercent(r.quotaPct, locale, 0)}</span></div>) },
    { id: "region", header: t("ten.region"), cell: (r) => <span className="text-muted-foreground">{r.region}</span>, className: "hidden lg:table-cell" },
  ];
  return (
    <>
      <PageHeader title={t("ten.title")} description={t("ten.subtitle")} actions={can("platform.tenants.manage") && <Button size="sm" onClick={openOnboarding}><Plus className="size-4" />{t("ten.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("common.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={setStatus}
              options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "trial", "suspended"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(r) => r.id} onRowClick={setSelected} />
        </Section>
      </PageBody>
      <Sheet open={open} onOpenChange={(value) => !save.isPending && setOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t(editingId ? "ten.edit" : "ten.new")}</SheetTitle>
            <SheetDescription>{t(editingId ? "ten.editDescription" : "ten.onboardDescription")}</SheetDescription>
          </SheetHeader>
          <form className="flex flex-col gap-5 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.organization")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tenant-name">{t("ten.organizationName")} *</Label><Input id="tenant-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-invalid={touched && !form.name.trim()} />{touched && !form.name.trim() && <p className="text-xs text-danger">{t("ten.required")}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-code">{t("ten.code")} *</Label><Input id="tenant-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} aria-invalid={touched && !validCode} />{touched && !validCode && <p className="text-xs text-danger">{t("ten.invalidCode")}</p>}</div>
                <div className="space-y-1.5"><Label>{t("common.status")}</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as Tenant["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trial">{t("status.trial")}</SelectItem><SelectItem value="active">{t("status.active")}</SelectItem>{editingId && <SelectItem value="suspended">{t("status.suspended")}</SelectItem>}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-region">{t("ten.region")}</Label><Input id="tenant-region" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t("ten.language")}</Label><Select value={form.defaultLanguage} onValueChange={(value) => setForm({ ...form, defaultLanguage: value as Tenant["defaultLanguage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-timezone">{t("ten.timezone")}</Label><Input id="tenant-timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.administrator")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tenant-contact">{t("ten.contactName")} *</Label><Input id="tenant-contact" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} aria-invalid={touched && !form.contactName.trim()} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-email">{t("common.email")} *</Label><Input id="tenant-email" type="email" dir="ltr" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} aria-invalid={touched && !validEmail} />{touched && !validEmail && <p className="text-xs text-danger">{t("ten.invalidEmail")}</p>}</div>
              </div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.subscription")}</h3>
              <div className="space-y-1.5"><Label>{t("ten.plan")}</Label><Select value={form.plan} onValueChange={selectPlan}><SelectTrigger><SelectValue placeholder={t("ten.selectPlan")} /></SelectTrigger><SelectContent>{(plans.data ?? []).filter((plan) => plan.status === "active").map((plan) => <SelectItem key={plan.id} value={plan.name}>{plan.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>{t("ten.channels")}</Label><div className="flex flex-wrap gap-4">{(["sms", "whatsapp", "email"] as Channel[]).map((channel) => <label key={channel} className="flex items-center gap-2 text-sm"><Checkbox checked={channels.includes(channel)} onCheckedChange={(checked) => setChannels((current) => checked ? [...current, channel] : current.filter((item) => item !== channel))} />{t(`channel.${channel}`)}</label>)}</div>{touched && !channels.length && <p className="text-xs text-danger">{t("ten.selectChannel")}</p>}</div>
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.limits")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["sms", "whatsapp", "email"] as Channel[]).map((channel) => <div key={channel} className="space-y-1.5"><Label htmlFor={`tenant-${channel}`}>{t(`channel.${channel}`)} {t("ten.quotaLimit")}</Label><Input id={`tenant-${channel}`} type="number" min="0" step="1" value={form[channel]} onChange={(event) => setForm({ ...form, [channel]: event.target.value })} /></div>)}
                <div className="space-y-1.5"><Label htmlFor="tenant-tps">{t("ten.tps")}</Label><Input id="tenant-tps" type="number" min="1" step="1" value={form.tpsLimit} onChange={(event) => setForm({ ...form, tpsLimit: event.target.value })} /></div>
              </div>
              {touched && !validLimits && <p className="text-xs text-danger">{t("ten.invalidLimits")}</p>}
              <div className="space-y-1.5"><Label htmlFor="tenant-notes">{t("common.notes")}</Label><Textarea id="tenant-notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            </section>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "ten.new")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {selected.code}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><div className="flex items-center gap-2"><StatusBadge status={selected.status} /><span>{selected.plan}</span></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.users")}</dt><dd>{selected.users}</dd></div><div><dt className="text-label">{t("ten.applications")}</dt><dd>{selected.applications}</dd></div><div><dt className="text-label">{t("ten.contactName")}</dt><dd>{selected.contactName}</dd></div><div><dt className="text-label">{t("common.email")}</dt><dd dir="ltr" className="text-start">{selected.contactEmail}</dd></div><div><dt className="text-label">{t("ten.region")}</dt><dd>{selected.region}</dd></div><div><dt className="text-label">{t("ten.tps")}</dt><dd>{selected.tpsLimit}</dd></div></dl><div><h3 className="mb-2 text-sm font-semibold">{t("ten.channels")}</h3><div className="flex flex-wrap gap-2">{selected.enabledChannels.map((channel) => <ChannelLabel key={channel} channel={channel} />)}</div></div><div><h3 className="mb-2 text-sm font-semibold">{t("ten.limits")}</h3><ul className="space-y-1 text-sm">{(["sms", "whatsapp", "email"] as Channel[]).map((channel) => <li key={channel} className="flex justify-between"><span>{t(`channel.${channel}`)}</span><span className="tabular-nums">{formatNumber(selected.quotas[channel], locale)}</span></li>)}</ul></div>{can("platform.tenants.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{selected.status === "suspended" ? <Button variant="outline" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate({ tenant: selected, status: "active" })}>{t("ten.reactivate")}</Button> : <Button variant="destructive" onClick={() => setSuspendTarget(selected)}>{t("ten.suspend")}</Button>}</div>}</div></>}</SheetContent></Sheet>
      <AlertDialog open={!!suspendTarget} onOpenChange={(value) => !value && setSuspendTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("ten.suspendTitle")}</AlertDialogTitle><AlertDialogDescription>{t("ten.suspendBody", { name: suspendTarget?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (suspendTarget) changeStatus.mutate({ tenant: suspendTarget, status: "suspended" }); }} disabled={changeStatus.isPending}>{t("ten.suspend")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
