import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState, ErrorState } from "@/components/app/States";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http/errors";
import { tenantCreateErrorMessage } from "@/lib/api/tenant-create-error";
import { tenantPlanAssignmentErrorMessage } from "@/lib/api/tenant-plan-assignment-error";
import { tenantProfileErrorMessage } from "@/lib/api/tenant-profile-error";
import { tenantStatusErrorMessage } from "@/lib/api/tenant-status-error";
import { eligibleTenantAssignmentPlans } from "@/lib/api/tenant-assignment-plans";
import { filterTenantDirectory, paginateTenantDirectory } from "@/lib/api/tenant-directory-filter";
import { QuotaBar } from "@/features/usage/QuotaMeter";
import { queries } from "@/lib/api/queries";
import type { Channel, EntitlementBlocker, EntitlementValueSource, Plan, PlanFeatureKey, QuotaPolicy, Tenant, TenantCatalogItem, TenantDetail, TenantDirectoryItem, TenantEntitlementOverrides, TenantPlanAssignmentStatus, TenantProfileUpdateInput, TenantSortField, TenantStatus, TenantSubscriptionView, TenantUpsertInput } from "@/lib/api/types";
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
const BLOCKER_LABEL_KEYS = {
  TENANT_SUSPENDED: "ten.blockerTenantSuspended",
  TENANT_INACTIVE: "ten.blockerTenantInactive",
  SUBSCRIPTION_MISSING: "ten.blockerSubscriptionMissing",
  SUBSCRIPTION_PENDING: "ten.blockerSubscriptionPending",
  SUBSCRIPTION_CANCELLED: "ten.blockerSubscriptionCancelled",
  SUBSCRIPTION_NOT_STARTED: "ten.blockerSubscriptionNotStarted",
  SUBSCRIPTION_ENDED: "ten.blockerSubscriptionEnded",
} satisfies Record<EntitlementBlocker, MessageKey>;
const SOURCE_LABEL_KEYS = {
  plan: "ten.sourcePlan",
  subscription: "ten.sourceSubscription",
  channel: "ten.sourceChannel",
  unavailable: "ten.sourceUnavailable",
} satisfies Record<EntitlementValueSource, MessageKey>;

function TenantSubscriptionPanel({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: TenantSubscriptionView | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t, locale } = useI18n();
  if (isPending) {
    return <p role="status" className="border-t px-4 pt-4 text-sm text-muted-foreground">{t("ten.subscriptionLoading")}</p>;
  }
  if (isError) {
    return <div className="border-t pt-4"><ErrorState onRetry={onRetry} /></div>;
  }
  if (!data) return null;

  const subscription = data.subscription;
  const effective = data.effective;
  const displayNumber = (value: number | null) =>
    value === null ? t("ten.unavailable") : formatNumber(value, locale);

  return (
    <section className="space-y-4 border-t pt-4">
      <h3 className="text-sm font-semibold">{t("ten.subscription")}</h3>
      {subscription ? <>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-label">{t("ten.plan")}</dt><dd>{subscription.plan.name} <span className="text-xs text-muted-foreground">({t(`status.${subscription.plan.status}`)})</span></dd></div>
          <div><dt className="text-label">{t("ten.code")}</dt><dd className="font-mono text-xs">{subscription.plan.code}</dd></div>
          <div><dt className="text-label">{t("ten.subscriptionStatus")}</dt><dd><StatusBadge status={subscription.status} /></dd></div>
          <div><dt className="text-label">{t("ten.subscriptionStartsAt")}</dt><dd>{new Date(subscription.startsAt).toLocaleString(locale)}</dd></div>
          {subscription.endsAt && <div><dt className="text-label">{t("ten.subscriptionEndsAt")}</dt><dd>{new Date(subscription.endsAt).toLocaleString(locale)}</dd></div>}
        </dl>
        <div className="space-y-2">
          <h4 className="text-sm font-medium">{t("ten.overrides")}</h4>
          {subscription.tpsLimitOverride !== null || subscription.quotaPolicyOverride !== null || subscription.channelOverrides.length > 0
            ? <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {subscription.tpsLimitOverride !== null && <div><dt className="text-label">{t("ten.tps")}</dt><dd>{formatNumber(subscription.tpsLimitOverride, locale)}</dd></div>}
                {subscription.quotaPolicyOverride !== null && <div><dt className="text-label">{t("plans.quotaPolicy")}</dt><dd>{t(`usage.policy.${subscription.quotaPolicyOverride}`)}</dd></div>}
                {subscription.channelOverrides.map((override) => <div key={override.channel}>
                  <dt className="text-label">{t(`channel.${override.channel}`)}</dt>
                  <dd>{[
                    override.enabledOverride !== null ? `${t("ten.channelEnabled")}: ${t(override.enabledOverride ? "plans.enabled" : "plans.notEnabled")}` : null,
                    override.monthlyQuotaOverride !== null ? `${t("ten.monthly")}: ${formatNumber(override.monthlyQuotaOverride, locale)}` : null,
                    override.tpsOverride !== null ? `${t("ten.tps")}: ${formatNumber(override.tpsOverride, locale)}` : null,
                  ].filter(Boolean).join(" | ")}</dd>
                </div>)}
              </dl>
            : <p className="text-sm text-muted-foreground">{t("ten.noOverrides")}</p>}
        </div>
      </> : <p role="status" className="text-sm text-muted-foreground">{t("ten.noCurrentSubscription")}</p>}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">{t("ten.effectiveEntitlements")}</h4>
        <div className="flex flex-wrap gap-2 text-sm">
          <span>{t("ten.configured")}: {t(effective.configured ? "plans.enabled" : "plans.notEnabled")}</span>
          <span>{t("ten.operational")}: {t(effective.operational ? "plans.enabled" : "plans.notEnabled")}</span>
          {effective.quotaPolicy !== null &&           <span>{t("plans.quotaPolicy")}: {t(`usage.policy.${effective.quotaPolicy}`)} {effective.quotaPolicySource && <span className="text-muted-foreground">({t(SOURCE_LABEL_KEYS[effective.quotaPolicySource])})</span>}</span>}
          {effective.tpsLimit !== null && <span>{t("ten.tps")}: {formatNumber(effective.tpsLimit, locale)} {effective.tpsSource && <span className="text-muted-foreground">({t(SOURCE_LABEL_KEYS[effective.tpsSource])})</span>}</span>}
        </div>
        {effective.blockers.length > 0 && <ul className="list-inside list-disc text-sm text-muted-foreground">
          {effective.blockers.map((blocker) => <li key={blocker}>{t(BLOCKER_LABEL_KEYS[blocker])}</li>)}
        </ul>}
        {effective.features.length > 0
          ? <ul className="flex flex-wrap gap-2">{effective.features.map((feature) => <li key={feature} className="rounded border px-2 py-1 text-xs">{t(FEATURE_LABEL_KEYS[feature])}</li>)}</ul>
          : <p className="text-xs text-muted-foreground">{t("ten.noFeatures")}</p>}
        <dl className="space-y-2">
          {effective.channels.map((channel) => <div key={channel.channel} className="border-t pt-2 text-sm">
            <dt className="font-medium">{t(`channel.${channel.channel}`)}</dt>
            <dd>{t("ten.channelAvailability")}: {t(channel.enabled ? "plans.enabled" : "plans.notEnabled")}</dd>
            <dd>{t("ten.quotaLimit")}: {displayNumber(channel.monthlyQuota)} {t("ten.monthly")} <span className="text-muted-foreground">({t(SOURCE_LABEL_KEYS[channel.quotaSource])})</span></dd>
            <dd>{t("ten.tps")}: {displayNumber(channel.tpsLimit)} <span className="text-muted-foreground">({t(SOURCE_LABEL_KEYS[channel.tpsSource])})</span></dd>
            {channel.ignoredOverride && <dd className="text-muted-foreground">{t("ten.ignoredOverride")}</dd>}
          </div>)}
        </dl>
      </div>
    </section>
  );
}

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

