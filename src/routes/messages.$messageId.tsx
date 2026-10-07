import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, FileSearch, Info, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState, TableSkeleton } from "@/components/app/States";
import { STATUS_DEFS, TONE_CLASSES } from "@/components/app/status";
import { Button } from "@/components/ui/button";
import { queries } from "@/lib/api/queries";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { formatDateTime, formatTime } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$messageId")({
  head: ({ params }) => pageHead(params.messageId, `Delivery timeline and metadata for message ${params.messageId}.`),
  component: () => <RequirePermission permission="messages.view"><MessageDetail /></RequirePermission>,
});

function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2.5 text-table">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("col-span-2 min-w-0 break-words", mono && "font-mono text-xs")}>{children}</dd>
    </div>
  );
}

function MessageDetail() {
  const { messageId } = Route.useParams();
  const { t, locale } = useI18n();
  const { user, isPlatform } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const { data: message, isLoading } = useQuery(queries.message(messageId, actor, scopedTenantId));
  const copy = (value: string) => { void navigator.clipboard?.writeText(value); toast.success(t("common.copied")); };
  const back = <Button asChild variant="outline" size="sm"><Link to="/messages"><ArrowLeft className="size-4 rtl:rotate-180" />{t("nav.history")}</Link></Button>;

  if (isLoading) return <PageBody><div className="panel"><TableSkeleton rows={6} /></div></PageBody>;
  if (!message) return <PageBody><div className="panel"><EmptyState icon={FileSearch} title={t("common.notFound")} body={t("msg.notFound")} action={back} /></div></PageBody>;

  const timeline = message.statusHistory ?? message.events;
  return (
    <>
      <PageHeader title={message.id} description={`${t(`channel.${message.channel}`)} · ${message.applicationName} · ${formatDateTime(message.createdAt, locale)}`} actions={<><StatusBadge status={message.status} className="px-2 py-1 text-[0.8125rem]" />{back}</>} />
      <PageBody>
        {(message.failure || message.errorMessage) && (
          <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div className="text-[0.8125rem]">
              <div className="font-semibold">{message.failure ? t(`msg.failure.stage.${message.failure.stage}` as MessageKey) : t("msg.error")} · <span className="font-mono">{message.errorCode}</span></div>
              <div>{message.failure?.reason ?? message.errorMessage}</div>
              {message.failure && isPlatform && <div className="mt-1 text-xs">{t(`msg.failure.category.${message.failure.category}` as MessageKey)} · {t("msg.failoverAttempted")}: {t(message.failure.failoverAttempted ? "common.yes" : "common.no")}</div>}
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-5">
          <div className="flex flex-col gap-4 xl:col-span-3">
            <Section title={t("msg.metadata")}>
              <dl className="divide-y">
                <Field label={t("common.messageId")} mono>
                  <span className="inline-flex items-center gap-1.5">{message.id}<button onClick={() => copy(message.id)} aria-label={t("common.copy")} className="text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button></span>
                </Field>
                {isPlatform && !selectedTenantId && <Field label={t("common.tenant")}>{message.tenantName}</Field>}
                <Field label={t("common.channel")}><ChannelLabel channel={message.channel} /></Field>
                <Field label={t("common.recipient")} mono><span dir="ltr">{message.recipient}</span></Field>
                <Field label={t("common.application")}>{message.applicationName} <span className="font-mono text-xs text-muted-foreground">({message.applicationId})</span></Field>
                <Field label={t("msg.senderIdentity")}><span dir="ltr">{message.senderIdentityValue ?? "—"}</span></Field>
                <Field label={t("common.template")} mono>{message.templateName ? `${message.templateName}${message.templateVersion ? ` · v${message.templateVersion}` : ""}` : "—"}</Field>
                {message.subject && <Field label={t("send.subject")}>{message.subject}</Field>}
                <Field label={t("msg.source")}>{t(message.source === "api" ? "msg.source.api" : message.source === "portal" ? "msg.source.portal" : "msg.source.bulk")}{message.bulkJobId && <span className="ms-2 font-mono text-xs text-muted-foreground">{message.bulkJobId}</span>}</Field>
                <Field label={t("common.createdAt")}>{formatDateTime(message.createdAt, locale)}</Field>
                {message.submittedAt && <Field label={t("msg.submittedAt")}>{formatDateTime(message.submittedAt, locale)}</Field>}
                <Field label={t("common.updatedAt")}>{formatDateTime(message.updatedAt, locale)}</Field>
                {message.clientReference && <Field label={t("msg.clientReference")} mono>{message.clientReference}</Field>}
                {message.idempotencyStatus && <Field label={t("msg.idempotency")}>{t(`msg.idempotency.${message.idempotencyStatus}` as MessageKey)}{message.idempotencyReference && <span className="ms-2 font-mono text-xs text-muted-foreground">{message.idempotencyReference}</span>}</Field>}
                {message.channel === "sms" && <Field label={t("msg.segments")}>{message.segments}</Field>}
                <Field label={t("msg.correlation")} mono>{message.correlationId}</Field>
              </dl>
            </Section>
            <Section title={t("send.body")}>
              {message.subject && <p className="border-b px-4 py-2 text-sm font-medium">{message.subject}</p>}
              <p className="whitespace-pre-wrap px-4 py-3 text-body" dir="auto">{message.preview}</p>
              <p className="flex items-center gap-1.5 border-t bg-surface-subtle px-4 py-2 text-caption"><Info className="size-3.5" />{t("msg.masked")}</p>
            </Section>
          </div>

          <div className="flex flex-col gap-4 xl:col-span-2">
            {isPlatform && message.routingDelivery && (
              <Section title={t("msg.routingDelivery")}>
                <dl className="divide-y">
                  <Field label={t("msg.routingRule")}>{message.routingDelivery.routingRuleName ?? "—"}</Field>
                  <Field label={t("msg.initialProvider")}>{message.routingDelivery.initialProviderName ?? "—"}</Field>
                  <Field label={t("msg.finalProvider")}>{message.routingDelivery.finalProviderName ?? "—"}</Field>
                  <Field label={t("msg.failoverOccurred")}>{t(message.routingDelivery.failoverOccurred ? "common.yes" : "common.no")}</Field>
                  <Field label={t("msg.attempts")}>{message.routingDelivery.totalProviderAttempts}</Field>
                  <Field label={t("msg.providerReference")} mono>{message.routingDelivery.finalProviderReference ?? "—"}</Field>
                  <Field label={t("msg.finalResult")}><StatusBadge status={message.status} /></Field>
                </dl>
                <div className="border-t px-4 py-3">
                  <h3 className="mb-2 text-sm font-semibold">{t("msg.attempts")}</h3>
                  {message.attempts?.length ? (
                    <ol className="space-y-3">{message.attempts.map((attempt) => (
                      <li key={attempt.number} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{t("msg.attemptNumber", { number: attempt.number })} · {t(`msg.attemptKind.${attempt.kind}` as MessageKey)}</span><StatusBadge status={attempt.result} /></div>
                        <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                          <div><dt className="text-muted-foreground">{t("msg.provider")}</dt><dd>{attempt.providerName}</dd></div>
                          <div><dt className="text-muted-foreground">{t("msg.startedAt")}</dt><dd>{formatDateTime(attempt.startedAt, locale)}</dd></div>
                          {attempt.completedAt && <div><dt className="text-muted-foreground">{t("msg.completedAt")}</dt><dd>{formatDateTime(attempt.completedAt, locale)}</dd></div>}
                          {attempt.failureCategory && <div><dt className="text-muted-foreground">{t("msg.failureCategory")}</dt><dd>{t(`msg.failure.category.${attempt.failureCategory}` as MessageKey)}</dd></div>}
                          {attempt.providerReference && <div><dt className="text-muted-foreground">{t("msg.providerReference")}</dt><dd className="font-mono">{attempt.providerReference}</dd></div>}
                          {attempt.failureReason && <div className="sm:col-span-2"><dt className="text-muted-foreground">{t("msg.failureReason")}</dt><dd>{attempt.failureReason}</dd></div>}
                        </dl>
                      </li>
                    ))}</ol>
                  ) : <p className="text-sm text-muted-foreground">{t("msg.noAttempts")}</p>}
                </div>
              </Section>
            )}
            <Section title={t("msg.timeline")}>
              <ol className="relative px-4 py-4">
                {timeline.map((event, index) => {
                  const def = STATUS_DEFS[event.status] ?? STATUS_DEFS["draft"]!;
                  const Icon = def.icon;
                  const last = index === timeline.length - 1;
                  return <li key={`${event.status}-${event.at}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">{!last && <span className="absolute start-3.5 top-7 bottom-0 w-px bg-border" aria-hidden />}<span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[def.tone])}><Icon className="size-3.5" aria-hidden /></span><div className="pt-0.5"><div className="text-[0.8125rem] font-medium">{t(`status.${event.status}` as MessageKey)}</div><div className="text-caption tabular-nums">{formatTime(event.at, locale)}</div></div></li>;
                })}
              </ol>
              <p className="border-t px-4 py-2 text-caption">{t("msg.channelNote")}</p>
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  );
}