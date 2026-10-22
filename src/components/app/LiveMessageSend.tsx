import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { ReusableContentPicker } from "./ReusableContentPicker";
import { queries, humanMessageMutations, humanBulkMutations } from "@/lib/api/queries";
import { humanBulkBody, humanBulkCsvBody, humanBulkKey } from "@/lib/api/human-bulk";
import type { HumanBulkReceipt, HumanBulkCsvInput } from "@/lib/api/human-bulk";
import {
  humanMessageBody,
  humanMessageKey,
  humanMessageScope,
  humanMessageSenderEligible,
} from "@/lib/api/human-message";
import type { HumanMessageAcceptance, HumanMessageInput } from "@/lib/api/human-message";
import type { Channel, SenderIdentityActor, SenderIdentityRead } from "@/lib/api/types";
import type { RegistryTemplate } from "@/lib/api/template-registry";
import { ApiError } from "@/lib/api/http/errors";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";
import { PageBody, PageHeader, Section } from "./PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

export function LiveMessageSend({ bulk = false }: { bulk?: boolean } = {}) {
  const { user, isPlatform } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const namedTenant = isPlatform ? tenantId : undefined;
  let scope: string;
  try {
    scope = humanMessageScope(actor, namedTenant);
  } catch {
    return (
      <PageBody>
        <EmptyState
          icon={FileSearch}
          title={t("msg.selectTenantTitle")}
          body={t("msg.selectTenantBody")}
        />
      </PageBody>
    );
  }
  return (
    <HumanMessageForm
      key={JSON.stringify(
        bulk ? humanBulkKey(actor, namedTenant) : humanMessageKey(actor, namedTenant),
      )}
      actor={actor}
      tenantId={namedTenant}
      scope={scope}
      bulk={bulk}
    />
  );
}

