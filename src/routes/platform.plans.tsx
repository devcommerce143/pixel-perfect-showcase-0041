import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Info, Plus } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { ListPagination } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, apiMode } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http/errors";
import {
  changedPlanEditFields,
  copyPlanEditFields,
  displayPlanEditFieldValue,
  displayPlanEditValue,
  mergePlanEditAfterRefresh,
  PlanUpdateError,
  type PlanEditField,
} from "@/lib/api/http/plan-editing";
import { queries } from "@/lib/api/queries";
import type { Channel, Plan, PlanFeatureKey, QuotaPolicy } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

const CHANNELS: Channel[] = ["sms", "whatsapp", "email"];
const PLAN_STATUS_TRANSITIONS: Record<Plan["status"], readonly Plan["status"][]> = {
  draft: ["active", "archived"],
  active: ["inactive"],
  inactive: ["active", "archived"],
  archived: [],
};
const MOCK_PLAN_STATUS_ACTIONS: Record<Plan["status"], readonly Plan["status"][]> = {
  draft: ["active", "archived"],
  active: ["inactive", "archived"],
  inactive: ["active", "archived"],
  archived: [],
};
const FEATURES: { key: PlanFeatureKey; label: MessageKey }[] = [
  { key: "api_access", label: "plans.apiAccess" },
  { key: "bulk_messaging", label: "plans.bulkMessaging" },
  { key: "webhooks", label: "plans.webhooks" },
  { key: "reporting", label: "plans.reporting" },
  { key: "audit_export", label: "plans.auditExport" },
  { key: "dedicated_sender_identities", label: "plans.dedicatedSenders" },
];

type PlanDraft = {
  code: string;
  name: string;
  description: string;
  status: Exclude<Plan["status"], "archived">;
  tpsLimit: string;
  quotaPolicy: QuotaPolicy;
  channels: Record<Channel, { enabled: boolean; monthly: string }>;
  features: Record<PlanFeatureKey, boolean>;
};

function emptyPlanDraft(): PlanDraft {
  return {
    code: "",
    name: "",
    description: "",
    status: "draft",
    tpsLimit: "",
    quotaPolicy: "hard_stop",
    channels: {
      sms: { enabled: true, monthly: "" },
      whatsapp: { enabled: false, monthly: "" },
      email: { enabled: false, monthly: "" },
    },
    features: { api_access: false, bulk_messaging: false, webhooks: false, reporting: false, audit_export: false, dedicated_sender_identities: false },
  };
}

function planDraft(plan: Plan): PlanDraft {
  const draft = emptyPlanDraft();
  for (const channel of CHANNELS) {
    const entitlement = plan.entitlements.find((item) => item.channel === channel);
    const monthly = entitlement?.monthly;
    draft.channels[channel] = {
      enabled: entitlement?.enabled ?? false,
      monthly: monthly == null ? "" : String(Number.isSafeInteger(monthly) && monthly >= 0 ? monthly : 0),
    };
  }
  for (const feature of plan.features) draft.features[feature] = true;
  return {
    ...draft,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    status: plan.status === "archived" ? "inactive" : plan.status,
    tpsLimit: String(Number.isSafeInteger(plan.tpsLimit) && plan.tpsLimit > 0 ? plan.tpsLimit : ""),
    quotaPolicy: plan.quotaPolicy,
  };
}

type PlanSaveVariables = {
  id: string | null;
  input: Omit<Plan, "id" | "tenants">;
  baseline: Plan | null;
};

function planInputFromDraft(draft: PlanDraft, code: string): Omit<Plan, "id" | "tenants"> {
  return {
    code,
    name: draft.name.trim(),
    description: draft.description.trim(),
    status: draft.status,
    tpsLimit: Number(draft.tpsLimit),
    quotaPolicy: draft.quotaPolicy,
    entitlements: CHANNELS.map((channel) => ({
      channel,
      enabled: draft.channels[channel].enabled,
      monthly: draft.channels[channel].enabled ? Number(draft.channels[channel].monthly) : 0,
    })),
    features: FEATURES.filter((feature) => draft.features[feature.key]).map((feature) => feature.key),
  };
}

