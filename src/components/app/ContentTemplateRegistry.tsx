import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { queries, contentTemplateMutations } from "@/lib/api/queries";
import {
  contentTemplateKey,
  contentTemplateScope,
  contentTemplateMutation,
} from "@/lib/api/content-template";
import type {
  ContentTemplateRow,
  ContentTemplateDetail,
  ContentTemplateInput,
  ContentTemplateQuery,
} from "@/lib/api/content-template";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";
import { PageBody, PageHeader, Section } from "./PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "./States";
import { DataTable, ListPagination, type Column } from "./DataTable";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function ContentTemplateRegistry() {
  const { user, isPlatform } = useSession(),
    { tenantId } = useGlobalTenantContext(),
    { t } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const target = isPlatform ? tenantId : undefined;
  try {
    contentTemplateScope(actor, target);
  } catch {
    return (
      <PageBody>
        <EmptyState
          icon={FileText}
          title={t("msg.selectTenantTitle")}
          body={t("msg.selectTenantBody")}
        />
      </PageBody>
    );
  }
  return (
    <ContentVersions
      key={JSON.stringify(contentTemplateKey(actor, target))}
      actor={actor}
      tenantId={target}
    />
  );
}
function ContentVersions({
  actor,
  tenantId,
}: {
  actor: SenderIdentityActor;
  tenantId: string | undefined;
}) {
  const { t } = useI18n(),
    { can } = useSession(),
    qc = useQueryClient();
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [channel, setChannel] = useState<"sms" | "email">("sms"),
    [state, setState] = useState("all");
  const [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false);
  const query: ContentTemplateQuery = {
    page,
    pageSize,
    channel,
    ...(state !== "all" ? { registryStatus: state as ContentTemplateRow["registryStatus"] } : {}),
  };
  const list = useQuery(queries.contentTemplates(actor, query, tenantId));
  const detail = useQuery(queries.contentTemplate(actor, selected, tenantId));
  const manage = can("templates.manage") || can("platform.templates.manage");
  const refresh = () =>
    qc.invalidateQueries({ queryKey: contentTemplateKey(actor, tenantId).slice(0, 5) });
  const columns: Column<ContentTemplateRow>[] = [
    {
      id: "key",
      header: t("content.key"),
      cell: (row) => (
        <Button variant="link" onClick={() => setSelected(row.id)}>
          {row.templateKey}
        </Button>
      ),
    },
    { id: "language", header: t("content.language"), cell: (row) => row.language },
    { id: "version", header: t("content.version"), cell: (row) => row.version },
    {
      id: "state",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.registryStatus} />,
    },
  ];
  return (
    <>
      <PageHeader
        title={t("content.title")}
        description={t("content.subtitle")}
        actions={
          manage ? (
            <Button onClick={() => setCreating(true)}>{t("content.create")}</Button>
          ) : undefined
        }
      />
      <PageBody>
        <p className="text-sm">{t("content.note")}</p>
        <Section title={t("content.versions")}>
          <div className="flex flex-wrap gap-3 p-4">
            <Select
              value={channel}
              onValueChange={(value) => {
                setChannel(value as "sms" | "email");
                setPage(1);
              }}
            >
              <SelectTrigger aria-label={t("common.channel")} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">{t("channel.sms")}</SelectItem>
                <SelectItem value="email">{t("channel.email")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label={t("common.status")} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["all", "draft", "ready", "retired"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all" ? t("content.all") : t(`status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {list.isLoading ? (
            <TableSkeleton />
          ) : list.isError ? (
            <ErrorState onRetry={() => void list.refetch()} />
          ) : (
            <>
              <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(row) => row.id} />
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={list.data?.total ?? 0}
                onPage={setPage}
                onPageSizeChange={(value) => {
                  setPageSize(value);
                  setPage(1);
                }}
              />
            </>
          )}
        </Section>
      </PageBody>
      {creating && (
        <CreateContentVersion
          actor={actor}
          tenantId={tenantId}
          initialChannel={channel}
          onClose={() => setCreating(false)}
          onCreated={async (row) => {
            await refresh();
            setSelected(row.id);
            setCreating(false);
          }}
        />
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected("");
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("content.details")}</DialogTitle>
            <DialogDescription>{t("content.note")}</DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <TableSkeleton rows={3} />
          ) : detail.isError ? (
            <ErrorState onRetry={() => void detail.refetch()} />
          ) : (
            detail.data && (
              <ContentVersionDetail
                key={selected}
                actor={actor}
                tenantId={tenantId}
                row={detail.data}
                manage={manage}
                refresh={refresh}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function CreateContentVersion({
  actor,
  tenantId,
  initialChannel,
  onClose,
  onCreated,
}: {
  actor: SenderIdentityActor;
  tenantId: string | undefined;
  initialChannel: "sms" | "email";
  onClose: () => void;
  onCreated: (row: ContentTemplateDetail) => Promise<void>;
}) {
  const { t } = useI18n();
  const [channel, setChannel] = useState(initialChannel),
    [key, setKey] = useState(""),
    [language, setLanguage] = useState("en"),
    [body, setBody] = useState(""),
    [subject, setSubject] = useState(""),
    [ack, setAck] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const input: ContentTemplateInput = {
    channel,
    templateKey: key,
    language,
    body,
    ...(channel === "email" ? { subject } : {}),
  };
  let valid = false;
  try {
    contentTemplateMutation(actor, { kind: "create", input }, tenantId);
    valid = true;
  } catch {
    /* Backend validates the complete parameter schema. */
  }
  const mutation = useMutation({
    mutationKey: [...contentTemplateKey(actor, tenantId).slice(0, 5), "create"],
    retry: false,
    gcTime: 0,
    mutationFn: () => {
      if (!ack) throw new Error("Review required");
      return contentTemplateMutations.apply(actor, { kind: "create", input }, tenantId);
    },
    onSuccess: async (row) => {
      if (active.current) await onCreated(row);
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("content.create")}</DialogTitle>
          <DialogDescription>{t("content.createNote")}</DialogDescription>
        </DialogHeader>
        <Label htmlFor="content-key">{t("content.key")}</Label>
        <Input
          id="content-key"
          value={key}
          maxLength={64}
          disabled={mutation.isPending}
          onChange={(e) => setKey(e.target.value)}
        />
        <Label htmlFor="content-language">{t("content.language")}</Label>
        <Input
          id="content-language"
          value={language}
          maxLength={16}
          disabled={mutation.isPending}
          onChange={(e) => setLanguage(e.target.value)}
        />
        <Select
          value={channel}
          disabled={mutation.isPending}
          onValueChange={(v) => setChannel(v as "sms" | "email")}
        >
          <SelectTrigger aria-label={t("common.channel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sms">{t("channel.sms")}</SelectItem>
            <SelectItem value="email">{t("channel.email")}</SelectItem>
          </SelectContent>
        </Select>
        {channel === "email" && (
          <>
            <Label htmlFor="content-subject">{t("send.subject")}</Label>
            <Input
              id="content-subject"
              value={subject}
              maxLength={200}
              disabled={mutation.isPending}
              onChange={(e) => setSubject(e.target.value)}
            />
          </>
        )}
        <Label htmlFor="content-body">{t("send.body")}</Label>
        <Textarea
          id="content-body"
          dir="auto"
          value={body}
          maxLength={channel === "sms" ? 1600 : 20000}
          disabled={mutation.isPending}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-caption">{t("content.parameterHint")}</p>
        <div className="flex items-start gap-2">
          <Checkbox
            id="content-create-ack"
            checked={ack}
            disabled={mutation.isPending}
            onCheckedChange={(v) => setAck(v === true)}
          />
          <Label htmlFor="content-create-ack">{t("content.ack")}</Label>
        </div>
        {mutation.isError && <p role="alert">{t("content.uncertain")}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!valid || !ack || mutation.isPending || mutation.isError}
            onClick={() => mutation.mutate()}
          >
            {t(mutation.isPending ? "common.saving" : "content.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function ContentVersionDetail({
  actor,
  tenantId,
  row,
  manage,
  refresh,
}: {
  actor: SenderIdentityActor;
  tenantId: string | undefined;
  row: ContentTemplateDetail;
  manage: boolean;
  refresh: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const [action, setAction] = useState<"ready" | "retire" | null>(null),
    [ack, setAck] = useState(false),
    [values, setValues] = useState<Record<string, string>>({});
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const lifecycle = useMutation({
    mutationKey: [...contentTemplateKey(actor, tenantId).slice(0, 5), row.id, "lifecycle"],
    retry: false,
    gcTime: 0,
    mutationFn: () => {
      if (!action || !ack) throw new Error("Review required");
      return contentTemplateMutations.apply(actor, { kind: action, id: row.id }, tenantId);
    },
    onSuccess: async () => {
      if (!active.current) return;
      setAction(null);
      setAck(false);
      await refresh();
    },
  });
  const preview = useMutation({
    mutationKey: [...contentTemplateKey(actor, tenantId).slice(0, 5), row.id, "preview"],
    retry: false,
    gcTime: 0,
    mutationFn: () => contentTemplateMutations.render(actor, row.id, values, tenantId),
  });
  const eligible = row.parameters.every(
    (name) => Object.hasOwn(values, name) && values[name]!.length <= 1000,
  );
  return (
    <div className="space-y-4">
      <p className="font-mono text-sm">
        {row.templateKey} · {row.language} · {t("content.version")} {row.version}
      </p>
      <StatusBadge status={row.registryStatus} />
      {row.subject !== null && <p className="whitespace-pre-wrap">{row.subject}</p>}
      <p
        className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-3"
        dir="auto"
      >
        {row.body}
      </p>
      {manage && (
        <div className="flex gap-2">
          {row.registryStatus === "draft" && (
            <Button
              variant="outline"
              disabled={lifecycle.isPending}
              onClick={() => {
                setAction("ready");
                setAck(false);
                lifecycle.reset();
              }}
            >
              {t("content.ready")}
            </Button>
          )}
          {row.registryStatus !== "retired" && (
            <Button
              variant="outline"
              disabled={lifecycle.isPending}
              onClick={() => {
                setAction("retire");
                setAck(false);
                lifecycle.reset();
              }}
            >
              {t("content.retire")}
            </Button>
          )}
        </div>
      )}
      {action && (
        <div className="space-y-3 rounded-md border p-3">
          <p>{t("content.lifecycleNote")}</p>
          <div className="flex items-start gap-2">
            <Checkbox
              id="content-lifecycle-ack"
              checked={ack}
              disabled={lifecycle.isPending}
              onCheckedChange={(v) => setAck(v === true)}
            />
            <Label htmlFor="content-lifecycle-ack">{t("content.ack")}</Label>
          </div>
          <Button disabled={!ack || lifecycle.isPending} onClick={() => lifecycle.mutate()}>
            {t(action === "ready" ? "content.ready" : "content.retire")}
          </Button>
        </div>
      )}
      {lifecycle.isError && <p role="alert">{t("content.failed")}</p>}
      {row.registryStatus === "ready" && (
        <div className="space-y-3 border-t pt-3">
          <h3 className="font-medium">{t("content.preview")}</h3>
          <p className="text-caption">{t("content.previewNote")}</p>
          {row.parameters.map((name) => (
            <div key={name}>
              <Label htmlFor={`content-param-${name}`}>{name}</Label>
              <Input
                id={`content-param-${name}`}
                dir="auto"
                maxLength={1000}
                value={values[name] ?? ""}
                disabled={preview.isPending}
                onChange={(e) => {
                  setValues((previous) => ({ ...previous, [name]: e.target.value }));
                  preview.reset();
                }}
              />
            </div>
          ))}
          <Button
            variant="outline"
            disabled={!eligible || preview.isPending}
            onClick={() => preview.mutate()}
          >
            {t("content.render")}
          </Button>
          {preview.isError && <p role="alert">{t("content.failed")}</p>}
          {preview.data && (
            <div role="status">
              <p>{preview.data.subject}</p>
              <p
                className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words border p-3"
                dir="auto"
              >
                {preview.data.body}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
