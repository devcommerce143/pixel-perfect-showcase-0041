import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { documentationRoutes } from "@/lib/api/documentation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/docs")({
  head: () => pageHead("API Documentation", "Developer reference for the Dolf Connect API: authentication, messaging, templates, webhooks and errors."),
  component: () => <RequirePermission permission="docs.view"><Docs /></RequirePermission>,
});

const TOC: MessageKey[] = ["docs.auth", "docs.send", "docs.bulk", "docs.templates", "docs.status", "docs.webhooks", "docs.errors", "docs.idempotency"];

const SAMPLE = `POST /api/v1/messages
Authorization: Basic <base64(clientId:secret)>
Idempotency-Key: example-unique-key-0001
Content-Type: application/json

{
  "channel": "SMS",
  "senderId": "<sender-uuid>",
  "recipient": "+9665XXXXXXXX",
  "sms": { "body": "Your verification code is 482913" }
}

201 Created (200 OK on matching replay)
{
  "id": "<message-uuid>",
  "status": "ACCEPTED",
  "channel": "SMS",
  "acceptedAt": "2026-10-22T09:00:00.000Z",
  "queuedAt": null
}`;

const BULK_SAMPLE = `POST /api/v1/bulk-jobs
Authorization: Basic <base64(clientId:secret)>
Idempotency-Key: example-bulk-key-0001
Content-Type: application/json

{
  "channel": "SMS",
  "senderId": "<sender-uuid>",
  "mode": "SHARED",
  "sms": { "body": "Example notification" },
  "items": [{ "recipient": "+9665XXXXXXXX" }]
}`;

function Docs() {
  const { t } = useI18n();
  const { can } = useSession();
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const platform = can("platform.config");
  const routes = documentationRoutes(platform && all, search);
  return (
    <>
      <PageHeader title={t("docs.title")} description={t("docs.subtitle")} />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
          <nav className="panel self-start p-2" aria-label={t("docs.title")}>
            <ul className="flex flex-col gap-0.5">
              <li><a href="#api-reference" className="block rounded-md px-2.5 py-1.5 text-[0.8125rem] hover:bg-muted">{t("docs.reference")}</a></li>
              {TOC.map((k) => (
                <li key={k}><a href={`#${k}`} className="block rounded-md px-2.5 py-1.5 text-[0.8125rem] hover:bg-muted">{t(k)}</a></li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-col gap-4">
            <Section title={t("docs.reference")}>
              <div id="api-reference" className="space-y-4 p-4">
                <p className="text-body">{t("docs.referenceBody")}</p>
                <p className="text-subtle">{t("docs.baseBody")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant={!all ? "default" : "outline"} onClick={() => setAll(false)} aria-pressed={!all}>{t("docs.clientReference")}</Button>
                  {platform && <Button variant={all ? "default" : "outline"} onClick={() => setAll(true)} aria-pressed={all}>{t("docs.fullReference")}</Button>}
                </div>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("docs.search")} aria-label={t("docs.search")} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-start">
                      <th className="p-3 text-start">{t("docs.method")}</th>
                      <th className="p-3 text-start">{t("docs.path")}</th>
                      <th className="p-3 text-start">{t("docs.authentication")}</th>
                    </tr></thead>
                    <tbody>{routes.map((route) => <tr key={`${route.method}:${route.path}`} className="border-b last:border-0">
                      <td className="p-3 font-mono" dir="ltr">{route.method}</td>
                      <td className="p-3 font-mono" dir="ltr">{route.path}</td>
                      <td className="p-3">{t(`docs.audience.${route.audience}`)}</td>
                    </tr>)}</tbody>
                  </table>
                  {!routes.length && <p className="p-4 text-subtle">{t("docs.noResults")}</p>}
                </div>
                {platform && all && <p className="text-subtle">{t("docs.platformBody")}</p>}
              </div>
            </Section>
            <Section title={t("docs.auth")}><p id="docs.auth" className="px-4 py-3 text-body">{t("docs.authBody")}</p></Section>
            <Section title={t("docs.send")} description={t("docs.illustrative")}>
              <p id="docs.send" className="px-4 pt-3 text-body">{t("docs.sendBody")}</p>
              <pre dir="ltr" className="m-4 overflow-x-auto rounded-md bg-sidebar p-4 font-mono text-xs leading-5 text-sidebar-foreground">{SAMPLE}</pre>
            </Section>
            <Section title={t("docs.bulk")}>
              <p id="docs.bulk" className="px-4 py-3 text-body">{t("docs.bulkBody")}</p>
              <pre dir="ltr" className="m-4 overflow-x-auto rounded-md bg-sidebar p-4 font-mono text-xs leading-5 text-sidebar-foreground">{BULK_SAMPLE}</pre>
            </Section>
            <Section title={t("docs.templates")}><p id="docs.templates" className="px-4 py-3 text-body">{t("docs.templatesBody")}</p></Section>
            <Section title={t("docs.status")}><p id="docs.status" className="px-4 py-3 text-body">{t("docs.statusBody")}</p></Section>
            <Section title={t("docs.webhooks")}><p id="docs.webhooks" className="px-4 py-3 text-body">{t("docs.webhooksBody")}</p></Section>
            <Section title={t("docs.errors")}><p id="docs.errors" className="px-4 py-3 text-body">{t("docs.errorsBody")}</p></Section>
            <Section title={t("docs.idempotency")}><p id="docs.idempotency" className="px-4 py-3 text-body">{t("docs.idempotencyBody")}</p></Section>
          </div>
        </div>
      </PageBody>
    </>
  );
}
