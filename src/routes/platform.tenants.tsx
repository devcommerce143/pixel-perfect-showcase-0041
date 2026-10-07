import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
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
import type { Channel, Plan, PlanFeatureKey, QuotaPolicy, Tenant, TenantDirectoryItem, TenantEntitlementOverrides, TenantSortField, TenantStatus, TenantUpsertInput } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatNumber, formatPercent } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

const CHANNELS: Channel[] = ["sms", "whatsapp", "email"];
const FEATURE_LABEL_KEYS = {
  api_access: "plans.apiAccess",
  bulk_messaging: "plans.bulkMessaging",
  webhooks: "plans.webhooks",
  reporting: "plans.reporting",
  audit_export: "plans.auditExport",
  dedicated_sender_identities: "plans.dedicatedSenders",
} satisfies Record<PlanFeatureKey, MessageKey>;

interface TenantForm {
  name: string;
  code: string;
  status: TenantStatus;
  dataRegion: string;
  defaultLanguage: "en" | "ar";
  timezone: string;
  planId: string;
  notes: string;
  firstName: string;
  lastName: string;
  firstNameArabic: string;
  lastNameArabic: string;
  email: string;
  mobileNumber: string;
  jobTitle: string;
  department: string;
  preferredLanguage: "en" | "ar";
}

function emptyTenantForm(planId = ""): TenantForm {
  return {
    name: "", code: "", status: "trial", dataRegion: "KSA-Central", defaultLanguage: "en", timezone: "Asia/Riyadh", planId, notes: "",
    firstName: "", lastName: "", firstNameArabic: "", lastNameArabic: "", email: "", mobileNumber: "", jobTitle: "", department: "", preferredLanguage: "en",
  };
}

export const Route = createFileRoute("/platform/tenants")({
  head: () => pageHead("Clients / Tenants", "All tenant organizations on the Dolf Connect platform with plan, volume and quota status."),
  component: () => <RequirePermission permission="platform.tenants"><Tenants /></RequirePermission>,
});

