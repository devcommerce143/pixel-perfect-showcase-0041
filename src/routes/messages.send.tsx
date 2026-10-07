import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Info, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CHANNEL_META } from "@/components/app/ChannelLabel";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { renderTemplateVariables } from "@/lib/api/template-variables";

export const Route = createFileRoute("/messages/send")({
  head: () => pageHead("Send Message", "Send a single SMS, WhatsApp or Email message through Dolf Connect managed channels."),
  component: () => <RequirePermission permission="messages.send"><SendMessage /></RequirePermission>,
});

const PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NONE = "__none";

function SendMessage() {
  const { t } = useI18n();
  const { user } = useSession();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const queryClient = useQueryClient();
  const apps = useQuery(queries.applications(actor));
  const templates = useQuery(queries.templates({}, actor));
  const [channel, setChannel] = useState<Channel>("sms");
  const [appId, setAppId] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState(NONE);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const channelApps = (apps.data ?? []).filter((a) => a.tenantId === actor.tenantId && a.status === "active" && a.channels.includes(channel));
  const senderIdentities = useQuery(queries.sendableSenderIdentities(actor, appId, channel));
  const channelTemplates = (templates.data?.items ?? []).filter((template) => template.channel === channel && (channel === "whatsapp" ? template.status === "approved" : template.status === "active"));
  const requiresTemplate = channel === "whatsapp";
  const selectedTemplate = channelTemplates.find((item) => item.id === templateId);
  const variableNames = selectedTemplate?.variables ?? [];
  const renderedBody = selectedTemplate ? renderTemplateVariables(selectedTemplate.body, variableValues) : body;
  const missingVariables = variableNames.some((key) => !variableValues[key]?.trim());
  const smsUnicode = Array.from(renderedBody).some((character) => character.charCodeAt(0) > 0x7f);
  const smsSegments = Math.max(1, Math.ceil(renderedBody.length / (smsUnicode ? 70 : 160)));

  const errors = useMemo(() => {
    const e: Partial<Record<"app" | "sender" | "recipient" | "template" | "body" | "subject" | "variables", string>> = {};
    if (!appId) e.app = t("send.required");
    if (!senderIdentityId || !(senderIdentities.data ?? []).some((identity) => identity.id === senderIdentityId)) e.sender = t("send.senderRequired");
    if (!recipient) e.recipient = t("send.required");
    else if (channel === "email" ? !EMAIL.test(recipient) : !PHONE.test(recipient.replace(/\s/g, ""))) e.recipient = channel === "email" ? t("send.invalidEmail") : t("send.invalidPhone");
    if (requiresTemplate && templateId === NONE) e.template = t("send.whatsappTemplateOnly");
    if (!renderedBody.trim()) e.body = t("send.required");
    if (missingVariables) e.variables = t("send.variablesRequired");
    if (channel === "email" && !subject) e.subject = t("send.required");
    return e;
  }, [appId, senderIdentityId, senderIdentities.data, recipient, channel, templateId, renderedBody, subject, requiresTemplate, missingVariables, t]);

  const mutation = useMutation({
    mutationFn: () => api.sendMessage({ channel, applicationId: appId, senderIdentityId, recipient, templateId: templateId === NONE ? null : templateId, subject, body: renderedBody, idempotencyKey: crypto.randomUUID() }, actor),
    onSuccess: async (r) => {
      setConfirmOpen(false);
      setLastId(r.id);
      toast.success(t("send.success", { id: r.id }));
      setRecipient("");
      setTouched(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["report"] }),
      ]);
    },
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) setConfirmOpen(true);
  };
  const err = (k: keyof typeof errors) => touched && errors[k] ? <p id={`${k}-err`} className="text-xs text-danger">{errors[k]}</p> : null;

  const changeChannel = (c: Channel) => { setChannel(c); setAppId(""); setSenderIdentityId(""); setTemplateId(NONE); setBody(""); setSubject(""); setVariableValues({}); setTouched(false); };
  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const template = channelTemplates.find((item) => item.id === id);
    setBody(id === NONE ? "" : template?.body ?? "");
    setSubject(id === NONE ? "" : template?.subject ?? "");
    setVariableValues({});
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
                  <Select value={appId} onValueChange={(value) => { setAppId(value); setSenderIdentityId(""); }}>
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
                <Label htmlFor="sender-identity">{t("send.senderIdentity")}</Label>
                <Select value={senderIdentityId} onValueChange={setSenderIdentityId} disabled={!appId || senderIdentities.isLoading || !(senderIdentities.data?.length)}>
                  <SelectTrigger id="sender-identity" aria-invalid={!!(touched && errors.sender)}><SelectValue placeholder={t("send.selectSenderIdentity")} /></SelectTrigger>
                  <SelectContent>{(senderIdentities.data ?? []).map((identity) => <SelectItem key={identity.id} value={identity.id}>{identity.displayName ? `${identity.displayName} · ${identity.identityValue}` : identity.identityValue}</SelectItem>)}</SelectContent>
                </Select>
                {err("sender") ?? (!appId ? <p className="text-caption">{t("send.selectAppFirst")}</p> : !senderIdentities.isLoading && !senderIdentities.data?.length ? <p className="text-caption">{t("send.noEligibleSender")}</p> : <p className="text-caption">{t("send.senderEligibilityHint")}</p>)}
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

              {variableNames.length > 0 && <div className="space-y-3 rounded-md border bg-surface-subtle p-3"><h3 className="text-sm font-medium">{t("send.templateVariables")}</h3><div className="grid gap-3 sm:grid-cols-2">{variableNames.map((key) => <div key={key} className="space-y-1.5"><Label htmlFor={`variable-${key}`}>{key} *</Label><Input id={`variable-${key}`} value={variableValues[key] ?? ""} onChange={(event) => setVariableValues({ ...variableValues, [key]: event.target.value })} aria-invalid={!!(touched && !variableValues[key]?.trim())} /></div>)}</div>{err("variables")}</div>}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="body">{t("send.body")}</Label>
                <Textarea id="body" dir="auto" rows={6} value={renderedBody} onChange={(e) => setBody(e.target.value)} readOnly={templateId !== NONE} aria-invalid={!!(touched && errors.body)} />
                <div className="flex justify-between">{err("body") ?? <span />}<span className="text-caption tabular-nums">{t("send.chars", { count: renderedBody.length })}{channel === "sms" ? ` · ${t("send.smsSegments", { count: smsSegments, encoding: t(smsUnicode ? "tpl.unicode" : "tpl.gsm") })}` : ""}</span></div>
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
      <AlertDialog open={confirmOpen} onOpenChange={(value) => !mutation.isPending && setConfirmOpen(value)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("send.confirmTitle")}</AlertDialogTitle><AlertDialogDescription>{t("send.confirmBody", { channel: t(`channel.${channel}`), recipient })}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} onClick={(event) => { event.preventDefault(); mutation.mutate(); }}>{mutation.isPending ? t("send.submitting") : t("send.confirm")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
