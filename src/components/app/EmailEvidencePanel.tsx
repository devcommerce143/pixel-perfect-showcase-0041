import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, emailEvidenceMutations } from "@/lib/api/queries";
import {
  EMAIL_READINESS_STATES,
  EMAIL_EVIDENCE_REFERENCE,
  emailEvidenceKey,
} from "@/lib/api/email-evidence";
import type {
  EmailEvidenceInput,
  EmailEvidenceRecord,
  EmailReadinessState,
} from "@/lib/api/email-evidence";
import type { SenderIdentityActor } from "@/lib/api/types";
import { ApiError } from "@/lib/api/http/errors";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { DataTable, type Column } from "./DataTable";
import { ErrorState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function EmailEvidencePanel({
  actor,
  tenantId,
  senderId,
}: {
  actor: SenderIdentityActor;
  tenantId: string;
  senderId: string;
}) {
  const { t, locale } = useI18n(),
    client = useQueryClient();
  const [page, setPage] = useState(1),
    [draft, setDraft] = useState<EmailEvidenceInput | null>(null);
  const history = useQuery(queries.emailEvidence(actor, tenantId, senderId, page));
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationKey: [...emailEvidenceKey(actor, tenantId, senderId), "record"],
    retry: false,
    gcTime: 0,
    mutationFn: (input: EmailEvidenceInput) =>
      emailEvidenceMutations.record(actor, tenantId, senderId, input),
    onSuccess: async () => {
      if (!active.current) return;
      setDraft(null);
      setPage(1);
      await Promise.all([
        client.invalidateQueries({ queryKey: emailEvidenceKey(actor, tenantId, senderId) }),
        client.invalidateQueries({
          queryKey: ["senderIdentityReadPage", actor.userId, actor.role, actor.tenantId],
        }),
        client.invalidateQueries({
          queryKey: ["senderIdentityRead", actor.userId, actor.role, actor.tenantId],
        }),
        client.invalidateQueries({ queryKey: ["administrativeAudit"] }),
      ]);
    },
  });
  const badge = (value: EmailReadinessState | null) =>
    value === null ? t("ten.unavailable") : <StatusBadge status={value.toLowerCase()} />;
  const columns: Column<EmailEvidenceRecord>[] = [
    { id: "time", header: t("audit.time"), cell: (row) => formatDateTime(row.createdAt, locale) },
    {
      id: "actor",
      header: t("emailEvidence.actor"),
      cell: (row) => row.actorUserId ?? t("ten.unavailable"),
    },
    {
      id: "reference",
      header: t("emailEvidence.reference"),
      cell: (row) => row.evidenceReference ?? t("ten.unavailable"),
    },
    {
      id: "source",
      header: t("emailEvidence.source"),
      cell: (row) =>
        row.source === "OPERATOR_REVIEW" ? t("emailEvidence.operator") : t("ten.unavailable"),
    },
    {
      id: "domain",
      header: t("si.domainVerification"),
      cell: (row) => badge(row.domainVerificationStatus),
    },
    { id: "spf", header: t("si.spf"), cell: (row) => badge(row.spfStatus) },
    { id: "dkim", header: t("si.dkim"), cell: (row) => badge(row.dkimStatus) },
  ];
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{t("emailEvidence.title")}</h3>
      <p className="text-sm text-subtle">{t("emailEvidence.note")}</p>
      {history.isError ? (
        <ErrorState onRetry={() => void history.refetch()} />
      ) : history.isPending ? (
        <TableSkeleton rows={2} />
      ) : (
        <>
          <p className="font-mono text-sm">{history.data.current.domain}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ["domainVerificationStatus", "si.domainVerification"],
                ["spfStatus", "si.spf"],
                ["dkimStatus", "si.dkim"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <dt>{t(label)}</dt>
                <dd>{badge(history.data.current[field])}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2">
            <Button
              disabled={history.isFetching || mutation.isPending}
              onClick={() => {
                const current = history.data.current;
                mutation.reset();
                const expected = {
                  domainVerificationStatus: current.domainVerificationStatus,
                  spfStatus: current.spfStatus,
                  dkimStatus: current.dkimStatus,
                };
                setDraft({
                  ...expected,
                  domain: current.domain,
                  evidenceReference: "",
                  expected,
                  expectedRevision: history.data.total,
                });
              }}
            >
              {t("emailEvidence.record")}
            </Button>
            <Button
              variant="outline"
              disabled={history.isFetching || mutation.isPending}
              onClick={() => void history.refetch()}
            >
              {t("common.refresh")}
            </Button>
          </div>
          {mutation.isSuccess && <p role="status">{t("emailEvidence.saved")}</p>}
          <DataTable columns={columns} rows={history.data.items} rowKey={(row) => row.id} />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={page <= 1 || history.isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              {t("common.previous")}
            </Button>
            <span className="text-sm">
              {t("emailEvidence.page", { page: history.data.page, total: history.data.total })}
            </span>
            <Button
              variant="outline"
              disabled={page * 20 >= history.data.total || history.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("emailEvidence.record")}</DialogTitle>
            <DialogDescription>{t("emailEvidence.confirm")}</DialogDescription>
          </DialogHeader>
          {draft && (
            <>
              <p className="font-mono text-sm">{draft.domain}</p>
              <div className="grid gap-2">
                <Label htmlFor="email-evidence-reference">{t("emailEvidence.reference")}</Label>
                <Input
                  id="email-evidence-reference"
                  dir="ltr"
                  maxLength={80}
                  value={draft.evidenceReference}
                  disabled={mutation.isPending}
                  onChange={(event) =>
                    setDraft({ ...draft, evidenceReference: event.target.value })
                  }
                />
                <p className="text-caption">{t("emailEvidence.referenceHint")}</p>
              </div>
              {(
                [
                  ["domainVerificationStatus", "si.domainVerification"],
                  ["spfStatus", "si.spf"],
                  ["dkimStatus", "si.dkim"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className="grid gap-1">
                  <Label>{t(label)}</Label>
                  <Select
                    disabled={mutation.isPending}
                    value={draft[field]}
                    onValueChange={(value) =>
                      setDraft({ ...draft, [field]: value as EmailReadinessState })
                    }
                  >
                    <SelectTrigger aria-label={t(label)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_READINESS_STATES.map((value) => (
                        <SelectItem value={value} key={value}>
                          {t(
                            `si.emailCheck.${value.toLowerCase() as "not_configured" | "pending" | "verified" | "failed"}`,
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {mutation.isError && (
                <p role="alert" className="text-danger">
                  {t(
                    mutation.error instanceof ApiError && mutation.error.statusCode === 409
                      ? "emailEvidence.conflict"
                      : "emailEvidence.error",
                  )}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => setDraft(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={
                    mutation.isPending || !EMAIL_EVIDENCE_REFERENCE.test(draft.evidenceReference)
                  }
                  onClick={() => mutation.mutate(draft)}
                >
                  {mutation.isPending ? t("common.saving") : t("emailEvidence.confirmRecord")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
