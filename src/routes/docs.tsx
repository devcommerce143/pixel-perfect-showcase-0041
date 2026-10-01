import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/docs")({
  head: () => pageHead("API Documentation", "Developer reference for the Dolf Connect API: authentication, messaging, templates, webhooks and errors."),
  component: () => <RequirePermission permission="docs.view"><Docs /></RequirePermission>,
});

const TOC: MessageKey[] = ["docs.auth", "docs.send", "docs.bulk", "docs.templates", "docs.status", "docs.webhooks", "docs.errors", "docs.idempotency"];

const SAMPLE = `POST /v1/messages
Authorization: Bearer <access_token>
Idempotency-Key: 6f1c2a0e-9b7d-4c1e-a2f3-0d9e8b7a6c51
Content-Type: application/json

{
  "channel": "sms",
  "to": "+9665XXXXXXXX",
  "template": "otp_login_en",
  "parameters": { "code": "482913" }
}

202 Accepted
{ "id": "MSG-20261001-004812", "status": "accepted" }`;

function Docs() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("docs.title")} description={t("docs.subtitle")} />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
          <nav className="panel self-start p-2" aria-label={t("docs.title")}>
            <ul className="flex flex-col gap-0.5">
              {TOC.map((k) => (
                <li key={k}><a href={`#${k}`} className="block rounded-md px-2.5 py-1.5 text-[0.8125rem] hover:bg-muted">{t(k)}</a></li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-4 py-2.5 text-[0.8125rem] text-warning">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{t("docs.tbd")}
            </div>
            <Section title={t("docs.auth")}><p id="docs.auth" className="px-4 py-3 text-body">{t("docs.authBody")}</p></Section>
            <Section title={t("docs.send")} description={t("docs.illustrative")}>
              <p id="docs.send" className="px-4 pt-3 text-body">{t("docs.sendBody")}</p>
              <pre dir="ltr" className="m-4 overflow-x-auto rounded-md bg-sidebar p-4 font-mono text-xs leading-5 text-sidebar-foreground">{SAMPLE}</pre>
            </Section>
            <Section title={t("docs.idempotency")}><p id="docs.idempotency" className="px-4 py-3 text-body">{t("docs.idempotencyBody")}</p></Section>
          </div>
        </div>
      </PageBody>
    </>
  );
}
