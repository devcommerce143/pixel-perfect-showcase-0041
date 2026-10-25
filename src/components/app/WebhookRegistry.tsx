import { MessageAlert } from "@/components/app/MessageAlert";
import { EntityName } from "@/components/app/EntityName";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, webhookRegistryMutations } from "@/lib/api/queries";
import { WEBHOOK_EVENTS, webhookFailureKey, webhookScopeKey } from "@/lib/api/webhook-registry";
import type {
  RegisteredWebhook,
  WebhookSubscription,
  WebhookRegistryOperation,
  WebhookAttempt,
} from "@/lib/api/webhook-registry";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function WebhookRegistry() {
  const { user, isPlatform } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const [appPage, setAppPage] = useState(1);
  const [appPageSize, setAppPageSize] = useState<10 | 20 | 50>(20);
  const [app, setApp] = useState("");
  const apps = useQuery(queries.webhookApplications(actor, appPage, appPageSize, tenantId));
  const selectedApplication = useQuery(queries.webhookApplication(actor, app, tenantId));
  return (
    <>
      <PageHeader title={t("nav.webhooks")} description={t("liveWebhooks.subtitle")} />
      <PageBody>
        {isPlatform && !tenantId ? (
          <EmptyState title={t("liveWebhooks.selectTenant")} />
        ) : (
          <Section className="space-y-4 p-4 sm:p-6">
            <Label>{t("liveWebhooks.application")}</Label>
            {apps.isError ? (
              <ErrorState error={apps.error} onRetry={() => void apps.refetch()} />
            ) : apps.isPending ? (
              <TableSkeleton rows={2} />
            ) : (
              <>
                <Select value={app} onValueChange={setApp}>
                  <SelectTrigger
                    className="w-full sm:max-w-xl"
                    aria-label={t("liveWebhooks.application")}
                  >
                    <SelectValue placeholder={t("liveWebhooks.selectApplication")}>
                      {selectedApplication.data
                        ? `${selectedApplication.data.name} (${selectedApplication.data.environment})`
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {apps.data.items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.environment})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ListPagination
                  page={appPage}
                  pageSize={appPageSize}
                  total={apps.data.total}
                  onPage={setAppPage}
                  onPageSizeChange={(size) => {
                    setAppPageSize(size);
                    setAppPage(1);
                  }}
                />
              </>
            )}
            {app ? (
              <ApplicationWebhooks key={app} actor={actor} app={app} tenantId={tenantId} />
            ) : (
              <EmptyState title={t("liveWebhooks.selectApplication")} />
            )}
          </Section>
        )}
      </PageBody>
    </>
  );
}