function Tenants() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Tenant["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<TenantSortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TenantDirectoryItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ tenant: TenantDirectoryItem; status: TenantStatus } | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<TenantForm>(emptyTenantForm());
  const [customizeLimits, setCustomizeLimits] = useState(false);
  const [disabledChannels, setDisabledChannels] = useState<Channel[]>([]);
  const [monthlyOverrides, setMonthlyOverrides] = useState<Channel[]>([]);
  const [monthlyValues, setMonthlyValues] = useState<Record<Channel, string>>({ sms: "", whatsapp: "", email: "" });
  const [overrideTps, setOverrideTps] = useState(false);
  const [tpsValue, setTpsValue] = useState("");
  const [overrideQuotaPolicy, setOverrideQuotaPolicy] = useState(false);
  const [quotaPolicy, setQuotaPolicy] = useState<QuotaPolicy>("hard_stop");

  const listQuery = { page, pageSize, search, filters: { status }, sortBy, sortDirection };
  const q = useQuery(queries.tenants(listQuery));
  const plans = useQuery(queries.plans());
  const selectedPlan = plans.data?.find((plan) => plan.id === form.planId);

  const initializeOverrides = (plan: Plan | undefined, overrides: TenantEntitlementOverrides | null = null) => {
    const defaults = Object.fromEntries(CHANNELS.map((channel) => [channel, String(plan?.entitlements.find((entry) => entry.channel === channel)?.monthly ?? 0)])) as Record<Channel, string>;
    for (const channel of CHANNELS) {
      const quota = overrides?.channels?.[channel]?.monthly;
      if (quota !== undefined) defaults[channel] = String(quota);
    }
    setCustomizeLimits(!!overrides);
    setDisabledChannels(CHANNELS.filter((channel) => overrides?.channels?.[channel]?.enabled === false));
    setMonthlyOverrides(CHANNELS.filter((channel) => overrides?.channels?.[channel]?.monthly !== undefined));
    setMonthlyValues(defaults);
    setOverrideTps(overrides?.tpsLimit !== undefined);
    setTpsValue(String(overrides?.tpsLimit ?? plan?.tpsLimit ?? ""));
    setOverrideQuotaPolicy(overrides?.quotaPolicy !== undefined);
    setQuotaPolicy(overrides?.quotaPolicy ?? plan?.quotaPolicy ?? "hard_stop");
  };

  const applyPlan = (planId: string) => {
    setForm((current) => ({ ...current, planId }));
    initializeOverrides(plans.data?.find((plan) => plan.id === planId));
    setPendingPlanId(null);
  };

  const buildOverrides = (): TenantEntitlementOverrides | null => {
    if (!customizeLimits || !selectedPlan) return null;
    const channels: NonNullable<TenantEntitlementOverrides["channels"]> = {};
    for (const channel of CHANNELS) {
      const planEntitlement = selectedPlan.entitlements.find((entry) => entry.channel === channel);
      if (!planEntitlement?.enabled) continue;
      if (disabledChannels.includes(channel)) channels[channel] = { enabled: false };
      else if (monthlyOverrides.includes(channel)) channels[channel] = { monthly: Number(monthlyValues[channel]) };
    }
    const overrides: TenantEntitlementOverrides = {
      ...(Object.keys(channels).length ? { channels } : {}),
      ...(overrideTps ? { tpsLimit: Number(tpsValue) } : {}),
      ...(overrideQuotaPolicy ? { quotaPolicy } : {}),
    };
    return Object.keys(overrides).length ? overrides : null;
  };

  const save = useMutation({
    mutationFn: (input: TenantUpsertInput) => editingId ? api.updateTenant(editingId, input) : api.createTenant(input),
    onSuccess: async () => {
      toast.success(t(editingId ? "ten.saved" : "ten.created"));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["tenants"] }), queryClient.invalidateQueries({ queryKey: ["plans"] })]);
      setOpen(false);
      setError("");
    },
    onError: (saveError) => {
      const message = saveError instanceof Error ? saveError.message.toLowerCase() : "";
      setError(message.includes("email") ? t("ten.emailExists") : message.includes("code") ? t("ten.codeExists") : t("ten.saveError"));
    },
  });

  const changeStatus = useMutation({
    mutationFn: (input: { tenant: TenantDirectoryItem; status: TenantStatus }) => api.setTenantStatus(input.tenant.id, input.status),
    onSuccess: async (_, input) => {
      toast.success(t(input.status === "suspended" ? "ten.suspended" : "ten.reactivated"));
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setSelected((current) => current ? { ...current, status: input.status } : null);
      setStatusTarget(null);
    },
  });

  const toggleSort = (field: TenantSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "name" || field === "plan" ? "asc" : "desc");
    setSortBy(field);
    setPage(1);
  };

  const normalizedCode = form.code.trim().toUpperCase();
  const validCode = /^[A-Z0-9-]{2,32}$/.test(normalizedCode);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const planEligible = !!selectedPlan && (selectedPlan.status === "active" || selectedPlan.id === editingPlanId);
  const validOverrideLimits = !customizeLimits || (
    (!overrideTps || (/^\d+$/.test(tpsValue) && Number.isSafeInteger(Number(tpsValue)) && Number(tpsValue) > 0)) &&
    monthlyOverrides.filter((channel) => !disabledChannels.includes(channel)).every((channel) => selectedPlan?.entitlements.some((entry) => entry.channel === channel && entry.enabled) && /^\d+$/.test(monthlyValues[channel]) && Number.isSafeInteger(Number(monthlyValues[channel])) && Number(monthlyValues[channel]) >= 0)
  );
  const valid = form.name.trim().length > 0 && validCode && form.dataRegion.trim().length > 0 && form.timezone.trim().length > 0 && planEligible && form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && validEmail && validOverrideLimits;

  const openOnboarding = () => {
    const plan = plans.data?.find((item) => item.status === "active");
    setSelected(null);
    setEditingId(null);
    setEditingPlanId(null);
    setForm(emptyTenantForm(plan?.id));
    initializeOverrides(plan);
    setTouched(false);
    setError("");
    setOpen(true);
  };

  const openEdit = (tenant: TenantDirectoryItem) => {
    setSelected(null);
    setEditingId(tenant.id);
    setEditingPlanId(tenant.subscription.planId);
    const profile = tenant.primaryAdministrator;
    const nameParts = profile?.name.split(" ") ?? [];
    setForm({
      name: tenant.name, code: tenant.code, status: tenant.status, dataRegion: tenant.dataRegion || tenant.region,
      defaultLanguage: tenant.defaultLanguage, timezone: tenant.timezone, planId: tenant.subscription.planId, notes: tenant.notes,
      firstName: profile?.firstName || nameParts[0] || "", lastName: profile?.lastName || nameParts.slice(1).join(" "),
      firstNameArabic: profile?.firstNameArabic ?? "", lastNameArabic: profile?.lastNameArabic ?? "", email: profile?.email ?? "",
      mobileNumber: profile?.mobileNumber ?? "", jobTitle: profile?.jobTitle ?? "", department: profile?.department ?? "",
      preferredLanguage: profile?.preferredLanguage ?? tenant.defaultLanguage,
    });
    initializeOverrides(plans.data?.find((plan) => plan.id === tenant.subscription.planId), tenant.subscription.overrides);
    setTouched(false);
    setError("");
    setOpen(true);
  };

  const selectPlan = (planId: string) => {
    if (planId === form.planId) return;
    if (editingId && buildOverrides()) {
      setPendingPlanId(planId);
      return;
    }
    applyPlan(planId);
  };

  const submit = () => {
    setTouched(true);
    if (!valid || !selectedPlan) return;
    const primaryAdministrator = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      ...(form.firstNameArabic.trim() ? { firstNameArabic: form.firstNameArabic.trim() } : {}),
      ...(form.lastNameArabic.trim() ? { lastNameArabic: form.lastNameArabic.trim() } : {}),
      email: form.email.trim(),
      ...(form.mobileNumber.trim() ? { mobileNumber: form.mobileNumber.trim() } : {}),
      ...(form.jobTitle.trim() ? { jobTitle: form.jobTitle.trim() } : {}),
      ...(form.department.trim() ? { department: form.department.trim() } : {}),
      preferredLanguage: form.preferredLanguage,
    };
    save.mutate({
      code: normalizedCode, name: form.name.trim(), status: form.status, region: form.dataRegion.trim(), dataRegion: form.dataRegion.trim(),
      defaultLanguage: form.defaultLanguage, timezone: form.timezone.trim(), notes: form.notes.trim(), planId: selectedPlan.id,
      overrides: buildOverrides(), primaryAdministrator,
    });
  };

  const columns: Column<TenantDirectoryItem>[] = [
    { id: "name", header: <SortableHeader label={t("common.name")} field="name" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("name")} />, cell: (tenant) => <div><div className="font-medium">{tenant.name}</div><div className="font-mono text-xs text-muted-foreground">{t("ten.id")}: {tenant.id} | {tenant.code}</div></div> },
    { id: "plan", header: <SortableHeader label={t("ten.plan")} field="plan" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("plan")} />, cell: (tenant) => tenant.planName },
    { id: "status", header: <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} />, cell: (tenant) => <StatusBadge status={tenant.status} /> },
    { id: "users", header: t("ten.users"), cell: (tenant) => <span className="tabular-nums">{tenant.users}</span>, className: "hidden md:table-cell" },
    { id: "vol", header: t("ten.volume"), cell: (tenant) => <span className="tabular-nums">{formatNumber(tenant.messages30d, locale)}</span> },
    { id: "quota", header: <SortableHeader label={t("ten.quota")} field="quotaPct" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("quotaPct")} />, cell: (tenant) => <div className="flex w-36 items-center gap-2"><QuotaBar pct={tenant.quotaPct} className="flex-1" /><span className="w-10 text-end text-xs tabular-nums">{formatPercent(tenant.quotaPct, locale, 0)}</span></div> },
    { id: "region", header: t("ten.region"), cell: (tenant) => <span className="text-muted-foreground">{tenant.dataRegion}</span>, className: "hidden lg:table-cell" },
  ];

  const eligiblePlans = (plans.data ?? []).filter((plan) => plan.status === "active" || plan.id === editingPlanId);
  const requestedPlan = plans.data?.find((plan) => plan.id === pendingPlanId);

  return (
    <>
      <PageHeader title={t("ten.title")} description={t("ten.subtitle")} actions={can("platform.tenants.manage") && <Button size="sm" onClick={openOnboarding}><Plus className="size-4" />{t("ten.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("common.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as Tenant["status"] | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, ...(["trial", "active", "suspended", "inactive"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(tenant) => tenant.id} onRowClick={setSelected} />
          {q.data && <ListPagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
      </PageBody>

      <Sheet open={open} onOpenChange={(value) => !save.isPending && setOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader><SheetTitle>{t(editingId ? "ten.edit" : "ten.new")}</SheetTitle><SheetDescription>{t(editingId ? "ten.editDescription" : "ten.onboardDescription")}</SheetDescription></SheetHeader>
          <form className="flex flex-col gap-5 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.organization")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tenant-name">{t("ten.organizationName")} *</Label><Input id="tenant-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-invalid={touched && !form.name.trim()} />{touched && !form.name.trim() && <p className="text-xs text-danger">{t("ten.required")}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-code">{t("ten.code")} *</Label><Input id="tenant-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} aria-invalid={touched && !validCode} />{touched && !validCode && <p className="text-xs text-danger">{t("ten.invalidCode")}</p>}</div>
                <div className="space-y-1.5"><Label>{t("common.status")}</Label>{editingId ? <StatusBadge status={form.status} /> : <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as TenantStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trial">{t("status.trial")}</SelectItem><SelectItem value="active">{t("status.active")}</SelectItem></SelectContent></Select>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-region">{t("ten.dataRegion")} *</Label><Input id="tenant-region" value={form.dataRegion} onChange={(event) => setForm({ ...form, dataRegion: event.target.value })} aria-invalid={touched && !form.dataRegion.trim()} /></div>
                <div className="space-y-1.5"><Label>{t("ten.language")}</Label><Select value={form.defaultLanguage} onValueChange={(value) => setForm({ ...form, defaultLanguage: value as TenantForm["defaultLanguage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-timezone">{t("ten.timezone")} *</Label><Input id="tenant-timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} aria-invalid={touched && !form.timezone.trim()} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.administrator")}</h3><p className="text-xs text-muted-foreground">{t("ten.clientAdminRole")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tenant-first-name">{t("users.firstNameEn")} *</Label><Input id="tenant-first-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} aria-invalid={touched && !form.firstName.trim()} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-last-name">{t("users.lastNameEn")} *</Label><Input id="tenant-last-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} aria-invalid={touched && !form.lastName.trim()} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-first-name-ar">{t("users.firstNameAr")}</Label><Input id="tenant-first-name-ar" dir="rtl" value={form.firstNameArabic} onChange={(event) => setForm({ ...form, firstNameArabic: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-last-name-ar">{t("users.lastNameAr")}</Label><Input id="tenant-last-name-ar" dir="rtl" value={form.lastNameArabic} onChange={(event) => setForm({ ...form, lastNameArabic: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-email">{t("common.email")} *</Label><Input id="tenant-email" type="email" dir="ltr" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} aria-invalid={touched && !validEmail} />{touched && !validEmail && <p className="text-xs text-danger">{t("ten.invalidEmail")}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-mobile">{t("users.mobile")}</Label><Input id="tenant-mobile" type="tel" dir="ltr" value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-job">{t("users.jobTitle")}</Label><Input id="tenant-job" value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-department">{t("users.department")}</Label><Input id="tenant-department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t("users.preferredLanguage")}</Label><Select value={form.preferredLanguage} onValueChange={(value) => setForm({ ...form, preferredLanguage: value as TenantForm["preferredLanguage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.subscription")}</h3>
              <div className="space-y-1.5"><Label>{t("ten.plan")} *</Label><Select value={form.planId} onValueChange={selectPlan}><SelectTrigger><SelectValue placeholder={t("ten.selectPlan")} /></SelectTrigger><SelectContent>{eligiblePlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}{plan.status !== "active" ? ` (${t(`status.${plan.status}`)})` : ""}</SelectItem>)}</SelectContent></Select></div>
              {!selectedPlan && touched && <p className="text-xs text-danger">{t("ten.planRequired")}</p>}
              {selectedPlan && <>
                <div className="space-y-2 rounded-md border p-3">
                  <h4 className="text-sm font-medium">{t("ten.channels")}</h4>
                  {CHANNELS.map((channel) => {
                    const entitlement = selectedPlan.entitlements.find((item) => item.channel === channel);
                    const planEnabled = entitlement?.enabled ?? false;
                    const planMonthly = planEnabled ? entitlement?.monthly ?? 0 : 0;
                    const tenantEnabled = planEnabled && !(customizeLimits && disabledChannels.includes(channel));
                    const effectiveMonthly = tenantEnabled ? customizeLimits && monthlyOverrides.includes(channel) ? Number(monthlyValues[channel]) : planMonthly : 0;
                    return <div key={channel} className="grid gap-2 border-t py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div><div className="text-sm font-medium">{t(`channel.${channel}`)}</div><div className="text-xs text-muted-foreground">{t("ten.planDefault")}: {planEnabled ? t("plans.enabled") : t("plans.notEnabled")} | {formatNumber(planMonthly, locale)} {t("ten.monthly")}</div><div className="text-xs text-muted-foreground">{t("ten.effective")}: {tenantEnabled ? t("plans.enabled") : t("plans.notEnabled")} | {formatNumber(effectiveMonthly, locale)} {t("ten.monthly")}</div></div>
                      {customizeLimits && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <label className="flex items-center gap-2 text-xs"><Checkbox checked={tenantEnabled} disabled={!planEnabled} onCheckedChange={(checked) => setDisabledChannels((current) => checked ? current.filter((item) => item !== channel) : [...current.filter((item) => item !== channel), channel])} />{t("ten.channelEnabled")}</label>
                        <label className="flex items-center gap-2 text-xs"><Checkbox checked={monthlyOverrides.includes(channel)} disabled={!tenantEnabled} onCheckedChange={(checked) => setMonthlyOverrides((current) => checked ? [...current.filter((item) => item !== channel), channel] : current.filter((item) => item !== channel))} />{t("ten.overrideQuota")}</label>
                        <Input aria-label={`${t(`channel.${channel}`)} ${t("ten.overrideQuota")}`} className="h-8 w-32" type="number" min="0" step="1" value={monthlyValues[channel]} disabled={!tenantEnabled || !monthlyOverrides.includes(channel)} aria-invalid={touched && monthlyOverrides.includes(channel) && (!/^\d+$/.test(monthlyValues[channel]) || Number(monthlyValues[channel]) < 0)} onChange={(event) => setMonthlyValues((current) => ({ ...current, [channel]: event.target.value }))} />
                      </div>}
                    </div>;
                  })}
                  <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
                    <div className="space-y-2"><div className="text-sm font-medium">{t("ten.tps")}</div><div className="text-xs text-muted-foreground">{t("ten.planDefault")}: {formatNumber(selectedPlan.tpsLimit, locale)} | {t("ten.effective")}: {formatNumber(customizeLimits && overrideTps && tpsValue ? Number(tpsValue) : selectedPlan.tpsLimit, locale)}</div>{customizeLimits && <div className="flex items-center gap-2"><Checkbox checked={overrideTps} onCheckedChange={(checked) => setOverrideTps(!!checked)} /><Input aria-label={t("ten.tps")} className="h-8 w-32" type="number" min="1" step="1" value={tpsValue} disabled={!overrideTps} aria-invalid={touched && overrideTps && (!/^\d+$/.test(tpsValue) || Number(tpsValue) < 1)} onChange={(event) => setTpsValue(event.target.value)} /></div>}</div>
                    <div className="space-y-2"><div className="text-sm font-medium">{t("plans.quotaPolicy")}</div><div className="text-xs text-muted-foreground">{t("ten.planDefault")}: {t(`usage.policy.${selectedPlan.quotaPolicy}`)} | {t("ten.effective")}: {t(`usage.policy.${customizeLimits && overrideQuotaPolicy ? quotaPolicy : selectedPlan.quotaPolicy}`)}</div>{customizeLimits && <div className="flex items-center gap-2"><Checkbox checked={overrideQuotaPolicy} onCheckedChange={(checked) => setOverrideQuotaPolicy(!!checked)} /><Select value={quotaPolicy} onValueChange={(value) => setQuotaPolicy(value as QuotaPolicy)}><SelectTrigger className="h-8 w-36" disabled={!overrideQuotaPolicy}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hard_stop">{t("usage.policy.hard_stop")}</SelectItem><SelectItem value="soft_cap">{t("usage.policy.soft_cap")}</SelectItem></SelectContent></Select></div>}</div>
                  </div>
                  <div className="border-t pt-3"><h4 className="mb-2 text-sm font-medium">{t("plans.features")}</h4>{selectedPlan.features.length ? <ul className="flex flex-wrap gap-2">{selectedPlan.features.map((feature) => <li key={feature} className="rounded border px-2 py-1 text-xs">{t(FEATURE_LABEL_KEYS[feature])}</li>)}</ul> : <p className="text-xs text-muted-foreground">{t("ten.noFeatures")}</p>}</div>
                </div>
                <label className="flex items-start gap-2 text-sm"><Checkbox checked={customizeLimits} onCheckedChange={(checked) => { const enabled = !!checked; setCustomizeLimits(enabled); if (!enabled) initializeOverrides(selectedPlan); }} /><span>{t("ten.customizeLimits")}</span></label>
              </>}
              {touched && !validOverrideLimits && <p className="text-xs text-danger">{t("ten.invalidLimits")}</p>}
            </section>

            <section className="space-y-3"><h3 className="text-sm font-semibold">{t("common.notes")}</h3><Textarea id="tenant-notes" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></section>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "ten.new")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          {selected && <>
            <SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{t("ten.id")}: {selected.id} | {t("ten.code")}: {selected.code}</SheetDescription></SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <section className="space-y-3"><h3 className="text-sm font-semibold">{t("ten.organization")}</h3><div className="flex items-center gap-2"><StatusBadge status={selected.status} /><span className="text-sm">{selected.dataRegion}</span></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.language")}</dt><dd>{selected.defaultLanguage === "ar" ? "العربية" : "English"}</dd></div><div><dt className="text-label">{t("ten.timezone")}</dt><dd dir="ltr" className="text-start">{selected.timezone}</dd></div><div><dt className="text-label">{t("ten.createdAt")}</dt><dd>{new Date(selected.createdAt).toLocaleString(locale)}</dd></div><div><dt className="text-label">{t("ten.updatedAt")}</dt><dd>{new Date(selected.updatedAt).toLocaleString(locale)}</dd></div></dl></section>
              <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("ten.subscription")}</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.plan")}</dt><dd>{selected.planName} <span className="text-xs text-muted-foreground">({t(`status.${selected.planStatus}`)})</span></dd></div><div><dt className="text-label">{t("ten.subscriptionStatus")}</dt><dd><StatusBadge status={selected.subscription.status} /></dd></div></div><dl className="space-y-3">{CHANNELS.map((channel) => {
                const planDefault = selected.planDefaults.channels[channel];
                const effective = selected.effectiveEntitlements.channels[channel];
                const override = selected.subscription.overrides?.channels?.[channel];
                return <div key={channel} className="flex flex-col gap-1 border-t pt-2 text-sm"><dt className="font-medium">{t(`channel.${channel}`)}</dt><dd className="text-muted-foreground">{t("ten.planDefault")}: {planDefault.enabled ? t("plans.enabled") : t("plans.notEnabled")} | {formatNumber(planDefault.monthly, locale)} {t("ten.monthly")}</dd>{override && <dd className="text-muted-foreground">{t("ten.tenantOverride")}: {override.enabled === false ? t("plans.notEnabled") : override.monthly !== undefined ? formatNumber(override.monthly, locale) : t("ten.restrictedOnly")}</dd>}<dd>{t("ten.effective")}: {effective.enabled ? t("plans.enabled") : t("plans.notEnabled")} | {formatNumber(effective.monthly, locale)} {t("ten.monthly")}</dd></div>;
              })}</dl><div className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.tps")}</dt><dd>{t("ten.planDefault")}: {formatNumber(selected.planDefaults.tpsLimit, locale)} | {t("ten.effective")}: {formatNumber(selected.effectiveEntitlements.tpsLimit, locale)}</dd></div><div><dt className="text-label">{t("plans.quotaPolicy")}</dt><dd>{t("ten.planDefault")}: {t(`usage.policy.${selected.planDefaults.quotaPolicy}`)} | {t("ten.effective")}: {t(`usage.policy.${selected.effectiveEntitlements.quotaPolicy}`)}</dd></div></div><div><dt className="text-label">{t("ten.overrides")}</dt><dd>{selected.subscription.overrides ? t("ten.customOverrides") : t("ten.noOverrides")}</dd></div><div><h4 className="mb-2 text-sm font-medium">{t("plans.features")}</h4><ul className="flex flex-wrap gap-2">{selected.effectiveEntitlements.features.map((feature) => <li key={feature} className="rounded border px-2 py-1 text-xs">{t(FEATURE_LABEL_KEYS[feature])}</li>)}</ul></div></section>
              <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("ten.administrator")}</h3>{selected.primaryAdministrator ? <><p className="font-medium">{selected.primaryAdministrator.name}</p><p dir="ltr" className="text-start text-sm">{selected.primaryAdministrator.email}</p><dl className="grid grid-cols-2 gap-3 text-sm">{selected.primaryAdministrator.mobileNumber && <div><dt className="text-label">{t("users.mobile")}</dt><dd dir="ltr" className="text-start">{selected.primaryAdministrator.mobileNumber}</dd></div>}{selected.primaryAdministrator.jobTitle && <div><dt className="text-label">{t("users.jobTitle")}</dt><dd>{selected.primaryAdministrator.jobTitle}</dd></div>}{selected.primaryAdministrator.department && <div><dt className="text-label">{t("users.department")}</dt><dd>{selected.primaryAdministrator.department}</dd></div>}<div><dt className="text-label">{t("common.role")}</dt><dd>{t("ten.clientAdminRole")}</dd></div></dl></> : <p className="text-sm text-muted-foreground">{t("ten.noAdministrator")}</p>}</section>
              <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("ten.usageSummary")}</h3><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.users")}</dt><dd>{formatNumber(selected.users, locale)}</dd></div><div><dt className="text-label">{t("ten.applications")}</dt><dd>{formatNumber(selected.applications, locale)}</dd></div><div><dt className="text-label">{t("ten.volume")}</dt><dd>{formatNumber(selected.messages30d, locale)}</dd></div><div><dt className="text-label">{t("ten.quota")}</dt><dd>{formatPercent(selected.quotaPct, locale, 0)}</dd></div></dl></section>
              {can("platform.tenants.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{selected.status === "suspended" || selected.status === "inactive" ? <Button variant="outline" disabled={changeStatus.isPending} onClick={() => setStatusTarget({ tenant: selected, status: "active" })}>{t("ten.reactivate")}</Button> : <Button variant="outline" disabled={changeStatus.isPending} onClick={() => setStatusTarget({ tenant: selected, status: "suspended" })}>{t("ten.suspend")}</Button>}</div>}
            </div>
          </>}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!statusTarget} onOpenChange={(value) => !value && setStatusTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(statusTarget?.status === "suspended" ? "ten.suspendTitle" : "ten.reactivateTitle")}</AlertDialogTitle><AlertDialogDescription>{statusTarget?.status === "suspended" ? t("ten.suspendBody", { name: statusTarget.tenant.name }) : t("ten.reactivateBody", { name: statusTarget?.tenant.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (statusTarget) changeStatus.mutate(statusTarget); }} disabled={changeStatus.isPending}>{t(statusTarget?.status === "suspended" ? "ten.suspend" : "ten.reactivate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={!!pendingPlanId} onOpenChange={(value) => !value && setPendingPlanId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("ten.planChangeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("ten.planChangeBody", { plan: requestedPlan?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (pendingPlanId) applyPlan(pendingPlanId); }} disabled={!pendingPlanId}>{t("ten.clearOverridesChangePlan")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}