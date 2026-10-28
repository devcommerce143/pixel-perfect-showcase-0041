import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, smsDispatchMutations } from "@/lib/api/queries";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
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
import { Section } from "./PageHeader";
import { MessageAlert } from "./MessageAlert";
import { ErrorState, TableSkeleton } from "./States";

export function SmsDispatchControl({ actor }: { actor: SenderIdentityActor }) {
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const state = useQuery(queries.smsDispatchControl(actor));
  const [confirm, setConfirm] = useState(false);
  const [target, setTarget] = useState<{ enabled: boolean; revision: number } | null>(null);
  const change = useMutation({
    retry: false,
    mutationFn: () => {
      if (!state.data || state.isError || !target) throw new Error("Dispatch state unavailable");
      return smsDispatchMutations.update(actor, target.enabled, target.revision, true);
    },
    onSuccess: async () => {
      setConfirm(false);
      await client.invalidateQueries({ queryKey: queries.smsDispatchControl(actor).queryKey });
    },
  });
  if (actor.role !== "super_admin" || actor.tenantId !== null) return null;
  return (
    <Section title={t("smsControl.title")}>
      <div className="space-y-3 p-4 text-start">
        <p className="text-subtle">{t("smsControl.description")}</p>
        {state.isError ? (
          <ErrorState error={state.error} onRetry={() => void state.refetch()} />
        ) : state.isPending ? (
          <TableSkeleton rows={2} />
        ) : (
          <>
            <MessageAlert
              variant={state.data.enabled ? "warning" : "info"}
              title={t(state.data.enabled ? "smsControl.enabled" : "smsControl.disabled")}
            >
              {t(state.data.enabled ? "smsControl.enabledHint" : "smsControl.disabledHint")}
            </MessageAlert>
            <p className="text-caption">
              {t("smsControl.changed", {
                time: new Date(state.data.updatedAt).toLocaleString(locale),
                name: state.data.updatedByName ?? t("smsControl.initial"),
              })}
            </p>
            <Button
              disabled={change.isPending || state.isFetching}
              onClick={() => {
                change.reset();
                setTarget({ enabled: !state.data.enabled, revision: state.data.revision });
                setConfirm(true);
              }}
            >
              {t(state.data.enabled ? "smsControl.disable" : "smsControl.enable")}
            </Button>
          </>
        )}
        {change.isError && (
          <ErrorState
            error={change.error}
            onRetry={() => {
              change.reset();
              void state.refetch();
            }}
          />
        )}
        {change.isSuccess && !state.isError && (
          <MessageAlert variant="success">{t("smsControl.saved")}</MessageAlert>
        )}
        <AlertDialog
          open={confirm}
          onOpenChange={(open) => {
            if (!change.isPending) setConfirm(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t(target?.enabled ? "smsControl.enable" : "smsControl.disable")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(target?.enabled ? "smsControl.enableWarning" : "smsControl.disableWarning")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={change.isPending}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={change.isPending || state.isError || !state.data || state.isFetching}
                onClick={(event) => {
                  event.preventDefault();
                  change.mutate();
                }}
              >
                {t(change.isPending ? "smsControl.saving" : "common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Section>
  );
}
