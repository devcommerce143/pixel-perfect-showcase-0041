import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, smsAutomationMutations } from "@/lib/api/queries";
import { ApiError } from "@/lib/api/http/errors";
import type { SmsAutomationInput, SmsAutomationPolicy } from "@/lib/api/sms-automation";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { MessageAlert } from "./MessageAlert";
import { ErrorState, TableSkeleton } from "./States";

const stateKeys = {
  ENABLED: "smsAuto.enabled",
  PAUSED: "smsAuto.paused",
  DISABLED: "smsAuto.disabled",
} as const;
export function TenantSmsAutomation({ tenantId }: { tenantId: string }) {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const actor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const query = useQuery(queries.smsAutomation(actor, tenantId));
  const client = useQueryClient();
  const [draft, setDraft] = useState<SmsAutomationInput | null>(null);
  const [cap, setCap] = useState("");
  const [expiry, setExpiry] = useState("");
  const [confirm, setConfirm] = useState(false);
  const mutation = useMutation({
    retry: false,
    mutationFn: () => {
      if (!draft || query.isError) throw new Error("Automation state unavailable");
      return smsAutomationMutations.update(actor, tenantId, {
        ...draft,
        confirmPendingWork: draft.state === "ENABLED",
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        setConfirm(false);
        setDraft(null);
        void client.invalidateQueries({
          queryKey: queries.smsAutomation(actor, tenantId).queryKey,
        });
      }
    },
    onSuccess: async () => {
      setConfirm(false);
      setDraft(null);
      await client.invalidateQueries({ queryKey: queries.smsAutomation(actor, tenantId).queryKey });
    },
  });
  if (actor.role !== "super_admin" || actor.tenantId !== null) return null;
  const edit = (state: SmsAutomationPolicy["state"]) => {
    mutation.reset();
    const p = query.data;
    setDraft({
      state,
      bulkEnabled: p?.bulkEnabled ?? false,
      maxSubmissions: p?.maxSubmissions ?? null,
      validUntil: p?.validUntil ?? null,
      expectedRevision: p?.revision ?? 0,
      confirmPendingWork: false,
    });
    setCap(p?.maxSubmissions?.toString() ?? "");
    setExpiry(p?.validUntil ?? "");
    setConfirm(false);
  };
  const valid =
    !!draft &&
    (cap === "" || (/^\d+$/.test(cap) && Number(cap) >= 1 && Number(cap) <= 20)) &&
    (expiry === "" ||
      (Number.isFinite(Date.parse(expiry)) &&
        Date.parse(expiry) > Date.now() &&
        Date.parse(expiry) <= Date.now() + 365 * 86400000));
  return (
    <section className="space-y-3 border-t pt-4 text-start">
      <h3 className="text-sm font-semibold">{t("smsAuto.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("smsAuto.guidance")}</p>
      {query.isPending ? (
        <TableSkeleton rows={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <MessageAlert
            variant="info"
            title={t(query.data ? stateKeys[query.data.state] : "smsAuto.missing")}
          >
            {query.data ? (
              <>
                {query.data.maxSubmissions === null
                  ? t("smsAuto.continuous")
                  : t("smsAuto.capValue", { count: query.data.maxSubmissions })}
                {" · "}
                {query.data.validUntil === null
                  ? t("smsAuto.noExpiry")
                  : new Date(query.data.validUntil).toLocaleString(locale)}
                {" · "}
                {t(query.data.bulkEnabled ? "smsAuto.bulkOn" : "smsAuto.bulkOff")}
              </>
            ) : (
              t("smsAuto.missingHint")
            )}
          </MessageAlert>
          <div className="flex flex-wrap gap-2">
            {(["ENABLED", "PAUSED", "DISABLED"] as const).map((state) => (
              <Button
                key={state}
                variant="outline"
                disabled={mutation.isPending || query.isFetching}
                onClick={() => edit(state)}
              >
                {t(stateKeys[state])}
              </Button>
            ))}
          </div>
        </>
      )}
      {draft && (
        <div className="space-y-3">
          <Label htmlFor="sms-auto-cap">{t("smsAuto.cap")}</Label>
          <Input
            id="sms-auto-cap"
            type="number"
            min={1}
            max={20}
            value={cap}
            disabled={mutation.isPending || confirm}
            onChange={(e) => setCap(e.target.value)}
          />
          <Label htmlFor="sms-auto-expiry">{t("smsAuto.expiry")}</Label>
          <Input
            id="sms-auto-expiry"
            dir="ltr"
            value={expiry}
            disabled={mutation.isPending || confirm}
            onChange={(e) => setExpiry(e.target.value)}
          />
          {!valid && <MessageAlert variant="warning">{t("smsAuto.invalid")}</MessageAlert>}
          <Button
            disabled={!valid || query.isFetching || query.isError || mutation.isPending}
            onClick={() => {
              setDraft({
                ...draft,
                maxSubmissions: cap === "" ? null : Number(cap),
                validUntil: expiry === "" ? null : new Date(expiry).toISOString(),
              });
              setConfirm(true);
            }}
          >
            {t("common.save")}
          </Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setDraft(null)}>
            {t("common.cancel")}
          </Button>
        </div>
      )}
      {mutation.isError && (
        <ErrorState
          error={mutation.error}
          onRetry={() => {
            setDraft(null);
            setConfirm(false);
            mutation.reset();
            void query.refetch();
          }}
        />
      )}
      {mutation.isSuccess && !query.isError && (
        <MessageAlert variant="success">{t("smsAuto.saved")}</MessageAlert>
      )}
      <AlertDialog
        open={confirm}
        onOpenChange={(open) => {
          if (!mutation.isPending) setConfirm(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("smsAuto.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(draft?.state === "ENABLED" ? "smsAuto.confirm" : "smsAuto.hold")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending || query.isError || query.isFetching}
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
