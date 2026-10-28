import type { DeliveryChannel } from "@/lib/api/delivery-dispatch-control";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, deliveryDispatchMutations } from "@/lib/api/queries";
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

export function DeliveryDispatchControl({
  actor,
  channel,
}: {
  actor: SenderIdentityActor;
  channel: DeliveryChannel;
}) {
  const { t, locale } = useI18n();
  const channelName = t(channel === "email" ? "deliveryControl.email" : "deliveryControl.whatsapp");
  const copy = (key: Parameters<typeof t>[0]) => t(key, { channel: channelName });
  const client = useQueryClient();
  const state = useQuery(queries.deliveryDispatchControl(actor, channel));
  const [confirm, setConfirm] = useState(false);
  const [target, setTarget] = useState<{ enabled: boolean; revision: number } | null>(null);
  const change = useMutation({
    retry: false,
    mutationFn: () => {
      if (!state.data || state.isError || !target) throw new Error("Dispatch state unavailable");
      return deliveryDispatchMutations.update(
        actor,
        channel,
        target.enabled,
        target.revision,
        true,
      );
    },
    onError: async () => {
      setConfirm(false);
      await client.invalidateQueries({
        queryKey: queries.deliveryDispatchControl(actor, channel).queryKey,
      });
    },
    onSuccess: async () => {
      setConfirm(false);
      await client.invalidateQueries({
        queryKey: queries.deliveryDispatchControl(actor, channel).queryKey,
      });
    },
  });
  if (actor.role !== "super_admin" || actor.tenantId !== null) return null;
  return (
    <Section title={copy("deliveryControl.title")}>
      <div className="space-y-3 p-4 text-start">
        <p className="text-subtle">{copy("deliveryControl.description")}</p>
        {state.isError ? (
          <ErrorState error={state.error} onRetry={() => void state.refetch()} />
        ) : state.isPending ? (
          <TableSkeleton rows={2} />
        ) : (
          <>
            <MessageAlert
              variant={state.data.enabled ? "warning" : "info"}
              title={copy(
                state.data.enabled ? "deliveryControl.enabled" : "deliveryControl.disabled",
              )}
            >
              {copy(
                state.data.enabled ? "deliveryControl.enabledHint" : "deliveryControl.disabledHint",
              )}
            </MessageAlert>
            <p className="text-caption">
              {t("deliveryControl.changed", {
                time: new Date(state.data.updatedAt).toLocaleString(locale),
                name: state.data.updatedByName ?? copy("deliveryControl.initial"),
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
              {copy(state.data.enabled ? "deliveryControl.disable" : "deliveryControl.enable")}
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
          <MessageAlert variant="success">{copy("deliveryControl.saved")}</MessageAlert>
        )}
        <AlertDialog
          open={confirm}
          onOpenChange={(open) => {
            if (!change.isPending) setConfirm(open);
          }}
        >
          <AlertDialogContent dir={locale === "ar" ? "rtl" : "ltr"} className="text-start">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {copy(target?.enabled ? "deliveryControl.enable" : "deliveryControl.disable")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {copy(
                  target?.enabled
                    ? "deliveryControl.enableWarning"
                    : "deliveryControl.disableWarning",
                )}
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
                {copy(change.isPending ? "deliveryControl.saving" : "common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Section>
  );
}
