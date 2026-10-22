import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkCancellationMutations } from "@/lib/api/queries";
import { bulkCancellationKey, bulkCancellationFailure } from "@/lib/api/bulk-cancellation";
import type { SenderIdentityActor } from "@/lib/api/types";
import type { BulkHistoryJob } from "@/lib/api/bulk-job-history-types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function BulkJobCancellation({
  actor,
  job,
}: {
  actor: SenderIdentityActor;
  job: BulkHistoryJob;
}) {
  return (
    <ScopedCancellation
      key={`${actor.userId}:${actor.role}:${actor.tenantId}:${job.tenantId}:${job.applicationId}:${job.id}`}
      actor={actor}
      job={job}
    />
  );
}
function ScopedCancellation({ actor, job }: { actor: SenderIdentityActor; job: BulkHistoryJob }) {
  const { can } = useSession();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const target = { tenantId: job.tenantId, applicationId: job.applicationId, jobId: job.id };
  const mutation = useMutation({
    mutationKey: bulkCancellationKey(actor, target),
    retry: false,
    gcTime: 0,
    mutationFn: () => bulkCancellationMutations.cancel(actor, target),
    onSuccess: async () => {
      if (!active.current) return;
      setOpen(false);
      setConfirmed(false);
      await qc.invalidateQueries({
        queryKey: ["bulkJobHistory", actor.userId, actor.role, actor.tenantId],
      });
    },
  });
  if (!can("messages.bulk.cancel")) return null;
  const eligible = ["received", "validating", "materializing", "processing"].includes(job.status);
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={!eligible || mutation.isPending}
        onClick={() => {
          mutation.reset();
          setConfirmed(false);
          setOpen(true);
        }}
      >
        {t("bulkCancel.action")}
      </Button>
      {mutation.isSuccess && (
        <p role="status">{t(mutation.data.replay ? "bulkCancel.already" : "bulkCancel.success")}</p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!mutation.isPending) {
            setOpen(value);
            setConfirmed(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("bulkCancel.title")}</DialogTitle>
            <DialogDescription>{t("bulkCancel.description")}</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs">{job.id}</p>
          <div className="flex items-start gap-2">
            <Checkbox
              id="bulk-cancel-ack"
              checked={confirmed}
              disabled={mutation.isPending}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor="bulk-cancel-ack">{t("bulkCancel.ack")}</Label>
          </div>
          {mutation.isError && <p role="alert">{t(bulkCancellationFailure(mutation.error))}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!confirmed || mutation.isPending} onClick={() => mutation.mutate()}>
              {t("bulkCancel.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
