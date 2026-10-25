import { MessageAlert } from "@/components/app/MessageAlert";
import { EntityName } from "@/components/app/EntityName";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unknownResolutionMutations } from "@/lib/api/queries";
import { unknownResolutionBody, unknownResolutionKey } from "@/lib/api/unknown-resolution";
import type {
  UnknownResolutionDecision,
  UnknownResolutionInput,
} from "@/lib/api/unknown-resolution";
import type { SenderIdentityActor } from "@/lib/api/types";
import { ApiError } from "@/lib/api/http/errors";
import { useI18n } from "@/lib/i18n/i18n";
import { Section } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UnknownResolutionPanel({
  actor,
  tenantId,
  messageId,
}: {
  actor: SenderIdentityActor;
  tenantId: string;
  messageId: string;
}) {
  const { t } = useI18n();
  const client = useQueryClient();
  const [draft, setDraft] = useState<UnknownResolutionInput | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationKey: unknownResolutionKey(actor, tenantId, messageId),
    retry: false,
    gcTime: 0,
    // Evidence stays in this mounted dialog/request, not mutation variables.
    mutationFn: () => {
      if (!draft || !acknowledged) throw new Error("Resolution confirmation required");
      return unknownResolutionMutations.resolve(actor, tenantId, messageId, draft);
    },
    onSuccess: async () => {
      if (!active.current) return;
      setDraft(null);
      setAcknowledged(false);
      await Promise.all([
        client.invalidateQueries({
          queryKey: [
            "messageHistoryDetail",
            actor.userId,
            actor.role,
            actor.tenantId,
            tenantId,
            messageId,
          ],
        }),
        client.invalidateQueries({ queryKey: ["messageHistory", actor.userId] }),
        client.invalidateQueries({ queryKey: ["providerAttempts", actor.userId] }),
        client.invalidateQueries({ queryKey: ["administrativeAudit"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["usageReport"] }),
      ]);
    },
  });
  let valid = false;
  if (draft) {
    try {
      unknownResolutionBody(draft);
      valid = true;
    } catch {
      /* Inline validation keeps the draft. */
    }
  }
  return (
    <Section title={t("unknownResolve.title")}>
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{t("unknownResolve.note")}</p>
        {mutation.isSuccess ? (
          <div role="status" className="space-y-2">
            <p>{t(mutation.data.changed ? "unknownResolve.saved" : "unknownResolve.unchanged")}</p>
            <div className="flex flex-wrap gap-3">
              <span>
                {t("common.status")}: <StatusBadge status={mutation.data.messageStatus} />
              </span>
              <span>
                {t("unknownResolve.reservation")}:{" "}
                <StatusBadge status={mutation.data.reservationState} />
              </span>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => {
              mutation.reset();
              setAcknowledged(false);
              setDraft({ decision: "commit", reason: "", evidenceReference: "" });
            }}
          >
            {t("unknownResolve.open")}
          </Button>
        )}
      </div>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setDraft(null);
            setAcknowledged(false);
            mutation.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("unknownResolve.title")}</DialogTitle>
            <DialogDescription>{t("unknownResolve.confirmNote")}</DialogDescription>
          </DialogHeader>
          {draft && (
            <>
              <p className="break-all font-mono text-xs" dir="ltr">
                <EntityName kind="tenant" id={tenantId} /> / {t("entity.message")}
              </p>
              <Label>{t("unknownResolve.decision")}</Label>
              <Select
                value={draft.decision}
                disabled={mutation.isPending}
                onValueChange={(value) => {
                  setAcknowledged(false);
                  setDraft({
                    decision: value as UnknownResolutionDecision,
                    reason: draft.reason,
                    evidenceReference: draft.evidenceReference,
                  });
                }}
              >
                <SelectTrigger aria-label={t("unknownResolve.decision")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["commit", "record_acceptance", "release"] as const).map((decision) => (
                    <SelectItem key={decision} value={decision}>
                      {t(`unknownResolve.${decision}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm">{t(`unknownResolve.${draft.decision}Hint`)}</p>
              <Label htmlFor="unknown-reason">{t("unknownResolve.reason")}</Label>
              <Input
                id="unknown-reason"
                maxLength={500}
                value={draft.reason}
                disabled={mutation.isPending}
                onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
              />
              <Label htmlFor="unknown-evidence">{t("unknownResolve.evidence")}</Label>
              <Input
                id="unknown-evidence"
                maxLength={128}
                value={draft.evidenceReference}
                disabled={mutation.isPending}
                onChange={(event) => setDraft({ ...draft, evidenceReference: event.target.value })}
              />
              <p className="text-caption">{t("unknownResolve.evidenceHint")}</p>
              {draft.decision === "record_acceptance" && (
                <>
                  <Label htmlFor="unknown-provider-id">{t("unknownResolve.providerId")}</Label>
                  <Input
                    id="unknown-provider-id"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={128}
                    value={draft.providerMessageId ?? ""}
                    disabled={mutation.isPending}
                    onChange={(event) =>
                      setDraft({ ...draft, providerMessageId: event.target.value })
                    }
                  />
                </>
              )}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="unknown-ack"
                  checked={acknowledged}
                  disabled={mutation.isPending}
                  onCheckedChange={(value) => setAcknowledged(value === true)}
                />
                <Label htmlFor="unknown-ack">
                  {t(
                    draft.decision === "release"
                      ? "unknownResolve.releaseAck"
                      : "unknownResolve.ack",
                  )}
                </Label>
              </div>
              {mutation.isError && (
                <MessageAlert className="text-danger">
                  {t(
                    mutation.error instanceof ApiError && mutation.error.statusCode === 409
                      ? "unknownResolve.conflict"
                      : "unknownResolve.error",
                  )}
                </MessageAlert>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setDraft(null);
                    setAcknowledged(false);
                    mutation.reset();
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={mutation.isPending || !valid || !acknowledged}
                  onClick={() => mutation.mutate()}
                >
                  {t(mutation.isPending ? "common.saving" : "unknownResolve.confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
