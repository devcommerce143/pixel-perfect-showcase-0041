import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import type { MessageHistoryDetail, SenderIdentityActor } from "@/lib/api/types";
import { unknownResolutionAvailable, unknownResolutionKey } from "@/lib/api/unknown-resolution";
import { UnknownResolutionPanel } from "./UnknownResolutionPanel";
import { ProviderAttemptHistory } from "./ProviderAttemptHistory";
import { providerAttemptsKey } from "@/lib/api/provider-attempts";
import { roleHas } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import type { ReactNode } from "react";

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2.5 text-table">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`col-span-2 min-w-0 break-words${mono ? " font-mono text-xs" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

export function MessageHistoryDetailLive({
  message,
  actor,
  tenantId,
}: {
  message: MessageHistoryDetail;
  actor: SenderIdentityActor;
  tenantId: string | undefined;
}) {
  const { t, locale } = useI18n();
  const timeline = [
    { status: "accepted", at: message.acceptedAt },
    ...(message.queuedAt ? [{ status: "queued", at: message.queuedAt }] : []),
  ];

  return (
    <>
      <PageHeader
        title={message.id}
        description={`${t(`channel.${message.channel}`)} · ${message.applicationId} · ${formatDateTime(message.acceptedAt, locale)}`}
        actions={
          <>
            <StatusBadge status={message.status} className="px-2 py-1 text-[0.8125rem]" />
            <Button asChild variant="outline" size="sm">
              <Link to="/messages">
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {t("nav.history")}
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="flex flex-col gap-4 xl:col-span-3">
            <Section title={t("msg.metadata")}>
              <dl className="divide-y">
                <Field label={t("common.messageId")} mono>
                  {message.id}
                </Field>
                <Field label={t("common.channel")}>
                  <ChannelLabel channel={message.channel} />
                </Field>
                <Field label={t("msg.applicationId")} mono>
                  {message.applicationId}
                </Field>
                <Field label={t("msg.recipient")} mono>
                  <span dir="ltr">{message.recipientNormalized}</span>
                </Field>
                <Field label={t("msg.senderIdentity")} mono>
                  {message.senderIdentityId}
                </Field>
                <Field label={t("msg.templateId")} mono>
                  {message.templateId ?? "—"}
                </Field>
                <Field label={t("msg.acceptedAt")}>
                  {formatDateTime(message.acceptedAt, locale)}
                </Field>
                <Field label={t("msg.queuedAt")}>
                  {message.queuedAt ? formatDateTime(message.queuedAt, locale) : "—"}
                </Field>
                <Field label={t("msg.correlation")} mono>
                  {message.correlationId ?? "—"}
                </Field>
              </dl>
            </Section>
            <Section title={t("send.body")}>
              <p className="px-4 py-3 text-body text-muted-foreground">
                {t("msg.contentUnavailable")}
              </p>
              {message.contentPurgedAt && (
                <p className="border-t px-4 py-2 text-caption text-muted-foreground">
                  {t("msg.contentPurgedAt", {
                    date: formatDateTime(message.contentPurgedAt, locale),
                  })}
                </p>
              )}
            </Section>
          </div>
          <div className="flex flex-col gap-4 xl:col-span-2">
            {tenantId && unknownResolutionAvailable(actor, tenantId, message) && (
              <UnknownResolutionPanel
                key={JSON.stringify(unknownResolutionKey(actor, tenantId, message.id))}
                actor={actor}
                tenantId={tenantId}
                messageId={message.id}
              />
            )}
            <Section title={t("msg.historyAttempts")}>
              {message.attempts.length ? (
                <ol className="divide-y">
                  {message.attempts.map((attempt) => (
                    <li key={attempt.attemptNumber} className="space-y-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {t("msg.attemptNumber", { number: attempt.attemptNumber })}
                        </span>
                        <StatusBadge status={attempt.state} />
                      </div>
                      <dl className="grid gap-1 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">{t("msg.startedAt")}</dt>
                          <dd>{formatDateTime(attempt.startedAt, locale)}</dd>
                        </div>
                        {attempt.finishedAt && (
                          <div>
                            <dt className="text-muted-foreground">{t("msg.completedAt")}</dt>
                            <dd>{formatDateTime(attempt.finishedAt, locale)}</dd>
                          </div>
                        )}
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
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">{t("msg.noAttempts")}</p>
              )}
            </Section>
            <Section title={t("msg.lifecycle")}>
              <ol className="divide-y">
                {timeline.map((event) => (
                  <li
                    key={`${event.status}-${event.at}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <StatusBadge status={event.status} />
                    <span className="text-caption tabular-nums">
                      {formatDateTime(event.at, locale)}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="border-t px-4 py-2 text-caption">{t("msg.lifecycleNote")}</p>
            </Section>
          </div>
        </div>
        {tenantId && roleHas(actor.role, "platform.providers") && (
          <ProviderAttemptHistory
            key={JSON.stringify(providerAttemptsKey(actor, tenantId, message.id))}
            actor={actor}
            tenantId={tenantId}
            messageId={message.id}
          />
        )}
      </PageBody>
    </>
  );
}
