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
  const { data: m, isLoading } = useQuery(queries.message(messageId));
  const copy = (v: string) => { void navigator.clipboard?.writeText(v); toast.success(t("common.copied")); };

  const back = <Button asChild variant="outline" size="sm"><Link to="/messages"><ArrowLeft className="size-4 rtl:rotate-180" />{t("nav.history")}</Link></Button>;

  if (isLoading) return <PageBody><div className="panel"><TableSkeleton rows={6} /></div></PageBody>;
  if (!m) return (
    <PageBody><div className="panel"><EmptyState icon={FileSearch} title={t("common.notFound")} body={t("msg.notFound")} action={back} /></div></PageBody>
  );

  return (
    <>
      <PageHeader
        title={m.id}
        description={`${t(`channel.${m.channel}`)} · ${m.applicationName} · ${formatDateTime(m.createdAt, locale)}`}
        actions={<><StatusBadge status={m.status} className="text-[0.8125rem] px-2 py-1" />{back}</>}
      />
      <PageBody>
        {m.errorMessage && (
          <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <div className="text-[0.8125rem]">
              <div className="font-semibold">{t("msg.error")} · <span className="font-mono">{m.errorCode}</span></div>
              <div>{m.errorMessage}</div>
            </div>
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="flex flex-col gap-4 xl:col-span-3">
            <Section title={t("msg.metadata")}>
              <dl className="divide-y">
                <Field label={t("common.messageId")} mono>
                  <span className="inline-flex items-center gap-1.5">{m.id}
                    <button onClick={() => copy(m.id)} aria-label={t("common.copy")} className="text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
                  </span>
                </Field>
                <Field label={t("common.channel")}><ChannelLabel channel={m.channel} /></Field>
                <Field label={t("common.recipient")} mono><span dir="ltr">{m.recipient}</span></Field>
                <Field label={t("common.application")}>{m.applicationName} <span className="font-mono text-xs text-muted-foreground">({m.applicationId})</span></Field>
                <Field label={t("common.template")} mono>{m.templateName ?? "—"}</Field>
                <Field label={t("msg.source")}>{m.source.toUpperCase()}{m.bulkJobId && <span className="ms-2 font-mono text-xs text-muted-foreground">{m.bulkJobId}</span>}</Field>
                <Field label={t("msg.segments")}>{m.segments}</Field>
                <Field label={t("msg.correlation")} mono>{m.correlationId}</Field>
                <Field label={t("common.updatedAt")}>{formatDateTime(m.updatedAt, locale)}</Field>
              </dl>
            </Section>
            <Section title={t("msg.detail.content" as never) === "msg.detail.content" ? t("send.body") : t("send.body")}>
              <p className="whitespace-pre-wrap px-4 py-3 text-body" dir="auto">{m.preview}</p>
              <p className="flex items-center gap-1.5 border-t bg-surface-subtle px-4 py-2 text-caption"><Info className="size-3.5" />{t("msg.masked")}</p>
            </Section>
          </div>

          <Section title={t("msg.timeline")} className="xl:col-span-2 self-start">
            <ol className="relative px-4 py-4">
              {m.events.map((e, i) => {
                const def = STATUS_DEFS[e.status];
                const Icon = def.icon;
                const last = i === m.events.length - 1;
                return (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {!last && <span className="absolute start-3.5 top-7 bottom-0 w-px bg-border" aria-hidden />}
                    <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[def.tone])}>
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="pt-0.5">
                      <div className="text-[0.8125rem] font-medium">{t(`status.${e.status}` as MessageKey)}</div>
                      <div className="text-caption tabular-nums">{formatTime(e.at, locale)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="border-t px-4 py-2 text-caption">{t("msg.channelNote")}</p>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
