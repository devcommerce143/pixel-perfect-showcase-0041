import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Info, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CHANNEL_META } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/send")({
  head: () => pageHead("Send Message", "Send a single SMS, WhatsApp or Email message through Dolf Connect managed channels."),
  component: () => <RequirePermission permission="messages.send"><SendMessage /></RequirePermission>,
});

const PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NONE = "__none";

function SendMessage() {
  const { t } = useI18n();
  const apps = useQuery(queries.applications());
  const templates = useQuery(queries.templates({ status: "approved" }));
  const [channel, setChannel] = useState<Channel>("sms");
  const [appId, setAppId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState(NONE);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const channelApps = (apps.data ?? []).filter((a) => a.status === "active" && a.channels.includes(channel));
  const channelTemplates = (templates.data?.items ?? []).filter((tp) => tp.channel === channel);
  const requiresTemplate = channel === "whatsapp";

  const errors = useMemo(() => {
    const e: Partial<Record<"app" | "recipient" | "template" | "body" | "subject", string>> = {};
    if (!appId) e.app = t("send.required");
    if (!recipient) e.recipient = t("send.required");
    else if (channel === "email" ? !EMAIL.test(recipient) : !PHONE.test(recipient.replace(/\s/g, ""))) e.recipient = channel === "email" ? t("send.invalidEmail") : t("send.invalidPhone");
    if (requiresTemplate && templateId === NONE) e.template = t("send.whatsappTemplateOnly");
    if (!body) e.body = t("send.required");
    if (channel === "email" && !subject) e.subject = t("send.required");
    return e;
  }, [appId, recipient, channel, templateId, body, subject, requiresTemplate, t]);

  const mutation = useMutation({
    mutationFn: () => api.sendMessage({ channel, applicationId: appId, recipient, templateId: templateId === NONE ? null : templateId, subject, body, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (r) => { setLastId(r.id); toast.success(t("send.success", { id: r.id })); setRecipient(""); setTouched(false); },
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) mutation.mutate();
  };
  const err = (k: keyof typeof errors) => touched && errors[k] ? <p id={`${k}-err`} className="text-xs text-danger">{errors[k]}</p> : null;

  const changeChannel = (c: Channel) => { setChannel(c); setAppId(""); setTemplateId(NONE); setBody(""); setTouched(false); };
  const pickTemplate = (id: string) => {
    setTemplateId(id);
    setBody(id === NONE ? "" : channelTemplates.find((x) => x.id === id)?.body ?? "");
  };

  return (
    <>
      <PageHeader title={t("send.title")} description={t("send.subtitle")} />
      <PageBody>
        <div className="grid gap-4 xl:grid-cols-3">
          <form onSubmit={submit} noValidate className="panel xl:col-span-2">
            <div className="flex flex-col gap-5 p-5">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-[0.8125rem] font-medium">{t("common.channel")}</legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {(["sms", "whatsapp", "email"] as const).map((c) => {
                    const { icon: Icon, color } = CHANNEL_META[c];
                    const active = channel === c;
                    return (
                      <button key={c} type="button" role="radio" aria-checked={active} onClick={() => changeChannel(c)}
                        className={cn("flex items-center gap-2 rounded-md border px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
                          active ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "hover:bg-muted")}>
                        <Icon className={cn("size-4", color)} />{t(`channel.${c}`)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="app">{t("send.application")}</Label>
                  <Select value={appId} onValueChange={setAppId}>
                    <SelectTrigger id="app" aria-invalid={!!(touched && errors.app)}><SelectValue placeholder={t("send.selectApp")} /></SelectTrigger>
                    <SelectContent>{channelApps.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} · {a.id}</SelectItem>)}</SelectContent>
                  </Select>
                  {err("app")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="recipient">{t("send.recipient")}</Label>
                  <Input id="recipient" dir="ltr" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                    placeholder={channel === "email" ? "name@company.example" : "+9665XXXXXXXX"} aria-invalid={!!(touched && errors.recipient)} className="font-mono text-[0.8125rem]" />
                  {err("recipient") ?? <p className="text-caption">{channel === "email" ? t("send.recipientHintEmail") : t("send.recipientHintPhone")}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="template">{t("common.template")}</Label>
                <Select value={templateId} onValueChange={pickTemplate}>
                  <SelectTrigger id="template"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!requiresTemplate && <SelectItem value={NONE}>{t("send.templateNone")}</SelectItem>}
                    {channelTemplates.map((tp) => <SelectItem key={tp.id} value={tp.id}>{tp.name} · v{tp.version} · {tp.language.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
                {err("template") ?? (requiresTemplate && <p className="flex items-center gap-1 text-caption"><Info className="size-3.5" />{t("send.whatsappTemplateOnly")}</p>)}
              </div>

              {channel === "email" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="subject">{t("send.subject")}</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} aria-invalid={!!(touched && errors.subject)} />
                  {err("subject")}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="body">{t("send.body")}</Label>
                <Textarea id="body" dir="auto" rows={6} value={body} onChange={(e) => setBody(e.target.value)} readOnly={templateId !== NONE} aria-invalid={!!(touched && errors.body)} />
                <div className="flex justify-between">{err("body") ?? <span />}<span className="text-caption tabular-nums">{t("send.chars", { count: body.length })}</span></div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t bg-surface-subtle px-5 py-3">
              <p className="flex items-center gap-1.5 text-caption"><ShieldCheck className="size-3.5" />{t("send.idempotency")}</p>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:-scale-x-100" />}
                {mutation.isPending ? t("send.submitting") : t("send.submit")}
              </Button>
            </div>
          </form>

          <Section title={t("send.summary")} className="self-start">
            <dl className="divide-y text-table">
              <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">{t("common.channel")}</dt><dd>{t(`channel.${channel}`)}</dd></div>
              <div className="flex justify-between gap-2 px-4 py-2.5"><dt className="text-muted-foreground">{t("common.application")}</dt><dd className="truncate">{channelApps.find((a) => a.id === appId)?.name ?? "—"}</dd></div>
              <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">{t("common.recipient")}</dt><dd dir="ltr" className="font-mono text-xs">{recipient || "—"}</dd></div>
              <div className="flex justify-between px-4 py-2.5"><dt className="text-muted-foreground">{t("send.chars", { count: "" }).trim() || "Length"}</dt><dd className="tabular-nums">{body.length}</dd></div>
            </dl>
            {lastId && (
              <div className="border-t px-4 py-3 text-[0.8125rem]">
                <Link to="/messages/$messageId" params={{ messageId: lastId }} className="font-mono text-xs text-primary hover:underline">{lastId}</Link>
              </div>
            )}
          </Section>
        </div>
      </PageBody>
    </>
  );
}