function planFromDraft(baseline: Plan, draft: PlanDraft): Plan {
  const input = planInputFromDraft(draft, baseline.code);
  return { ...baseline, ...input, status: baseline.status };
}

function planEditFieldLabel(field: PlanEditField, t: (key: MessageKey) => string): string {
  if (field === "name") return t("plans.name");
  if (field === "description") return t("common.description");
  if (field === "tpsLimit") return t("plans.tps");
  if (field === "quotaPolicy") return t("plans.quotaPolicy");
  if (field === "features") return t("plans.features");
  return `${t("plans.entitlements")} · ${field.slice("channel:".length).toUpperCase()}`;
}

export const Route = createFileRoute("/platform/plans")({
  head: () => pageHead("Subscriptions & Plans", "Plan catalogue and tenant subscriptions."),
  component: () => <RequirePermission permission="platform.plans"><Plans /></RequirePermission>,
});

function Plans() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const q = useQuery(queries.plans({ page, pageSize }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ plan: Plan; status: Plan["status"] } | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<PlanDraft>(emptyPlanDraft);
  const [editBaseline, setEditBaseline] = useState<Plan | null>(null);
  const [partialUpdate, setPartialUpdate] = useState<PlanUpdateError | null>(null);
  const [refreshBlocked, setRefreshBlocked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const saving = useRef(false);
  const statusSaving = useRef(false);
  const save = useMutation({
    mutationFn: ({ id, input, baseline }: PlanSaveVariables) =>
      id ? api.updatePlan(id, input, baseline ?? undefined) : api.createPlan(input),
    retry: false,
    onSuccess: async (plan, variables) => {
      toast.success(t(variables.id ? "plans.saved" : "plans.created"));
      if (
        !variables.baseline ||
        variables.baseline.status !== plan.status ||
        changedPlanEditFields(variables.baseline, plan).length > 0
      ) {
        await queryClient.invalidateQueries({ queryKey: ["plans"] });
      }
      setOpen(false);
      setError("");
      setPartialUpdate(null);
      setEditBaseline(null);
      setSelected(plan);
    },
    onError: async (cause, variables) => {
      if (cause instanceof PlanUpdateError) {
        setPartialUpdate(cause);
        setError("");
        setRefreshBlocked(!cause.latest);
        if (cause.latest) {
          const merged = mergePlanEditAfterRefresh(cause.original, cause.draft, cause.latest);
          setEditBaseline(cause.latest);
          setDraft(planDraft(merged));
        } else if (variables.baseline) {
          setEditBaseline(variables.baseline);
        }
        if (cause.latest || Object.keys(cause.confirmedValues).length > 0) {
          try {
            await queryClient.invalidateQueries({ queryKey: ["plans"] });
          } catch {
            setError(t("plans.catalogRefreshFailed"));
          }
        }
        return;
      }
      if (cause instanceof ApiError && cause.statusCode === 409) {
        setError(/plan code.*already|code already/i.test(cause.message) ? t("plans.codeExists") : t("plans.conflictError"));
      } else if (cause instanceof Error && /code already/i.test(cause.message)) {
        setError(t("plans.codeExists"));
      } else if (cause instanceof ApiError && cause.statusCode === 400) {
        setError(t("plans.validationError"));
      } else {
        setError(t("plans.saveError"));
      }
    },
    onSettled: () => {
      saving.current = false;
    },
  });
  const changeStatus = useMutation({
    mutationFn: (input: { plan: Plan; status: Plan["status"] }) => api.setPlanStatus(input.plan.id, input.status),
    retry: false,
    onSuccess: async (_, input) => {
      toast.success(t(input.status === "archived" ? "plans.archived" : "plans.statusChanged"));
      setSelected({ ...input.plan, status: input.status });
      setStatusTarget(null);
      try {
        await queryClient.invalidateQueries({ queryKey: ["plans"] });
      } catch {
        toast.error(t("plans.catalogRefreshFailed"));
      }
    },
    onError: (cause) => {
      const message = cause instanceof ApiError && cause.statusCode === 400
        ? t("plans.statusValidationError")
        : cause instanceof ApiError && cause.statusCode === 409
          ? t("plans.statusConflict")
          : t("plans.statusError");
      toast.error(message);
    },
    onSettled: () => {
      statusSaving.current = false;
    },
  });
  const normalizedCode = draft.code.trim().toUpperCase();
  const validCode = /^[A-Z0-9-]{2,32}$/.test(normalizedCode);
  const tpsValue = Number(draft.tpsLimit);
  const validTps = /^\d+$/.test(draft.tpsLimit) && Number.isSafeInteger(tpsValue) && tpsValue > 0;
  const validQuotas = CHANNELS.every((channel) => {
    const entitlement = draft.channels[channel];
    if (!entitlement.enabled) return true;
    const quota = Number(entitlement.monthly);
    return /^\d+$/.test(entitlement.monthly) && Number.isSafeInteger(quota) && quota >= 0;
  });
  const valid = validCode && !!draft.name.trim() && validTps && validQuotas;
  const editingPlan = q.data?.items.find((plan) => plan.id === editingId);
  const tenantCount = (count: number | null) => count == null ? t("plans.tenantsUnavailable") : t("plans.tenants", { count });
  const displayPlanName = (plan: Plan) => plan.code === "STANDARD" ? t("plans.standard") : plan.name;
  const setChannel = (channel: Channel, value: Partial<PlanDraft["channels"][Channel]>) => {
    setDraft((current) => ({ ...current, channels: { ...current.channels, [channel]: { ...current.channels[channel], ...value } } }));
  };
  const submit = () => {
    if (saving.current || refreshBlocked || (partialUpdate?.conflicts.length ?? 0) > 0) return;
    setTouched(true);
    setError("");
    if (!valid) return;
    saving.current = true;
    setPartialUpdate(null);
    save.mutate({
      id: editingId,
      input: planInputFromDraft(draft, editingId && editBaseline ? editBaseline.code : normalizedCode),
      baseline: editingId ? editBaseline : null,
    });
  };
  const openCreate = () => {
    setEditingId(null);
    setEditBaseline(null);
    setPartialUpdate(null);
    setRefreshBlocked(false);
    setDraft(emptyPlanDraft());
    setTouched(false);
    setError("");
    setOpen(true);
  };
  const openEdit = (plan: Plan) => {
    if (plan.status === "archived") return;
    setSelected(null);
    setEditingId(plan.id);
    setEditBaseline(plan);
    setPartialUpdate(null);
    setRefreshBlocked(false);
    setDraft(planDraft(plan));
    setTouched(false);
    setError("");
    setOpen(true);
  };
  const refreshAfterPartialFailure = async () => {
    if (!editingId || !partialUpdate || refreshing) return;
    setRefreshing(true);
    let latest: Plan;
    try {
      latest = await api.getPlan(editingId);
    } catch {
      setRefreshBlocked(true);
      setError(t("plans.partialRefreshFailed"));
      setRefreshing(false);
      return;
    }
    const refreshed = new PlanUpdateError({
      original: partialUpdate.original,
      draft: partialUpdate.draft,
      latest,
      confirmedValues: partialUpdate.confirmedValues,
      reviewRequiredFields: partialUpdate.reviewRequiredFields,
      failure: partialUpdate.failure,
    });
    const merged = mergePlanEditAfterRefresh(refreshed.original, refreshed.draft, latest);
    setEditBaseline(latest);
    setDraft(planDraft(merged));
    setPartialUpdate(refreshed);
    setRefreshBlocked(false);
    setError("");
    try {
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
    } catch {
      setError(t("plans.catalogRefreshFailed"));
    } finally {
      setRefreshing(false);
    }
  };
  const useServerConflictValues = () => {
    if (!partialUpdate?.latest || partialUpdate.conflicts.length === 0) return;
    const latest = partialUpdate.latest;
    const currentDraft = planFromDraft(latest, draft);
    setDraft(planDraft(copyPlanEditFields(currentDraft, latest, partialUpdate.conflicts)));
    setPartialUpdate(null);
    setError("");
  };
  const keepDraftConflictValues = () => {
    if (!partialUpdate?.latest || partialUpdate.conflicts.length === 0) return;
    setPartialUpdate(null);
    setError("");
  };
  const requestStatus = (plan: Plan, status: Plan["status"]) => setStatusTarget({ plan, status });
  const confirmStatusChange = () => {
    if (statusSaving.current || !statusTarget) return;
    statusSaving.current = true;
    changeStatus.mutate(statusTarget);
  };
  const showPlanStatus = (status: Plan["status"]) => t(`status.${status}` as MessageKey);
  return (
    <>
      <PageHeader title={t("plans.title")} description={t("plans.subtitle")} actions={can("platform.plans.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("plans.new")}</Button>} />
      <PageBody>
        {q.isError ? <Section><ErrorState onRetry={() => void q.refetch()} /></Section> : q.isPending || !q.data ? <TableSkeleton /> : q.data.total === 0 ? <Section><EmptyState title={t("plans.emptyTitle")} body={t("plans.emptyBody")} /></Section> : (
          <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {q.data.items.map((plan) => (
              <Section key={plan.id} title={displayPlanName(plan)} description={tenantCount(plan.tenants)} actions={<div className="flex items-center gap-2"><StatusBadge status={plan.status} /><Button variant="ghost" size="sm" onClick={() => setSelected(plan)}>{t("common.view")}</Button></div>}>
                <div className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <p className="font-mono text-xs text-muted-foreground">{plan.code}</p>
                  <dl className="grid grid-cols-2 gap-2 border-y py-3 text-sm">
                    <div><dt className="text-caption">{t("plans.tps")}</dt><dd className="font-medium tabular-nums">{formatNumber(plan.tpsLimit, locale)}</dd></div>
                    <div><dt className="text-caption">{t("plans.quotaPolicy")}</dt><dd className="font-medium">{t(plan.quotaPolicy === "hard_stop" ? "plans.hardStop" : "plans.softCap")}</dd></div>
                  </dl>
                  <div>
                    <div className="text-label">{t("plans.entitlements")}</div>
                    <ul className="mt-2 space-y-1.5">{CHANNELS.map((channel) => {
                      const entitlement = plan.entitlements.find((item) => item.channel === channel);
                      const enabled = entitlement?.enabled === true;
                      const quota = entitlement?.monthly;
                      return <li key={channel} className="flex items-center justify-between gap-2 text-sm"><ChannelLabel channel={channel} /><span className={enabled && quota != null ? "font-medium tabular-nums" : "text-muted-foreground"}>{enabled && quota != null ? `${formatNumber(quota, locale)} / ${t("plans.monthlyQuota")}` : enabled ? "—" : t("plans.notEnabled")}</span></li>;
                    })}</ul>
                  </div>
                  <ul className="space-y-1 border-t pt-3">{plan.features.length ? plan.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground"><Check className="size-3.5 text-success" />{t(FEATURES.find((item) => item.key === feature)!.label)}</li>) : <li className="text-caption">{t("plans.noFeatures")}</li>}</ul>
                </div>
              </Section>
            ))}
          </div>
          {q.data.total > q.data.pageSize && <div className="panel"><ListPagination page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></div>}
          </>
        )}
      </PageBody>

      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (save.isPending || refreshing) return;
          if (!value && (refreshBlocked || (partialUpdate && partialUpdate.latest?.status !== "archived"))) return;
          setOpen(value);
        }}
      >
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{t(editingId ? "plans.editTitle" : "plans.createTitle")}</SheetTitle><SheetDescription>{t(editingId ? "plans.editDescription" : "plans.createDescription")}</SheetDescription></SheetHeader>
          <form className="flex flex-col gap-5 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
            {partialUpdate && <section role="alert" className="space-y-3 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
              <h3 className="font-semibold">{t("plans.partialSaveTitle")}</h3>
              <p>{t("plans.partialSaveFailureReason", {
                message: partialUpdate.failure instanceof Error ? partialUpdate.failure.message : t("plans.partialSaveFailed"),
              })}</p>
              {partialUpdate.latest ? <>
                <p>{t("plans.partialSaveRefreshed")}</p>
                {Object.keys(partialUpdate.confirmedValues).length > 0 && <div>
                  <p className="font-medium">{t("plans.partialSaveAcknowledged")}</p>
                  <ul className="list-inside list-disc">{Object.entries(partialUpdate.confirmedValues).map(([field, value]) => (
                    <li key={field}>{planEditFieldLabel(field as PlanEditField, t)}: {displayPlanEditValue(value, field as PlanEditField)}</li>
                  ))}</ul>
                </div>}
                <div>
                  <p className="font-medium">{t("plans.partialSaveCurrentValues")}</p>
                  <ul className="list-inside list-disc">{partialUpdate.attemptedFields.map((field) => (
                    <li key={field}>{planEditFieldLabel(field, t)}: {displayPlanEditFieldValue(partialUpdate.latest!, field)}</li>
                  ))}</ul>
                </div>
                {changedPlanEditFields(partialUpdate.latest, planFromDraft(partialUpdate.latest, draft)).length > 0 && <div>
                  <p className="font-medium">{t("plans.partialSaveRemaining")}</p>
                  <ul className="list-inside list-disc">{changedPlanEditFields(partialUpdate.latest, planFromDraft(partialUpdate.latest, draft)).map((field) => (
                    <li key={field}>{planEditFieldLabel(field, t)} — {t("plans.partialSaveServerValue")}: {displayPlanEditFieldValue(partialUpdate.latest!, field)}; {t("plans.partialSaveDraftValue")}: {displayPlanEditFieldValue(planFromDraft(partialUpdate.latest!, draft), field)}</li>
                  ))}</ul>
                </div>}
                {partialUpdate.conflicts.length > 0 && partialUpdate.latest.status !== "archived" && <>
                  <p className="font-medium">{t("plans.partialSaveConflictReview")}</p>
                  <ul className="list-inside list-disc">{partialUpdate.conflicts.map((field) => (
                    <li key={field}>{planEditFieldLabel(field, t)} — {t("plans.partialSaveServerValue")}: {displayPlanEditFieldValue(partialUpdate.latest!, field)}; {t("plans.partialSaveDraftValue")}: {displayPlanEditFieldValue(planFromDraft(partialUpdate.latest!, draft), field)}</li>
                  ))}</ul>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={useServerConflictValues}>{t("plans.partialSaveUseServer")}</Button>
                    <Button type="button" variant="outline" onClick={keepDraftConflictValues}>{t("plans.partialSaveKeepDraft")}</Button>
                  </div>
                </>}
                {partialUpdate.latest.status === "archived" && <p>{t("plans.partialSaveArchived")}</p>}
              </> : <>
                <p>{t("plans.partialSaveRefreshRequired")}</p>
                {Object.keys(partialUpdate.confirmedValues).length > 0 && <div>
                  <p className="font-medium">{t("plans.partialSaveAcknowledged")}</p>
                  <ul className="list-inside list-disc">{Object.entries(partialUpdate.confirmedValues).map(([field, value]) => (
                    <li key={field}>{planEditFieldLabel(field as PlanEditField, t)}: {displayPlanEditValue(value, field as PlanEditField)}</li>
                  ))}</ul>
                </div>}
                {error && <p>{error}</p>}
                <Button type="button" variant="outline" disabled={refreshing} onClick={() => void refreshAfterPartialFailure()}>
                  {refreshing ? t("plans.partialSaveRefreshing") : t("plans.partialSaveRefresh")}
                </Button>
              </>}
            </section>}
            <fieldset
              className="flex flex-col gap-5 border-0 p-0"
              disabled={
                save.isPending ||
                refreshing ||
                refreshBlocked ||
                (partialUpdate?.conflicts.length ?? 0) > 0 ||
                partialUpdate?.latest?.status === "archived"
              }
            >
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("plans.details")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-code">{t("plans.code")} <span className="text-danger">*</span></Label>
                  <Input id="plan-code" value={draft.code} disabled={!!editingId} onChange={(event) => setDraft({ ...draft, code: event.target.value })} aria-invalid={touched && !validCode} autoCapitalize="characters" />
                  {editingId && <p className="text-caption">{t("plans.codeImmutable")}</p>}
                  {touched && !validCode && <p className="text-xs text-danger">{t("plans.invalidCode")}</p>}
                </div>
                <div className="space-y-1.5"><Label htmlFor="plan-name">{t("plans.name")} <span className="text-danger">*</span></Label><Input id="plan-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={touched && !draft.name.trim()} />{touched && !draft.name.trim() && <p className="text-xs text-danger">{t("plans.required")}</p>}</div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="plan-description">{t("common.description")}</Label><Textarea id="plan-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label>{t("common.status")}</Label>{apiMode === "live" && editingId ? <p className="rounded-md border px-3 py-2 text-sm">{showPlanStatus(editBaseline?.status ?? draft.status)}</p> : <Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as PlanDraft["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">{t("status.draft")}</SelectItem><SelectItem value="active">{t("status.active")}</SelectItem>{apiMode === "mock" && <SelectItem value="inactive">{t("status.inactive")}</SelectItem>}</SelectContent></Select>}</div>
              {editingId && editingPlan?.status === "active" && editingPlan.tenants != null && editingPlan.tenants > 0 && <p className="flex items-start gap-2 rounded-md border border-info/25 bg-info-soft p-3 text-sm text-info"><Info className="mt-0.5 size-4 shrink-0" />{t("plans.activeEditNotice")}</p>}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("plans.entitlements")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {CHANNELS.map((channel) => {
                  const entitlement = draft.channels[channel];
                  const validQuota = !entitlement.enabled || (/^\d+$/.test(entitlement.monthly) && Number.isSafeInteger(Number(entitlement.monthly)) && Number(entitlement.monthly) >= 0);
                  return <fieldset key={channel} className="space-y-3 rounded-md border p-3">
                    <legend className="px-1 font-medium"><ChannelLabel channel={channel} /></legend>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={entitlement.enabled} onCheckedChange={(checked) => setChannel(channel, { enabled: checked === true })} />{t("plans.enabled")}</label>
                    <div className="space-y-1.5"><Label htmlFor={`plan-${channel}`}>{t("plans.monthlyQuota")}</Label><Input id={`plan-${channel}`} type="number" min="0" step="1" disabled={!entitlement.enabled} value={entitlement.monthly} onChange={(event) => setChannel(channel, { monthly: event.target.value })} aria-invalid={touched && !validQuota} />{!entitlement.enabled && <p className="text-caption">{t("plans.disabledQuotaHint")}</p>}</div>
                  </fieldset>;
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="plan-tps">{t("plans.tps")} <span className="text-danger">*</span></Label><Input id="plan-tps" type="number" min="1" step="1" value={draft.tpsLimit} onChange={(event) => setDraft({ ...draft, tpsLimit: event.target.value })} aria-invalid={touched && !validTps} />{touched && !validTps && <p className="text-xs text-danger">{t("plans.invalidTps")}</p>}</div>
                <div className="space-y-1.5"><Label>{t("plans.quotaPolicy")} <span className="text-danger">*</span></Label><Select value={draft.quotaPolicy} onValueChange={(value) => setDraft({ ...draft, quotaPolicy: value as QuotaPolicy })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hard_stop">{t("plans.hardStop")}</SelectItem><SelectItem value="soft_cap">{t("plans.softCap")}</SelectItem></SelectContent></Select></div>
              </div>
              {touched && !validQuotas && <p className="text-xs text-danger">{t("plans.invalidQuota")}</p>}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">{t("plans.features")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">{FEATURES.map((feature) => <label key={feature.key} className="flex items-center gap-2 text-sm"><Checkbox checked={draft.features[feature.key]} onCheckedChange={(checked) => setDraft((current) => ({ ...current, features: { ...current.features, [feature.key]: checked === true } }))} />{t(feature.label)}</label>)}</div>
            </section>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending || refreshing || refreshBlocked || (!!partialUpdate && partialUpdate.latest?.status !== "archived")} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending || refreshBlocked || (partialUpdate?.conflicts.length ?? 0) > 0 || partialUpdate?.latest?.status === "archived"}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "common.create")}</Button></div>
            </fieldset>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-md">
          {selected && <>
            <SheetHeader><SheetTitle>{displayPlanName(selected)}</SheetTitle><SheetDescription>{selected.code}</SheetDescription></SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={selected.status} /><span className="text-sm">{tenantCount(selected.tenants)}</span></div>
              <p className="text-sm text-muted-foreground">{selected.description || t("common.notFound")}</p>
              <section className="space-y-2"><h3 className="text-sm font-semibold">{t("plans.entitlements")}</h3><dl className="divide-y">{CHANNELS.map((channel) => {
                const entitlement = selected.entitlements.find((item) => item.channel === channel);
                const enabled = entitlement?.enabled === true;
                const quota = entitlement?.monthly;
                return <div key={channel} className="flex items-center justify-between gap-3 py-2 text-sm"><dt><ChannelLabel channel={channel} /></dt><dd className={enabled && quota != null ? "text-end" : "text-end text-muted-foreground"}>{enabled && quota != null ? `${t("plans.enabled")} · ${formatNumber(quota, locale)} / ${t("plans.monthlyQuota")}` : enabled ? "—" : t("plans.notEnabled")}</dd></div>;
              })}</dl></section>
              <section className="space-y-2"><h3 className="text-sm font-semibold">{t("plans.limits")}</h3><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("plans.tps")}</dt><dd className="tabular-nums">{formatNumber(selected.tpsLimit, locale)}</dd></div><div><dt className="text-label">{t("plans.quotaPolicy")}</dt><dd>{t(selected.quotaPolicy === "hard_stop" ? "plans.hardStop" : "plans.softCap")}</dd></div></dl></section>
              <section className="space-y-2"><h3 className="text-sm font-semibold">{t("plans.features")}</h3>{selected.features.length ? <ul className="space-y-2">{selected.features.map((feature) => <li key={feature} className="flex items-center gap-2 text-sm"><Check className="size-4 text-success" />{t(FEATURES.find((item) => item.key === feature)!.label)}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("plans.noFeatures")}</p>}</section>
              {can("platform.plans.manage") && selected.status !== "archived" && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{(apiMode === "live" ? PLAN_STATUS_TRANSITIONS[selected.status] : MOCK_PLAN_STATUS_ACTIONS[selected.status]).map((status) => <Button key={status} variant={status === "archived" ? "destructive" : "outline"} onClick={() => requestStatus(selected, status)}>{t(status === "archived" ? "plans.archive" : status === "active" ? "plans.activate" : "plans.setInactive")}</Button>)}</div>}
            </div>
          </>}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!statusTarget} onOpenChange={(value) => {
        if (!value && !changeStatus.isPending && !statusSaving.current) setStatusTarget(null);
      }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(statusTarget?.status === "archived" ? "plans.archiveTitle" : "plans.statusTitle")}</AlertDialogTitle><AlertDialogDescription>{t(statusTarget?.status === "archived" ? "plans.archiveBody" : "plans.statusBody", { name: statusTarget ? displayPlanName(statusTarget.plan) : "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={changeStatus.isPending}>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); confirmStatusChange(); }} disabled={changeStatus.isPending}>{t(statusTarget?.status === "archived" ? "plans.archive" : statusTarget?.status === "active" ? "plans.activate" : "plans.setInactive")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