function asDirectoryItem(tenant: TenantCatalogItem): TenantDirectoryItem | null {
  return isDirectoryItem(tenant) ? tenant : null;
}

function isDirectoryItem(tenant: TenantCatalogItem): tenant is TenantDirectoryItem {
  return "subscription" in tenant &&
    "planName" in tenant &&
    "planCode" in tenant &&
    "planStatus" in tenant &&
    "planDefaults" in tenant &&
    "effectiveEntitlements" in tenant &&
    "primaryAdministrator" in tenant &&
    "primaryAdministratorId" in tenant &&
    "users" in tenant &&
    "applications" in tenant &&
    "messages30d" in tenant &&
    "quotaPct" in tenant;
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
  const { can, mode: apiMode } = useSession();
  const queryClient = useQueryClient();
  const submissionPendingRef = useRef(false);
  const profileSubmissionPendingRef = useRef(false);
  const statusSubmissionPendingRef = useRef(false);
  const planAssignmentPendingRef = useRef(false);
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
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ tenant: Pick<TenantCatalogItem, "id" | "name" | "status">; status: TenantStatus } | null>(null);
  const [statusError, setStatusError] = useState("");
  const [planAssignmentOpen, setPlanAssignmentOpen] = useState(false);
  const [planAssignmentPlanId, setPlanAssignmentPlanId] = useState("");
  const [planAssignmentStatus, setPlanAssignmentStatus] = useState<TenantPlanAssignmentStatus>("active");
  const [planAssignmentError, setPlanAssignmentError] = useState("");
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [profileTenant, setProfileTenant] = useState<TenantDetail | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", notes: "", defaultLanguage: "en" as "en" | "ar", timezone: "" });
  const [profileTouched, setProfileTouched] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [form, setForm] = useState<TenantForm>(emptyTenantForm());
  const [customizeLimits, setCustomizeLimits] = useState(false);
  const [disabledChannels, setDisabledChannels] = useState<Channel[]>([]);
  const [monthlyOverrides, setMonthlyOverrides] = useState<Channel[]>([]);
  const [monthlyValues, setMonthlyValues] = useState<Record<Channel, string>>({ sms: "", whatsapp: "", email: "" });
  const [overrideTps, setOverrideTps] = useState(false);
  const [tpsValue, setTpsValue] = useState("");
  const [overrideQuotaPolicy, setOverrideQuotaPolicy] = useState(false);
  const [quotaPolicy, setQuotaPolicy] = useState<QuotaPolicy>("hard_stop");

  const listQuery = apiMode === "live"
    ? { page, pageSize }
    : { page, pageSize, search: search.trim(), filters: { status }, sortBy, sortDirection };
  const q = useQuery({
    ...queries.tenants(listQuery),
    enabled: apiMode === "mock",
  });
  const tenantCatalogQuery = useQuery({
    ...queries.tenantOptions(),
    enabled: apiMode === "live",
  });
  const filteredLiveTenants = tenantCatalogQuery.data
    ? filterTenantDirectory(tenantCatalogQuery.data, search, status)
    : undefined;
  const directoryPage = apiMode === "live"
    ? filteredLiveTenants
      ? paginateTenantDirectory(filteredLiveTenants, page, pageSize)
      : undefined
    : q.data;
  const directoryError = apiMode === "live" ? tenantCatalogQuery.isError : q.isError;
  const directoryLoading = apiMode === "live" ? tenantCatalogQuery.isFetching : q.isFetching;
  const retryDirectory = () => {
    if (apiMode === "live") void tenantCatalogQuery.refetch();
    else void q.refetch();
  };
  const tenantDetailQuery = useQuery(queries.tenant(selectedTenantId ?? ""));
  const tenantSubscriptionQuery = useQuery(
    queries.tenantSubscription(selectedTenantId ?? "", apiMode === "live"),
  );
  const selectedTenant = selected ?? tenantDetailQuery.data ?? null;
  const plans = useQuery(queries.plans({ page: 1, pageSize: 100 }));
  const planCatalog = plans.data?.items;
  const selectedPlan = planCatalog?.find((plan) => plan.id === form.planId);
  const assignmentPlans = useQuery(
    queries.tenantAssignmentPlans(planAssignmentOpen && apiMode === "live"),
  );
  const assignablePlans = eligibleTenantAssignmentPlans(
    assignmentPlans.data,
    tenantSubscriptionQuery.data?.subscription?.planId,
  );

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
    initializeOverrides(planCatalog?.find((plan) => plan.id === planId));
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
    retry: false,
    onSuccess: async () => {
      toast.success(t(editingId ? "ten.saved" : apiMode === "live" ? "ten.createdLive" : "ten.created"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenants"] }),
        ...(apiMode === "mock" ? [queryClient.invalidateQueries({ queryKey: ["plans"] })] : []),
      ]);
      setOpen(false);
      setError("");
    },
    onError: (saveError) => {
      const message = saveError instanceof Error ? saveError.message.toLowerCase() : "";
      setError(apiMode === "live"
        ? t(tenantCreateErrorMessage(saveError))
        : message.includes("email") ? t("ten.emailExists")
        : apiMode === "mock" && message.includes("code") ? t("ten.codeExists")
        : t("ten.saveError"));
    },
    onSettled: () => {
      submissionPendingRef.current = false;
    },
  });

  const profileSave = useMutation({
    mutationFn: (variables: { id: string; input: TenantProfileUpdateInput }) =>
      api.updateTenantProfile(variables.id, variables.input),
    retry: false,
    onSuccess: async () => {
      toast.success(t("ten.profileSaved"));
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setProfileTenant(null);
      setProfileError("");
    },
    onError: (saveError) => {
      setProfileError(t(tenantProfileErrorMessage(saveError)));
    },
    onSettled: () => {
      profileSubmissionPendingRef.current = false;
    },
  });

  const changeStatus = useMutation({
    mutationFn: (input: { tenant: Pick<TenantCatalogItem, "id" | "name" | "status">; status: TenantStatus }) => api.setTenantStatus(input.tenant.id, input.status),
    retry: false,
    onSuccess: async (_, input) => {
      toast.success(t(input.status === "suspended" ? "ten.suspended" : "ten.reactivated"));
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      if (apiMode === "mock") {
        setSelected((current) => current ? { ...current, status: input.status } : null);
      }
      setStatusTarget(null);
      setStatusError("");
    },
    onError: (statusChangeError) => setStatusError(t(tenantStatusErrorMessage(statusChangeError))),
    onSettled: () => {
      statusSubmissionPendingRef.current = false;
    },
  });

  const assignPlan = useMutation({
    mutationFn: (variables: { tenantId: string; planId: string; status: TenantPlanAssignmentStatus }) =>
      api.assignTenantPlan(variables.tenantId, {
        planId: variables.planId,
        status: variables.status,
      }),
    retry: false,
    onSuccess: async () => {
      toast.success(t("ten.assignmentSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setPlanAssignmentOpen(false);
      setPlanAssignmentPlanId("");
      setPlanAssignmentStatus("active");
      setPlanAssignmentError("");
    },
    onError: (assignmentError) => {
      setPlanAssignmentError(t(tenantPlanAssignmentErrorMessage(assignmentError)));
    },
    onSettled: () => {
      planAssignmentPendingRef.current = false;
    },
  });

  const openPlanAssignment = () => {
    if (
      apiMode !== "live" ||
      !can("platform.tenants.manage") ||
      !selectedTenantId ||
      !tenantDetailQuery.data ||
      !tenantSubscriptionQuery.isSuccess
    ) return;
    setPlanAssignmentPlanId("");
    setPlanAssignmentStatus("active");
    setPlanAssignmentError("");
    setPlanAssignmentOpen(true);
  };

  const submitPlanAssignment = () => {
    if (
      planAssignmentPendingRef.current ||
      apiMode !== "live" ||
      !can("platform.tenants.manage") ||
      !selectedTenantId ||
      !tenantDetailQuery.data ||
      !tenantSubscriptionQuery.isSuccess ||
      !assignablePlans.some((plan) => plan.id === planAssignmentPlanId)
    ) return;
    planAssignmentPendingRef.current = true;
    assignPlan.mutate({
      tenantId: tenantDetailQuery.data.id,
      planId: planAssignmentPlanId,
      status: planAssignmentStatus,
    });
  };

  const requestStatusChange = (tenant: Pick<TenantCatalogItem, "id" | "name" | "status">) => {
    const status = tenant.status === "suspended" || tenant.status === "inactive" ? "active" : "suspended";
    setStatusError("");
    setStatusTarget({ tenant, status });
  };

  const submitStatusChange = () => {
    if (statusSubmissionPendingRef.current || !statusTarget) return;
    statusSubmissionPendingRef.current = true;
    changeStatus.mutate(statusTarget);
  };

  const toggleSort = (field: TenantSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "name" || field === "plan" ? "asc" : "desc");
    setSortBy(field);
    setPage(1);
  };

  const normalizedCode = form.code.trim().toUpperCase();
  const validCode = apiMode === "live"
    ? /^[A-Z0-9][A-Z0-9-]{0,30}[A-Z0-9]$/.test(normalizedCode)
    : /^[A-Z0-9-]{2,32}$/.test(normalizedCode);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const planEligible = !!selectedPlan && (selectedPlan.status === "active" || selectedPlan.id === editingPlanId);
  const validOverrideLimits = !customizeLimits || (
    (!overrideTps || (/^\d+$/.test(tpsValue) && Number.isSafeInteger(Number(tpsValue)) && Number(tpsValue) > 0)) &&
    monthlyOverrides.filter((channel) => !disabledChannels.includes(channel)).every((channel) => selectedPlan?.entitlements.some((entry) => entry.channel === channel && entry.enabled) && /^\d+$/.test(monthlyValues[channel]) && Number.isSafeInteger(Number(monthlyValues[channel])) && Number(monthlyValues[channel]) >= 0)
  );
  const liveFieldsValid = apiMode !== "live" || (
    form.name.trim().length <= 200 &&
    form.dataRegion.trim().length <= 64 &&
    form.timezone.trim().length <= 64 &&
    form.notes.length <= 4000 &&
    form.firstName.trim().length <= 100 &&
    form.lastName.trim().length <= 100 &&
    form.firstNameArabic.trim().length <= 100 &&
    form.lastNameArabic.trim().length <= 100 &&
    form.email.trim().length <= 320 &&
    form.mobileNumber.trim().length <= 32
  );
  const requiresPlan = apiMode === "mock" || !!editingId;
  const valid = form.name.trim().length > 0 && liveFieldsValid && validCode && form.dataRegion.trim().length > 0 && form.timezone.trim().length > 0 && (!requiresPlan || planEligible) && form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && validEmail && (apiMode === "live" || validOverrideLimits);

  const openOnboarding = () => {
    const plan = planCatalog?.find((item) => item.status === "active");
    setSelected(null);
    setSelectedTenantId(null);
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
    setSelectedTenantId(null);
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
    initializeOverrides(planCatalog?.find((plan) => plan.id === tenant.subscription.planId), tenant.subscription.overrides);
    setTouched(false);
    setError("");
    setOpen(true);
  };

  const openLiveProfileEdit = (tenant: TenantDetail) => {
    setSelectedTenantId(null);
    setProfileTenant(tenant);
    setProfileForm({
      name: tenant.name,
      notes: tenant.notes ?? "",
      defaultLanguage: tenant.defaultLanguage,
      timezone: tenant.timezone,
    });
    setProfileTouched(false);
    setProfileError("");
  };

  const submitProfile = () => {
    if (profileSubmissionPendingRef.current || !profileTenant) return;
    setProfileTouched(true);
    const name = profileForm.name.trim();
    const timezone = profileForm.timezone.trim();
    const notes = profileForm.notes.trim();
    if (!name || name.length > 200 || !timezone || timezone.length > 64 || notes.length > 4000) return;

    profileSubmissionPendingRef.current = true;
    profileSave.mutate({
      id: profileTenant.id,
      input: {
        name,
        notes: notes || null,
        defaultLanguage: profileForm.defaultLanguage,
        timezone,
      },
    });
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
    if (submissionPendingRef.current) return;
    setTouched(true);
    if (!valid || (apiMode !== "live" && !selectedPlan)) return;
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
    submissionPendingRef.current = true;
    save.mutate({
      code: normalizedCode, name: form.name.trim(), status: form.status, region: form.dataRegion.trim(), dataRegion: form.dataRegion.trim(),
      defaultLanguage: form.defaultLanguage, timezone: form.timezone.trim(), notes: form.notes.trim(), planId: selectedPlan?.id ?? "",
      overrides: apiMode === "live" ? null : buildOverrides(), primaryAdministrator,
    });
  };

  const columns: Column<TenantCatalogItem>[] = [
    { id: "name", header: apiMode === "mock" ? <SortableHeader label={t("common.name")} field="name" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("name")} /> : t("common.name"), cell: (tenant) => <div><div className="font-medium">{tenant.name}</div><div className="font-mono text-xs text-muted-foreground">{t("ten.id")}: {tenant.id} | {tenant.code}</div></div> },
    ...(apiMode === "mock" ? [
      { id: "plan", header: <SortableHeader label={t("ten.plan")} field="plan" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("plan")} />, cell: (tenant: TenantCatalogItem) => asDirectoryItem(tenant)?.planName ?? t("ten.unavailable"), className: "" },
    ] : []),
    { id: "status", header: apiMode === "mock" ? <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} /> : t("common.status"), cell: (tenant) => <StatusBadge status={tenant.status} /> },
    ...(apiMode === "mock" ? [
      { id: "users", header: t("ten.users"), cell: (tenant: TenantCatalogItem) => <span className="tabular-nums">{asDirectoryItem(tenant)?.users ?? t("ten.unavailable")}</span>, className: "hidden md:table-cell" },
      { id: "vol", header: t("ten.volume"), cell: (tenant: TenantCatalogItem) => <span className="tabular-nums">{asDirectoryItem(tenant) ? formatNumber(asDirectoryItem(tenant)!.messages30d, locale) : t("ten.unavailable")}</span>, className: "" },
      { id: "quota", header: <SortableHeader label={t("ten.quota")} field="quotaPct" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("quotaPct")} />, cell: (tenant: TenantCatalogItem) => { const item = asDirectoryItem(tenant); return item ? <div className="flex w-36 items-center gap-2"><QuotaBar pct={item.quotaPct} className="flex-1" /><span className="w-10 text-end text-xs tabular-nums">{formatPercent(item.quotaPct, locale, 0)}</span></div> : t("ten.unavailable"); }, className: "" },
    ] : []),
    { id: "region", header: t("ten.region"), cell: (tenant) => <span className="text-muted-foreground">{tenant.dataRegion}</span>, className: "hidden lg:table-cell" },
  ];

  const eligiblePlans = (planCatalog ?? []).filter((plan) => plan.status === "active" || plan.id === editingPlanId);
  const requestedPlan = planCatalog?.find((plan) => plan.id === pendingPlanId);

  return (
    <>
      <PageHeader title={t("ten.title")} description={t("ten.subtitle")} actions={can("platform.tenants.manage") && <Button size="sm" onClick={openOnboarding}><Plus className="size-4" />{t("ten.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("ten.searchDirectory")}>
            {search.length > 0 && <Button type="button" size="icon" variant="ghost" aria-label={t("ten.clearSearch")} onClick={() => { setSearch(""); setPage(1); }}>
              <X aria-hidden />
            </Button>}
            <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as Tenant["status"] | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, ...(["trial", "active", "suspended", "inactive"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} />
            {(search.trim().length > 0 || status !== "all") && <Button type="button" size="sm" variant="outline" onClick={() => { setSearch(""); setStatus("all"); setPage(1); }}>
              {t("ten.clearFilters")}
            </Button>}
          </TableToolbar>
          {apiMode === "live" && <p className="border-b px-4 py-2 text-xs text-muted-foreground">{t("ten.liveListLimits")}</p>}
          {directoryError && <ErrorState onRetry={retryDirectory} />}
          {directoryError && !directoryPage ? null : apiMode === "live" &&
            tenantCatalogQuery.isSuccess &&
            tenantCatalogQuery.data.length === 0 &&
            search.trim().length === 0 &&
            status === "all"
            ? <EmptyState title={t("ten.emptyLive")} />
            : directoryPage?.total === 0
              ? <EmptyState title={t("ten.noMatches")} body={t("common.noResultsHint")} />
              : <DataTable columns={columns} rows={directoryPage?.items} loading={directoryLoading} rowKey={(tenant) => tenant.id} onRowClick={(tenant) => {
                if (apiMode === "mock") {
                  const item = asDirectoryItem(tenant);
                  if (item) setSelected(item);
                } else {
                  setSelectedTenantId(tenant.id);
                }
              }} />}
          {directoryPage && directoryPage.total > 0 && <ListPagination page={directoryPage.page} pageSize={directoryPage.pageSize} total={directoryPage.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
      </PageBody>

      <Sheet open={open} onOpenChange={(value) => !save.isPending && setOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader><SheetTitle>{t(editingId ? "ten.edit" : "ten.new")}</SheetTitle><SheetDescription>{t(editingId ? "ten.editDescription" : "ten.onboardDescription")}</SheetDescription></SheetHeader>
          <form className="flex flex-col gap-5 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.organization")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tenant-name">{t("ten.organizationName")} *</Label><Input id="tenant-name" maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-invalid={touched && !form.name.trim()} />{touched && !form.name.trim() && <p className="text-xs text-danger">{t("ten.required")}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-code">{t("ten.code")} *</Label><Input id="tenant-code" maxLength={32} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} aria-invalid={touched && !validCode} />{touched && !validCode && <p className="text-xs text-danger">{t(apiMode === "live" ? "ten.invalidCodeLive" : "ten.invalidCode")}</p>}</div>
                <div className="space-y-1.5"><Label>{t("common.status")}</Label>{editingId ? <StatusBadge status={form.status} /> : <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as TenantStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trial">{t("status.trial")}</SelectItem><SelectItem value="active">{t("status.active")}</SelectItem></SelectContent></Select>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-region">{t("ten.dataRegion")} *</Label><Input id="tenant-region" maxLength={64} value={form.dataRegion} onChange={(event) => setForm({ ...form, dataRegion: event.target.value })} aria-invalid={touched && !form.dataRegion.trim()} /></div>
                <div className="space-y-1.5"><Label>{t("ten.language")}</Label><Select value={form.defaultLanguage} onValueChange={(value) => setForm({ ...form, defaultLanguage: value as TenantForm["defaultLanguage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-timezone">{t("ten.timezone")} *</Label><Input id="tenant-timezone" maxLength={64} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} aria-invalid={touched && !form.timezone.trim()} /></div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.administrator")}</h3><p className="text-xs text-muted-foreground">{t("ten.clientAdminRole")}</p>
              {apiMode === "live" && !editingId && <p className="text-xs text-muted-foreground">{t("ten.liveAdminNoInvitation")}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="tenant-first-name">{t("users.firstNameEn")} *</Label><Input id="tenant-first-name" maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} aria-invalid={touched && !form.firstName.trim()} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-last-name">{t("users.lastNameEn")} *</Label><Input id="tenant-last-name" maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} aria-invalid={touched && !form.lastName.trim()} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-first-name-ar">{t("users.firstNameAr")}</Label><Input id="tenant-first-name-ar" maxLength={100} dir="rtl" value={form.firstNameArabic} onChange={(event) => setForm({ ...form, firstNameArabic: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-last-name-ar">{t("users.lastNameAr")}</Label><Input id="tenant-last-name-ar" maxLength={100} dir="rtl" value={form.lastNameArabic} onChange={(event) => setForm({ ...form, lastNameArabic: event.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="tenant-email">{t("common.email")} *</Label><Input id="tenant-email" maxLength={320} type="email" dir="ltr" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} aria-invalid={touched && !validEmail} />{touched && !validEmail && <p className="text-xs text-danger">{t("ten.invalidEmail")}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="tenant-mobile">{t("users.mobile")}</Label><Input id="tenant-mobile" maxLength={32} type="tel" dir="ltr" value={form.mobileNumber} onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })} /></div>
                {apiMode === "mock" && <div className="space-y-1.5"><Label htmlFor="tenant-job">{t("users.jobTitle")}</Label><Input id="tenant-job" value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} /></div>}
                {apiMode === "mock" && <div className="space-y-1.5"><Label htmlFor="tenant-department">{t("users.department")}</Label><Input id="tenant-department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></div>}
                <div className="space-y-1.5"><Label>{t("users.preferredLanguage")}</Label><Select value={form.preferredLanguage} onValueChange={(value) => setForm({ ...form, preferredLanguage: value as TenantForm["preferredLanguage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
              </div>
            </section>

            {apiMode === "live" && !editingId
              ? <section className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("ten.subscription")}</h3>
                  <p className="text-sm text-muted-foreground">{t("ten.liveCreateNoPlan")}</p>
                </section>
              : <section className="space-y-3">
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
                </section>}

            <section className="space-y-3"><h3 className="text-sm font-semibold">{t("common.notes")}</h3><Textarea id="tenant-notes" rows={2} maxLength={4000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></section>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "ten.new")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={!!profileTenant} onOpenChange={(value) => {
        if (!value && !profileSave.isPending) {
          setProfileTenant(null);
          setProfileError("");
        }
      }}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t("ten.edit")}</SheetTitle>
            <SheetDescription>{t("ten.editDescription")}</SheetDescription>
          </SheetHeader>
          {profileTenant && <form className="flex flex-col gap-5 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); submitProfile(); }} noValidate>
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("ten.organization")}</h3>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-profile-name">{t("ten.organizationName")} *</Label>
                <Input
                  id="tenant-profile-name"
                  maxLength={200}
                  value={profileForm.name}
                  aria-invalid={profileTouched && !profileForm.name.trim()}
                  onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                />
                {profileTouched && !profileForm.name.trim() && <p className="text-xs text-danger">{t("ten.required")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("ten.language")}</Label>
                <Select
                  value={profileForm.defaultLanguage}
                  onValueChange={(value) => setProfileForm({ ...profileForm, defaultLanguage: value as "en" | "ar" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-profile-timezone">{t("ten.timezone")} *</Label>
                <Input
                  id="tenant-profile-timezone"
                  maxLength={64}
                  value={profileForm.timezone}
                  aria-invalid={profileTouched && !profileForm.timezone.trim()}
                  onChange={(event) => setProfileForm({ ...profileForm, timezone: event.target.value })}
                />
                {profileTouched && !profileForm.timezone.trim() && <p className="text-xs text-danger">{t("ten.required")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-profile-notes">{t("common.notes")}</Label>
                <Textarea
                  id="tenant-profile-notes"
                  rows={3}
                  maxLength={4000}
                  value={profileForm.notes}
                  onChange={(event) => setProfileForm({ ...profileForm, notes: event.target.value })}
                />
              </div>
            </section>
            {profileError && <p role="alert" className="text-sm text-danger">{profileError}</p>}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={profileSave.isPending} onClick={() => setProfileTenant(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={profileSave.isPending}>{profileSave.isPending ? t("common.saving") : t("common.save")}</Button>
            </div>
          </form>}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selected || !!selectedTenantId} onOpenChange={(value) => {
        if (!value) {
          setSelected(null);
          setSelectedTenantId(null);
        }
      }}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          {selectedTenantId && tenantDetailQuery.isPending && <p role="status" className="px-4 py-6 text-sm text-muted-foreground">{t("ten.detailLoading")}</p>}
          {selectedTenantId && tenantDetailQuery.isError && tenantDetailQuery.error instanceof ApiError && tenantDetailQuery.error.statusCode === 404
            ? <EmptyState title={t("ten.detailNotFound")} body={t("ten.detailNotFoundBody")} />
            : selectedTenantId && tenantDetailQuery.isError && <ErrorState onRetry={() => void tenantDetailQuery.refetch()} />}
          {selectedTenant && <>
            <SheetHeader><SheetTitle>{selectedTenant.name}</SheetTitle><SheetDescription>{t("ten.id")}: {selectedTenant.id} | {t("ten.code")}: {selectedTenant.code}</SheetDescription></SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <section className="space-y-3"><h3 className="text-sm font-semibold">{t("ten.organization")}</h3><div className="flex items-center gap-2"><StatusBadge status={selectedTenant.status} /><span className="text-sm">{selectedTenant.dataRegion}</span></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.language")}</dt><dd>{selectedTenant.defaultLanguage === "ar" ? "العربية" : "English"}</dd></div><div><dt className="text-label">{t("ten.timezone")}</dt><dd dir="ltr" className="text-start">{selectedTenant.timezone}</dd></div><div><dt className="text-label">{t("ten.createdAt")}</dt><dd>{new Date(selectedTenant.createdAt).toLocaleString(locale)}</dd></div><div><dt className="text-label">{t("ten.updatedAt")}</dt><dd>{new Date(selectedTenant.updatedAt).toLocaleString(locale)}</dd></div>{selectedTenant.notes && <div className="col-span-2"><dt className="text-label">{t("common.notes")}</dt><dd>{selectedTenant.notes}</dd></div>}{selectedTenantId && tenantDetailQuery.data?.primaryAdminUserId && <div className="col-span-2"><dt className="text-label">{t("ten.primaryAdminUserId")}</dt><dd className="font-mono text-xs">{tenantDetailQuery.data.primaryAdminUserId}</dd></div>}</dl>{selectedTenantId && <p className="text-xs text-muted-foreground">{t("ten.liveDetailLimits")}</p>}</section>
              {selected && <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("ten.subscription")}</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.plan")}</dt><dd>{selected.planName} <span className="text-xs text-muted-foreground">({t(`status.${selected.planStatus}`)})</span></dd></div><div><dt className="text-label">{t("ten.subscriptionStatus")}</dt><dd><StatusBadge status={selected.subscription.status} /></dd></div></div><dl className="space-y-3">{CHANNELS.map((channel) => {
                const planDefault = selected.planDefaults.channels[channel];
                const effective = selected.effectiveEntitlements.channels[channel];
                const override = selected.subscription.overrides?.channels?.[channel];
                return <div key={channel} className="flex flex-col gap-1 border-t pt-2 text-sm"><dt className="font-medium">{t(`channel.${channel}`)}</dt><dd className="text-muted-foreground">{t("ten.planDefault")}: {planDefault.enabled ? t("plans.enabled") : t("plans.notEnabled")} | {formatNumber(planDefault.monthly, locale)} {t("ten.monthly")}</dd>{override && <dd className="text-muted-foreground">{t("ten.tenantOverride")}: {override.enabled === false ? t("plans.notEnabled") : override.monthly !== undefined ? formatNumber(override.monthly, locale) : t("ten.restrictedOnly")}</dd>}<dd>{t("ten.effective")}: {effective.enabled ? t("plans.enabled") : t("plans.notEnabled")} | {formatNumber(effective.monthly, locale)} {t("ten.monthly")}</dd></div>;
              })}</dl><div className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.tps")}</dt><dd>{t("ten.planDefault")}: {formatNumber(selected.planDefaults.tpsLimit, locale)} | {t("ten.effective")}: {formatNumber(selected.effectiveEntitlements.tpsLimit, locale)}</dd></div><div><dt className="text-label">{t("plans.quotaPolicy")}</dt><dd>{t("ten.planDefault")}: {t(`usage.policy.${selected.planDefaults.quotaPolicy}`)} | {t("ten.effective")}: {t(`usage.policy.${selected.effectiveEntitlements.quotaPolicy}`)}</dd></div></div><div><dt className="text-label">{t("ten.overrides")}</dt><dd>{selected.subscription.overrides ? t("ten.customOverrides") : t("ten.noOverrides")}</dd></div><div><h4 className="mb-2 text-sm font-medium">{t("plans.features")}</h4><ul className="flex flex-wrap gap-2">{selected.effectiveEntitlements.features.map((feature) => <li key={feature} className="rounded border px-2 py-1 text-xs">{t(FEATURE_LABEL_KEYS[feature])}</li>)}</ul></div></section>}
              {selectedTenantId && tenantDetailQuery.data && <TenantSubscriptionPanel
                data={tenantSubscriptionQuery.data}
                isPending={tenantSubscriptionQuery.isPending}
                isError={tenantSubscriptionQuery.isError}
                onRetry={() => void tenantSubscriptionQuery.refetch()}
              />}
              {apiMode === "live" &&
                selectedTenantId &&
                tenantDetailQuery.data &&
                tenantSubscriptionQuery.isSuccess &&
                can("platform.tenants.manage") && (
                  <div className="border-t pt-4">
                    <Button
                      variant="outline"
                      disabled={assignPlan.isPending}
                      onClick={openPlanAssignment}
                    >
                      {t("ten.assignmentOpen")}
                    </Button>
                  </div>
                )}
              {selectedTenantId && tenantDetailQuery.data && can("platform.tenants.manage") && <div className="border-t pt-4">
                <Button variant="outline" onClick={() => {
                  const tenant = tenantDetailQuery.data;
                  if (tenant) openLiveProfileEdit(tenant);
                }}>{t("common.edit")}</Button>
              </div>}
              {selected && <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("ten.administrator")}</h3>{selected.primaryAdministrator ? <><p className="font-medium">{selected.primaryAdministrator.name}</p><p dir="ltr" className="text-start text-sm">{selected.primaryAdministrator.email}</p><dl className="grid grid-cols-2 gap-3 text-sm">{selected.primaryAdministrator.mobileNumber && <div><dt className="text-label">{t("users.mobile")}</dt><dd dir="ltr" className="text-start">{selected.primaryAdministrator.mobileNumber}</dd></div>}{selected.primaryAdministrator.jobTitle && <div><dt className="text-label">{t("users.jobTitle")}</dt><dd>{selected.primaryAdministrator.jobTitle}</dd></div>}{selected.primaryAdministrator.department && <div><dt className="text-label">{t("users.department")}</dt><dd>{selected.primaryAdministrator.department}</dd></div>}<div><dt className="text-label">{t("common.role")}</dt><dd>{t("ten.clientAdminRole")}</dd></div></dl></> : <p className="text-sm text-muted-foreground">{t("ten.noAdministrator")}</p>}</section>}
              {selected && <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-semibold">{t("ten.usageSummary")}</h3><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("ten.users")}</dt><dd>{formatNumber(selected.users, locale)}</dd></div><div><dt className="text-label">{t("ten.applications")}</dt><dd>{formatNumber(selected.applications, locale)}</dd></div><div><dt className="text-label">{t("ten.volume")}</dt><dd>{formatNumber(selected.messages30d, locale)}</dd></div><div><dt className="text-label">{t("ten.quota")}</dt><dd>{formatPercent(selected.quotaPct, locale, 0)}</dd></div></dl></section>}
              {selectedTenant && can("platform.tenants.manage") && <div className="flex flex-wrap gap-2 border-t pt-4">
                {selected && <Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>}
                {selectedTenant.status === "suspended" || selectedTenant.status === "inactive"
                  ? <Button variant="outline" disabled={changeStatus.isPending} onClick={() => requestStatusChange(selectedTenant)}>{t("ten.reactivate")}</Button>
                  : <Button variant="outline" disabled={changeStatus.isPending} onClick={() => requestStatusChange(selectedTenant)}>{t("ten.suspend")}</Button>}
              </div>}
            </div>
          </>}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!statusTarget} onOpenChange={(value) => {
        if (!value && !statusSubmissionPendingRef.current) {
          setStatusTarget(null);
          setStatusError("");
        }
      }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(statusTarget?.status === "suspended" ? "ten.suspendTitle" : "ten.reactivateTitle")}</AlertDialogTitle><AlertDialogDescription>{statusTarget?.status === "suspended"
        ? t("ten.suspendBody", { name: statusTarget.tenant.name, current: t(`status.${statusTarget.tenant.status}`) })
        : t("ten.reactivateBody", { name: statusTarget?.tenant.name ?? "", current: statusTarget ? t(`status.${statusTarget.tenant.status}`) : "", next: t("status.active") })}</AlertDialogDescription></AlertDialogHeader>{statusError && <p role="alert" className="text-sm text-danger">{statusError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={changeStatus.isPending}>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); submitStatusChange(); }} disabled={changeStatus.isPending}>{t(statusTarget?.status === "suspended" ? "ten.suspend" : "ten.reactivate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={planAssignmentOpen} onOpenChange={(value) => {
        if (!value && !planAssignmentPendingRef.current) {
          setPlanAssignmentOpen(false);
          setPlanAssignmentError("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ten.assignmentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ten.assignmentBody", {
                tenant: tenantDetailQuery.data?.name ?? "",
                plan: assignablePlans.find((plan) => plan.id === planAssignmentPlanId)?.name ?? "",
                status: t(`status.${planAssignmentStatus}`),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-plan-assignment-plan">{t("ten.assignmentPlan")}</Label>
              <Select
                value={planAssignmentPlanId}
                onValueChange={(value) => {
                  setPlanAssignmentPlanId(value);
                  setPlanAssignmentError("");
                }}
                disabled={assignPlan.isPending || assignmentPlans.isFetching || assignablePlans.length === 0}
              >
                <SelectTrigger id="tenant-plan-assignment-plan">
                  <SelectValue placeholder={t("ten.assignmentSelectPlan")} />
                </SelectTrigger>
                <SelectContent>
                  {assignablePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignmentPlans.isPending && <p role="status" className="text-sm text-muted-foreground">{t("ten.assignmentPlansLoading")}</p>}
              {assignmentPlans.isError && <div className="flex items-center gap-2 text-sm text-danger">
                <span>{t("ten.assignmentPlansError")}</span>
                <Button type="button" size="sm" variant="outline" disabled={assignmentPlans.isFetching} onClick={() => void assignmentPlans.refetch()}>{t("common.retry")}</Button>
              </div>}
              {assignmentPlans.isSuccess && assignablePlans.length === 0 && <p className="text-sm text-muted-foreground">{t("ten.assignmentNoPlans")}</p>}
              {assignmentPlans.isSuccess && assignablePlans.length > 0 && !planAssignmentPlanId && <p className="text-sm text-danger">{t("ten.assignmentPlanRequired")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-plan-assignment-status">{t("ten.assignmentStatus")}</Label>
              <Select
                value={planAssignmentStatus}
                onValueChange={(value) => {
                  if (value === "trial" || value === "active") setPlanAssignmentStatus(value);
                }}
                disabled={assignPlan.isPending}
              >
                <SelectTrigger id="tenant-plan-assignment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">{t("status.trial")}</SelectItem>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {planAssignmentError && <p role="alert" className="text-sm text-danger">{planAssignmentError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assignPlan.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                submitPlanAssignment();
              }}
              disabled={
                assignPlan.isPending ||
                !assignablePlans.some((plan) => plan.id === planAssignmentPlanId)
              }
            >
              {t(assignPlan.isPending ? "common.saving" : "ten.assignmentConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingPlanId} onOpenChange={(value) => !value && setPendingPlanId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("ten.planChangeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("ten.planChangeBody", { plan: requestedPlan?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (pendingPlanId) applyPlan(pendingPlanId); }} disabled={!pendingPlanId}>{t("ten.clearOverridesChangePlan")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}