function ApplicationWebhooks({
  actor,
  app,
  tenantId,
}: {
  actor: SenderIdentityActor;
  app: string;
  tenantId?: string | undefined;
}) {
  const { can } = useSession();
  const { t, locale } = useI18n();
  const manage = can("webhooks.manage") || can("platform.webhooks.manage");
  const qc = useQueryClient();
  const list = useQuery(queries.webhookRegistry(actor, app, tenantId));
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const history = useQuery(
    queries.webhookRegistryHistory(actor, app, selected, { page, pageSize }, tenantId),
  );
  const [operation, setOperation] = useState<WebhookRegistryOperation | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<WebhookSubscription[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (next: WebhookRegistryOperation) => {
      const result = await webhookRegistryMutations.apply(actor, app, next, tenantId);
      if (active.current && result.kind === "secret") setSecret(result.secret);
      // Secret bytes never enter TanStack's mutation or query caches.
      return result.kind === "secret"
        ? { kind: "endpoint" as const, endpoint: result.endpoint }
        : result;
    },
    onSuccess: async (result) => {
      if (!active.current) return;
      setOperation(null);
      if (result.kind === "queued")
        setNotice(t("liveWebhooks.queued", { id: t("liveWebhooks.event.endpoint.ping") }));
      else setNotice(t("liveWebhooks.saved"));
      if (result.kind === "deleted") setSelected("");
      await qc.invalidateQueries({ queryKey: webhookScopeKey(actor, app, tenantId) });
    },
  });
  function open(kind: WebhookRegistryOperation["kind"], row?: RegisteredWebhook) {
    mutation.reset();
    setNotice(null);
    setUrl(row?.url ?? "");
    setDescription(row?.description ?? "");
    setEvents(row?.eventTypes ?? []);
    if (kind === "create") setOperation({ kind, input: { url: "", eventTypes: [] } });
    else if (row)
      setOperation(
        kind === "update"
          ? { kind, id: row.id, input: { url: row.url, eventTypes: row.eventTypes } }
          : { kind, id: row.id },
      );
  }
  const columns: Column<RegisteredWebhook>[] = [
    {
      id: "url",
      header: t("liveWebhooks.url"),
      cell: (row) => (
        <button
          className="text-start underline break-all"
          onClick={() => {
            setSelected(row.id);
            setPage(1);
          }}
        >
          {row.url}
        </button>
      ),
    },
    {
      id: "status",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.status.toLowerCase()} />,
    },
    {
      id: "events",
      header: t("liveWebhooks.events"),
      cell: (row) => row.eventTypes.map((event) => t(`liveWebhooks.event.${event}`)).join(", "),
    },
    { id: "version", header: t("liveWebhooks.version"), cell: (row) => row.secretVersion },
    {
      id: "actions",
      header: t("common.actions"),
      cell: (row) =>
        manage ? (
          <div className="flex flex-wrap gap-1">
            {(
              [
                "update",
                row.status === "ACTIVE" ? "disable" : "enable",
                "rotate",
                "ping",
                "delete",
              ] as const
            ).map((kind) => (
              <Button
                key={kind}
                size="sm"
                variant="outline"
                disabled={mutation.isPending || (kind === "ping" && row.status !== "ACTIVE")}
                onClick={() => open(kind, row)}
              >
                {t(`liveWebhooks.action.${kind}`)}
              </Button>
            ))}
          </div>
        ) : null,
    },
  ];
  const historyColumns: Column<WebhookAttempt>[] = [
    {
      id: "event",
      header: t("liveWebhooks.events"),
      cell: (row) => (
        <>
          {t(`liveWebhooks.event.${row.eventType}`)}
          <p className="font-mono text-xs">{t(`liveWebhooks.event.${row.eventType}`)}</p>
        </>
      ),
    },
    {
      id: "state",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.state.toLowerCase()} />,
    },
    { id: "attempts", header: t("liveWebhooks.attempts"), cell: (row) => row.attemptCount },
    {
      id: "http",
      header: t("liveWebhooks.http"),
      cell: (row) => row.lastHttpStatus ?? t("liveWebhooks.notAvailable"),
    },
    {
      id: "error",
      header: t("liveWebhooks.errorCategory"),
      cell: (row) => row.lastErrorCategory ?? t("liveWebhooks.notAvailable"),
    },
    {
      id: "created",
      header: t("liveWebhooks.created"),
      cell: (row) => formatDateTime(row.createdAt, locale),
    },
  ];
  const form = operation?.kind === "create" || operation?.kind === "update";
  return (
    <div className="space-y-4 pt-4">
      <p className="text-subtle">
        <EntityName kind="application" id={app} tenantId={tenantId} />
      </p>
      {manage && (
        <Button
          disabled={
            mutation.isPending || list.isPending || list.isError || (list.data?.length ?? 0) >= 5
          }
          onClick={() => open("create")}
        >
          {t("liveWebhooks.action.create")}
        </Button>
      )}
      {notice && <p role="status">{notice}</p>}
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <TableSkeleton />
      ) : !list.data.length ? (
        <EmptyState title={t("liveWebhooks.empty")} />
      ) : (
        <DataTable columns={columns} rows={list.data} rowKey={(row) => row.id} />
      )}
      {selected && (
        <Section title={t("liveWebhooks.history")}>
          <p className="font-mono text-xs">
            {list.data?.find((row) => row.id === selected)?.url ?? t("entity.unavailable")}
          </p>
          <Button variant="outline" onClick={() => void history.refetch()}>
            {t("common.refresh")}
          </Button>
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.isPending ? (
            <TableSkeleton />
          ) : (
            <>
              {!history.data.items.length ? (
                <EmptyState title={t("liveWebhooks.noHistory")} />
              ) : (
                <DataTable
                  columns={historyColumns}
                  rows={history.data.items}
                  rowKey={(row) => row.id}
                />
              )}
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={history.data.total}
                onPage={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </Section>
      )}
      <Dialog
        open={!!operation}
        onOpenChange={(value) => {
          if (!value && !mutation.isPending) setOperation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{operation && t(`liveWebhooks.action.${operation.kind}`)}</DialogTitle>
            <DialogDescription>{t("liveWebhooks.confirm")}</DialogDescription>
          </DialogHeader>
          {operation && "id" in operation && (
            <p className="font-mono text-xs">
              {list.data?.find((row) => row.id === operation.id)?.url ?? t("entity.unavailable")}
            </p>
          )}
          {form && (
            <div className="space-y-3">
              <Label htmlFor="webhook-url">{t("liveWebhooks.url")}</Label>
              <Input
                id="webhook-url"
                dir="ltr"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                maxLength={2048}
              />
              <Label htmlFor="webhook-description">{t("liveWebhooks.description")}</Label>
              <Input
                id="webhook-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={120}
              />
              <p>{t("liveWebhooks.events")}</p>
              {WEBHOOK_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2">
                  <Checkbox
                    checked={events.includes(event)}
                    onCheckedChange={(checked) =>
                      setEvents((current) =>
                        checked === true
                          ? [...current, event]
                          : current.filter((item) => item !== event),
                      )
                    }
                  />
                  {t(`liveWebhooks.event.${event}`)}
                </label>
              ))}
            </div>
          )}
          {mutation.isError && <MessageAlert>{t(webhookFailureKey(mutation.error))}</MessageAlert>}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOperation(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={mutation.isPending || (form && (!url || !events.length))}
              onClick={() => {
                if (operation)
                  mutation.mutate(
                    form
                      ? ({
                          ...operation,
                          input: { url, description, eventTypes: events },
                        } as WebhookRegistryOperation)
                      : operation,
                  );
              }}
            >
              {t("liveWebhooks.confirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={secret !== null}
        onOpenChange={(value) => {
          if (!value) setSecret(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("liveWebhooks.secret")}</DialogTitle>
            <DialogDescription>{t("liveWebhooks.secretOnce")}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label={t("liveWebhooks.secret")}
            dir="ltr"
            readOnly
            value={secret ?? ""}
            autoComplete="off"
          />
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>{t("liveWebhooks.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
