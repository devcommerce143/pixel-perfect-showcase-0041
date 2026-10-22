import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { queries } from "@/lib/api/queries";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { Section } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ErrorState, TableSkeleton } from "@/components/app/States";
import { Button } from "@/components/ui/button";

export function ProviderAttemptHistory({
  actor,
  tenantId,
  messageId,
}: {
  actor: SenderIdentityActor;
  tenantId: string;
  messageId: string;
}) {
  const { t, locale } = useI18n();
  const history = useQuery(queries.providerAttempts(actor, tenantId, messageId));
  return (
    <Section title={t("providerAttempts.title")}>
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{t("providerAttempts.note")}</p>
        {history.isLoading && <TableSkeleton rows={3} />}
        {history.isError && <ErrorState onRetry={() => void history.refetch()} />}
        {!history.isError && history.data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                {t(
                  history.data.providerChanged
                    ? "providerAttempts.change"
                    : "providerAttempts.noChange",
                )}
              </p>
              <Button
                variant="outline"
                disabled={history.isFetching}
                onClick={() => void history.refetch()}
              >
                {t("common.refresh")}
              </Button>
            </div>
            <p className="flex items-center gap-2 text-sm">
              {t("providerAttempts.recordedStatus")}{" "}
              <StatusBadge status={history.data.messageStatus} />
            </p>
            {!history.data.attempts.length ? (
              <p className="text-sm text-muted-foreground">{t("msg.noAttempts")}</p>
            ) : (
              <ol className="space-y-3">
                {history.data.attempts.map((attempt) => (
                  <li key={attempt.attemptNumber} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>{t("msg.attemptNumber", { number: attempt.attemptNumber })}</span>
                      <StatusBadge status={attempt.state} />
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">{t("providerAttempts.account")}</dt>
                        <dd className="break-all font-mono text-xs">
                          {attempt.providerAccountId ? (
                            <Link
                              className="text-primary underline"
                              to="/platform/providers"
                              search={{ providerId: attempt.providerAccountId }}
                            >
                              {attempt.providerAccountId}
                            </Link>
                          ) : (
                            t("ten.unavailable")
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("providerAttempts.code")}</dt>
                        <dd className="break-all font-mono text-xs">
                          {attempt.providerAccountCode ?? t("ten.unavailable")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("providerAttempts.route")}</dt>
                        <dd className="break-all font-mono text-xs">
                          {attempt.providerRouteId ?? t("ten.unavailable")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("providerAttempts.binding")}</dt>
                        <dd className="break-all font-mono text-xs">
                          {attempt.senderProviderBindingId ?? t("ten.unavailable")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("msg.startedAt")}</dt>
                        <dd>{formatDateTime(attempt.startedAt, locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("msg.completedAt")}</dt>
                        <dd>
                          {attempt.finishedAt
                            ? formatDateTime(attempt.finishedAt, locale)
                            : t("ten.unavailable")}
                        </dd>
                      </div>
                      {attempt.errorCategory && (
                        <div>
                          <dt className="text-muted-foreground">{t("msg.failureCategory")}</dt>
                          <dd>
                            {t(
                              `msg.attemptError.${attempt.errorCategory.toLowerCase()}` as MessageKey,
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