function OptionPages({
  page,
  total,
  busy,
  setPage,
}: {
  page: number;
  total: number;
  busy: boolean;
  setPage: (page: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || page <= 1}
        onClick={() => setPage(page - 1)}
      >
        {t("common.previous")}
      </Button>
      <span className="text-caption">{t("humanSend.page", { page, total })}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || page * 20 >= total}
        onClick={() => setPage(page + 1)}
      >
        {t("common.next")}
      </Button>
    </div>
  );
}
interface FrozenMessage {
  applicationId: string;
  input: HumanMessageInput;
  key: string;
  csv?: HumanBulkCsvInput;
}
function HumanMessageForm({
  actor,
  tenantId,
  scope,
  bulk,
}: {
  actor: SenderIdentityActor;
  tenantId: string | undefined;
  scope: string;
  bulk: boolean;
}) {
  const { t } = useI18n();
  const client = useQueryClient();
  const [appPage, setAppPage] = useState(1),
    [senderPage, setSenderPage] = useState(1),
    [templatePage, setTemplatePage] = useState(1);
  const [applicationId, setApplicationId] = useState("");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvMode, setCsvMode] = useState<"SHARED" | "PERSONALIZED">("PERSONALIZED");
  const [csvError, setCsvError] = useState(false),
    [readingCsv, setReadingCsv] = useState(false);
  const csvReadToken = useRef(0);
  const [channel, setChannel] = useState<Channel>("sms");
  const [sender, setSender] = useState<SenderIdentityRead | null>(null);
  const [template, setTemplate] = useState<RegistryTemplate | null>(null);
  const [recipient, setRecipient] = useState(""),
    [body, setBody] = useState(""),
    [subject, setSubject] = useState("");
  const [frozen, setFrozen] = useState<FrozenMessage | null>(null),
    [open, setOpen] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const [receipt, setReceipt] = useState<HumanMessageAcceptance | HumanBulkReceipt | null>(null);
  const requestRef = useRef<FrozenMessage | null>(null);
  const apps = useQuery(queries.humanMessageApplications(actor, appPage, tenantId));
  const app = useQuery(queries.application(actor, applicationId, tenantId, !!applicationId));
  const senders = useQuery({
    ...queries.humanMessageSenders(actor, channel, senderPage, tenantId, applicationId),
    enabled: !!applicationId,
  });
  const templates = useQuery({
    ...queries.templateRegistry(
      actor,
      {
        page: templatePage,
        pageSize: 20,
        registryStatus: "READY",
        providerApprovalStatus: "APPROVED",
      },
      tenantId,
    ),
    enabled: channel === "whatsapp" && !!applicationId,
  });
  const policy = useQuery(queries.tenantPolicy(actor, tenantId));
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      requestRef.current = null;
    };
  }, []);
  const mutation = useMutation<HumanMessageAcceptance | HumanBulkReceipt, Error, void>({
    mutationKey: [
      ...(bulk ? humanBulkKey(actor, tenantId) : humanMessageKey(actor, tenantId)),
      applicationId,
      "accept",
    ],
    retry: false,
    gcTime: 0,
    mutationFn: () => {
      const request = requestRef.current;
      if (!request || !acknowledged) throw new Error("Message review required");
      if (bulk && request.csv)
        return humanBulkMutations.create(
          actor,
          request.applicationId,
          request.csv,
          request.key,
          tenantId,
        );
      return (bulk ? humanBulkMutations.create : humanMessageMutations.submit)(
        actor,
        request.applicationId,
        request.input,
        request.key,
        tenantId,
      );
    },
    onSuccess: async (result) => {
      if (!active.current) return;
      setReceipt(result);
      requestRef.current = null;
      setFrozen(null);
      setOpen(false);
      setAcknowledged(false);
      setRecipient("");
      setBody("");
      setSubject("");
      setCsvText(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["messageHistory", actor.userId] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["administrativeAudit"] }),
        ...(bulk ? [client.invalidateQueries({ queryKey: ["bulkJobHistory", actor.userId] })] : []),
      ]);
    },
  });
  const locked = frozen !== null;
  const policyAllows =
    policy.data?.effective.operational === true &&
    (!bulk || policy.data.effective.features.includes("bulk_messaging")) &&
    policy.data.effective.channels.some((item) => item.channel === channel && item.enabled);
  const senderAllowed =
    app.data && sender && humanMessageSenderEligible(app.data, sender, channel, scope);
  const draft: HumanMessageInput =
    channel === "sms"
      ? { channel, senderId: sender?.id ?? "", recipient, sms: { body } }
      : channel === "email"
        ? { channel, senderId: sender?.id ?? "", recipient, email: { subject, body } }
        : {
            channel,
            senderId: sender?.id ?? "",
            recipient,
            whatsapp: {
              templateKey: template?.templateKey ?? "",
              language: template?.language ?? "",
            },
          };
  let valid = false;
  try {
    if (bulk && csvText !== null)
      humanBulkCsvBody({ channel, senderId: sender?.id ?? "", csv: csvText, mode: csvMode });
    else if (bulk) humanBulkBody(draft);
    else humanMessageBody(draft);
    valid = true;
  } catch {
    /* Local validation only; the backend is authoritative. */
  }
  const canReview =
    valid &&
    !readingCsv &&
    !csvError &&
    !!senderAllowed &&
    policyAllows &&
    !apps.isError &&
    !app.isError &&
    !senders.isError &&
    !policy.isError &&
    ((bulk && csvText !== null) || channel !== "whatsapp" || (!templates.isError && !!template));
  const senderRows = senders.data?.items ?? [];
  const templateRows = templates.data?.items ?? [];
  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    // Retain an unconfirmed attempted payload/key for a safe explicit retry.
    if (!mutation.isError) {
      requestRef.current = null;
      setFrozen(null);
      setAcknowledged(false);
      mutation.reset();
    }
  };
  return (
    <>
      <PageHeader
        title={t(bulk ? "humanBulk.title" : "humanSend.title")}
        description={t(bulk ? "humanBulk.subtitle" : "humanSend.subtitle")}
      />
      <PageBody>
        <p className="rounded-md border p-3 text-sm">
          {t(bulk ? "humanBulk.note" : "humanSend.note")}
        </p>
        {receipt && (
          <Section
            title={t(
              bulk
                ? "humanBulk.created"
                : receipt.replay
                  ? "humanSend.replayed"
                  : "humanSend.accepted",
            )}
          >
            <div role="status" className="flex flex-wrap items-center gap-3 p-4">
              <StatusBadge status={receipt.status} />
              {"itemCount" in receipt ? (
                <>
                  <p className="break-all font-mono text-sm">{receipt.id}</p>
                  <p>
                    {t("humanBulk.counts", {
                      total: receipt.itemCount,
                      invalid: receipt.invalidCount,
                      pending: receipt.pendingCount,
                      accepted: receipt.acceptedCount,
                    })}
                  </p>
                </>
              ) : (
                <Link
                  className="break-all font-mono text-sm text-primary underline"
                  to="/messages/$messageId"
                  params={{ messageId: receipt.id }}
                  search={{ historyTenantId: tenantId }}
                >
                  {receipt.id}
                </Link>
              )}
              <p className="text-sm">
                {t(bulk ? "humanBulk.receiptNote" : "humanSend.receiptNote")}
              </p>
            </div>
          </Section>
        )}
        {policy.isLoading && <TableSkeleton rows={2} />}
        {policy.isError && <ErrorState onRetry={() => void policy.refetch()} />}
        {policy.data && !policyAllows && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("humanSend.notOperational")}
          </p>
        )}
        <Section title={t("humanSend.details")}>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {bulk && (
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="human-bulk-csv"
                    checked={csvText !== null}
                    disabled={locked}
                    onCheckedChange={(value) => {
                      csvReadToken.current++;
                      setReadingCsv(false);
                      setCsvError(false);
                      setCsvText(value === true ? "" : null);
                    }}
                  />
                  <Label htmlFor="human-bulk-csv">{t("humanBulk.useCsv")}</Label>
                </div>
                {csvText !== null && (
                  <>
                    <p className="text-caption">{t("humanBulk.csvHint")}</p>
                    <Select
                      value={csvMode}
                      disabled={locked}
                      onValueChange={(value) => setCsvMode(value as "SHARED" | "PERSONALIZED")}
                    >
                      <SelectTrigger aria-label={t("humanBulk.csvMode")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERSONALIZED">{t("humanBulk.personalized")}</SelectItem>
                        <SelectItem value="SHARED">{t("humanBulk.shared")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="file"
                      accept=".csv,text/csv"
                      aria-label={t("humanBulk.csvFile")}
                      disabled={locked || readingCsv}
                      onChange={async (event) => {
                        const file = event.target.files?.[0],
                          sequence = ++csvReadToken.current;
                        setCsvText("");
                        setCsvError(false);
                        if (!file || file.size > 2 * 1024 * 1024) {
                          setCsvError(true);
                          return;
                        }
                        setReadingCsv(true);
                        try {
                          const text = await file.text();
                          if (active.current && sequence === csvReadToken.current) setCsvText(text);
                        } catch {
                          if (active.current && sequence === csvReadToken.current)
                            setCsvError(true);
                        } finally {
                          if (active.current && sequence === csvReadToken.current)
                            setReadingCsv(false);
                        }
                      }}
                    />
                    {csvError && <p role="alert">{t("humanBulk.csvError")}</p>}
                  </>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("common.application")}</Label>
              {apps.isLoading ? (
                <TableSkeleton rows={2} />
              ) : apps.isError ? (
                <ErrorState onRetry={() => void apps.refetch()} />
              ) : (
                <>
                  <Select
                    value={applicationId}
                    disabled={locked}
                    onValueChange={(id) => {
                      setApplicationId(id);
                      setSender(null);
                      setTemplate(null);
                      setSenderPage(1);
                      setTemplatePage(1);
                    }}
                  >
                    <SelectTrigger aria-label={t("common.application")}>
                      <SelectValue placeholder={t("humanSend.chooseApplication")} />
                    </SelectTrigger>
                    <SelectContent>
                      {applicationId &&
                        app.data &&
                        !apps.data?.items.some((item) => item.id === applicationId) && (
                          <SelectItem value={applicationId}>{app.data.name}</SelectItem>
                        )}
                      {(apps.data?.items ?? []).map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                          disabled={!item.scopes.includes("messages:send")}
                        >
                          {item.name} · {item.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {apps.data && (
                    <OptionPages
                      page={appPage}
                      total={apps.data.total}
                      busy={locked || apps.isFetching}
                      setPage={setAppPage}
                    />
                  )}
                </>
              )}
              {app.isError && <ErrorState onRetry={() => void app.refetch()} />}
            </div>
            <div className="space-y-2">
              <Label>{t("common.channel")}</Label>
              <Select
                value={channel}
                disabled={locked}
                onValueChange={(value) => {
                  setChannel(value as Channel);
                  setSender(null);
                  setTemplate(null);
                  setSenderPage(1);
                  setTemplatePage(1);
                }}
              >
                <SelectTrigger aria-label={t("common.channel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["sms", "email", "whatsapp"] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`channel.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("msg.senderIdentity")}</Label>
              {!applicationId ? (
                <p className="text-caption">{t("humanSend.chooseApplication")}</p>
              ) : senders.isLoading ? (
                <TableSkeleton rows={2} />
              ) : senders.isError ? (
                <ErrorState onRetry={() => void senders.refetch()} />
              ) : (
                <>
                  <Select
                    value={sender?.id ?? ""}
                    disabled={locked || !app.data}
                    onValueChange={(id) =>
                      setSender(senderRows.find((item) => item.id === id) ?? null)
                    }
                  >
                    <SelectTrigger aria-label={t("msg.senderIdentity")}>
                      <SelectValue placeholder={t("humanSend.chooseSender")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sender && !senderRows.some((item) => item.id === sender.id) && (
                        <SelectItem value={sender.id}>{sender.displayName ?? sender.id}</SelectItem>
                      )}
                      {senderRows.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                          disabled={
                            !app.data || !humanMessageSenderEligible(app.data, item, channel, scope)
                          }
                        >
                          {item.displayName ?? item.id} · {item.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {senders.data && (
                    <OptionPages
                      page={senderPage}
                      total={senders.data.total}
                      busy={locked || senders.isFetching}
                      setPage={setSenderPage}
                    />
                  )}
                  <p className="text-caption">{t("humanSend.senderNote")}</p>
                </>
              )}
            </div>
            {csvText === null && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="human-message-recipient">
                    {t(bulk ? "humanBulk.recipients" : "send.recipient")}
                  </Label>
                  {bulk ? (
                    <Textarea
                      id="human-message-recipient"
                      dir="ltr"
                      maxLength={321000}
                      value={recipient}
                      disabled={locked}
                      onChange={(event) => setRecipient(event.target.value)}
                    />
                  ) : (
                    <Input
                      id="human-message-recipient"
                      dir="ltr"
                      maxLength={320}
                      value={recipient}
                      disabled={locked}
                      onChange={(event) => setRecipient(event.target.value)}
                    />
                  )}
                  <p className="text-caption">
                    {t(channel === "email" ? "send.recipientHintEmail" : "send.recipientHintPhone")}
                  </p>
                </div>
                {channel === "email" && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="human-message-subject">{t("send.subject")}</Label>
                    <Input
                      id="human-message-subject"
                      maxLength={200}
                      value={subject}
                      disabled={locked}
                      onChange={(event) => setSubject(event.target.value)}
                    />
                  </div>
                )}
                {channel !== "whatsapp" && (
                  <ReusableContentPicker
                    key={channel}
                    actor={actor}
                    tenantId={tenantId}
                    channel={channel}
                    locked={locked}
                    onUse={(content) => {
                      setBody(content.body);
                      setSubject(content.subject ?? "");
                    }}
                  />
                )}
                {channel !== "whatsapp" ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="human-message-body">{t("send.body")}</Label>
                    <Textarea
                      id="human-message-body"
                      dir="auto"
                      maxLength={channel === "sms" ? 1600 : 20_000}
                      value={body}
                      disabled={locked}
                      onChange={(event) => setBody(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t("common.template")}</Label>
                    <p className="text-caption">{t("humanSend.templateNote")}</p>
                    {templates.isLoading ? (
                      <TableSkeleton rows={2} />
                    ) : templates.isError ? (
                      <ErrorState onRetry={() => void templates.refetch()} />
                    ) : (
                      <>
                        <Select
                          value={template?.id ?? ""}
                          disabled={locked}
                          onValueChange={(id) =>
                            setTemplate(templateRows.find((item) => item.id === id) ?? null)
                          }
                        >
                          <SelectTrigger aria-label={t("common.template")}>
                            <SelectValue placeholder={t("humanSend.chooseTemplate")} />
                          </SelectTrigger>
                          <SelectContent>
                            {template && !templateRows.some((item) => item.id === template.id) && (
                              <SelectItem value={template.id}>
                                {template.templateKey} · {template.language}
                              </SelectItem>
                            )}
                            {templateRows.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.templateKey} · {item.language}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {templates.data && (
                          <OptionPages
                            page={templatePage}
                            total={templates.data.total}
                            busy={locked || templates.isFetching}
                            setPage={setTemplatePage}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="text-caption md:col-span-2">{t("humanSend.validation")}</p>
            <Button
              className="md:col-span-2"
              disabled={mutation.isPending || (!frozen && !canReview)}
              onClick={() => {
                if (!frozen) {
                  mutation.reset();
                  const reviewed = {
                    applicationId,
                    input: structuredClone(draft),
                    key: `portal:${crypto.randomUUID()}`,
                    ...(bulk && csvText !== null
                      ? {
                          csv: { channel, senderId: sender?.id ?? "", mode: csvMode, csv: csvText },
                        }
                      : {}),
                  };
                  requestRef.current = reviewed;
                  setFrozen(reviewed);
                  setAcknowledged(false);
                }
                setOpen(true);
              }}
            >
              {t("humanSend.review")}
            </Button>
          </div>
        </Section>
        {mutation.isError && !open && <p role="alert">{t("humanSend.unconfirmed")}</p>}
      </PageBody>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("humanSend.review")}</DialogTitle>
            <DialogDescription>
              {t(bulk ? "humanBulk.confirmNote" : "humanSend.confirmNote")}
            </DialogDescription>
          </DialogHeader>
          {frozen && (
            <>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt>{t("common.application")}</dt>
                  <dd className="break-all font-mono">{frozen.applicationId}</dd>
                </div>
                <div>
                  <dt>{t("send.recipient")}</dt>
                  <dd dir="ltr" className="max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {frozen.csv ? t("humanBulk.csvFile") : frozen.input.recipient}
                  </dd>
                </div>
                {frozen.csv && (
                  <div>
                    <dt>{t("humanBulk.csvMode")}</dt>
                    <dd>
                      {t(
                        frozen.csv.mode === "PERSONALIZED"
                          ? "humanBulk.personalized"
                          : "humanBulk.shared",
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t("msg.senderIdentity")}</dt>
                  <dd className="break-all font-mono">{frozen.input.senderId}</dd>
                </div>
              </dl>
              <div
                className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-3 text-sm"
                dir="auto"
              >
                {frozen.csv
                  ? frozen.csv.csv
                  : frozen.input.channel === "sms"
                    ? frozen.input.sms.body
                    : frozen.input.channel === "email"
                      ? `${frozen.input.email.subject}\n\n${frozen.input.email.body}`
                      : `${frozen.input.whatsapp.templateKey} · ${frozen.input.whatsapp.language}`}
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="human-message-ack"
                  checked={acknowledged}
                  disabled={mutation.isPending}
                  onCheckedChange={(value) => setAcknowledged(value === true)}
                />
                <Label htmlFor="human-message-ack">
                  {t(
                    frozen.input.channel === "whatsapp" ? "humanSend.templateAck" : "humanSend.ack",
                  )}
                </Label>
              </div>
              {mutation.isError && (
                <p role="alert" className="text-danger">
                  {t(
                    mutation.error instanceof ApiError && mutation.error.statusCode === 409
                      ? "humanSend.conflict"
                      : "humanSend.unconfirmed",
                  )}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" disabled={mutation.isPending} onClick={close}>
                  {t("common.cancel")}
                </Button>
                <Button
                  disabled={mutation.isPending || !acknowledged}
                  onClick={() => mutation.mutate()}
                >
                  {t(
                    mutation.isPending
                      ? "common.saving"
                      : bulk
                        ? "humanBulk.create"
                        : "humanSend.accept",
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
