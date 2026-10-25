import { MessageAlert } from "@/components/app/MessageAlert";
import { EntityName } from "@/components/app/EntityName";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, providerRouteMutations } from "@/lib/api/queries";
import { providerRouteKey, providerRouteFailureKey } from "@/lib/api/provider-routes";
import type {
  ConfiguredProviderRoute,
  ConfiguredRouteMember,
  ProviderRouteOperation,
  ProviderRouteMutationResult,
  RouteChannel,
  RouteStatus,
} from "@/lib/api/provider-routes";
import type { SenderIdentityActor, SenderIdentityRead } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { isTenantUuid } from "@/lib/api/http/tenant-mapper";
import { useI18n } from "@/lib/i18n/i18n";
import { DataTable, type Column } from "./DataTable";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { ErrorState, EmptyState, TableSkeleton } from "./States";
import { ChannelLabel } from "./ChannelLabel";
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

function useRouteMutation(
  actor: SenderIdentityActor,
  saved: (result: ProviderRouteMutationResult) => void,
) {
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const qc = useQueryClient();
  return useMutation({
    mutationKey: providerRouteKey(actor),
    retry: false,
    mutationFn: (operation: ProviderRouteOperation) =>
      providerRouteMutations.apply(actor, operation),
    onSuccess: async (result) => {
      if (!active.current) return;
      saved(result);
      await qc.invalidateQueries({ queryKey: providerRouteKey(actor) });
    },
  });
}
function senderLabel(row: SenderIdentityRead) {
  return (
    row.displayName ??
    (row.channel === "sms"
      ? row.sms.senderId
      : row.channel === "email"
        ? row.email.emailAddress
        : row.whatsapp.businessDisplayName)
  );
}
export function ProviderRouting() {
  const { user, can } = useSession();
  const { t } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const [channel, setChannel] = useState<RouteChannel | "all">("all"),
    [status, setStatus] = useState<RouteStatus | "all">("all");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const [selected, setSelected] = useState("");
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false),
    [code, setCode] = useState(""),
    [newChannel, setNewChannel] = useState<RouteChannel>("SMS");
  const list = useQuery(
    queries.configuredProviderRoutes(actor, {
      limit: 20,
      ...(cursor ? { cursor } : {}),
      ...(channel !== "all" ? { channel } : {}),
      ...(status !== "all" ? { status } : {}),
    }),
  );
  const mutation = useRouteMutation(actor, (result) => {
    setSaved(true);
    setCreating(false);
    if (result.kind === "route") {
      setSelected(result.route.id);
      setCursors([undefined]);
    }
  });
  const columns: Column<ConfiguredProviderRoute>[] = [
    {
      id: "code",
      header: t("liveRouting.code"),
      cell: (row) => (
        <button className="text-start underline" onClick={() => setSelected(row.id)}>
          {row.code}
          <p className="font-mono text-xs">{row.code}</p>
        </button>
      ),
    },
    {
      id: "channel",
      header: t("common.channel"),
      cell: (row) => (
        <ChannelLabel channel={row.channel.toLowerCase() as "sms" | "email" | "whatsapp"} />
      ),
    },
    {
      id: "status",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.status.toLowerCase()} />,
    },
    { id: "members", header: t("liveRouting.members"), cell: (row) => row.members.length },
  ];
  return (
    <>
      <PageHeader
        title={t("liveRouting.title")}
        description={t("liveRouting.description")}
        actions={
          can("platform.routing.manage") && (
            <Button
              onClick={() => {
                mutation.reset();
                setCode("");
                setNewChannel("SMS");
                setCreating(true);
                setSaved(false);
              }}
            >
              {t("liveRouting.create")}
            </Button>
          )
        }
      />
      <PageBody>
        {saved && <p role="status">{t("liveRouting.saved")}</p>}
        <Section>
          <div className="flex flex-wrap gap-3 p-4">
            <Select
              value={channel}
              onValueChange={(value) => {
                setChannel(value as typeof channel);
                setCursors([undefined]);
                setSelected("");
              }}
            >
              <SelectTrigger className="w-48" aria-label={t("common.channel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allChannels")}</SelectItem>
                {(["SMS", "EMAIL", "WHATSAPP"] as const).map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`channel.${item.toLowerCase() as "sms" | "email" | "whatsapp"}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as typeof status);
                setCursors([undefined]);
                setSelected("");
              }}
            >
              <SelectTrigger className="w-48" aria-label={t("common.status")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatuses")}</SelectItem>
                {(["ACTIVE", "DISABLED"] as const).map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`status.${item.toLowerCase() as "active" | "disabled"}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              {t("common.refresh")}
            </Button>
          </div>
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <TableSkeleton />
          ) : list.data.items.length ? (
            <DataTable columns={columns} rows={list.data.items} rowKey={(row) => row.id} />
          ) : (
            <EmptyState title={t("liveRouting.empty")} />
          )}
          <CursorControls
            previous={cursors.length > 1}
            next={!!list.data?.nextCursor && !list.isError}
            busy={list.isFetching}
            onPrevious={() => setCursors((current) => current.slice(0, -1))}
            onNext={() => {
              if (list.data?.nextCursor)
                setCursors((current) => [...current, list.data.nextCursor!]);
            }}
          />
        </Section>
        {selected && (
          <RouteDetail key={selected} actor={actor} id={selected} onClose={() => setSelected("")} />
        )}
      </PageBody>
      <Dialog
        open={creating}
        onOpenChange={(value) => {
          if (!mutation.isPending) setCreating(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("liveRouting.create")}</DialogTitle>
            <DialogDescription>{t("liveRouting.description")}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="route-code">{t("liveRouting.code")}</Label>
          <Input
            id="route-code"
            dir="ltr"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            maxLength={63}
          />
          <Label>{t("common.channel")}</Label>
          <Select
            value={newChannel}
            onValueChange={(value) => setNewChannel(value as RouteChannel)}
          >
            <SelectTrigger aria-label={t("common.channel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["SMS", "EMAIL", "WHATSAPP"] as const).map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`channel.${item.toLowerCase() as "sms" | "email" | "whatsapp"}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mutation.isError && (
            <MessageAlert>{t(providerRouteFailureKey(mutation.error))}</MessageAlert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setCreating(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={mutation.isPending || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(code)}
              onClick={() => mutation.mutate({ kind: "create", code, channel: newChannel })}
            >
              {t("liveRouting.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RouteDetail({
  actor,
  id,
  onClose,
}: {
  actor: SenderIdentityActor;
  id: string;
  onClose: () => void;
}) {
  const { can } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t } = useI18n();
  const route = useQuery(queries.configuredProviderRoute(actor, id));
  const [operation, setOperation] = useState<ProviderRouteOperation | null>(null),
    [priority, setPriority] = useState("1"),
    [enabled, setEnabled] = useState(true),
    [accountId, setAccountId] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const accounts = useQuery({
    ...queries.providerMonitoring(actor, {
      limit: 20,
      ...(route.data ? { channel: route.data.channel } : {}),
      ...(cursor ? { cursor } : {}),
    }),
    enabled: operation?.kind === "addMember" && can("platform.routing.manage"),
  });
  const account = useQuery(queries.providerMetadata(actor, accountId));
  const [saved, setSaved] = useState(false);
  const mutation = useRouteMutation(actor, () => {
    setOperation(null);
    setSaved(true);
  });
  function start(next: ProviderRouteOperation) {
    mutation.reset();
    setSaved(false);
    setOperation(next);
  }
  const manage = can("platform.routing.manage");
  function edit(row: ConfiguredRouteMember) {
    mutation.reset();
    setPriority(String(row.priority));
    setEnabled(row.enabled);
    start({
      kind: "updateMember",
      routeId: id,
      memberId: row.id,
      priority: row.priority,
      enabled: row.enabled,
    });
  }
  const columns: Column<ConfiguredRouteMember>[] = [
    {
      id: "provider",
      header: t("liveProviders.code"),
      cell: (row) => (
        <>
          {row.providerCode}
          <p className="font-mono text-xs">
            <EntityName kind="provider" id={row.providerAccountId} />
          </p>
        </>
      ),
    },
    {
      id: "accountStatus",
      header: t("liveProviders.accountStatus"),
      cell: (row) => <StatusBadge status={row.providerStatus.toLowerCase()} />,
    },
    { id: "priority", header: t("liveRouting.priority"), cell: (row) => row.priority },
    {
      id: "enabled",
      header: t("liveRouting.enabled"),
      cell: (row) => <StatusBadge status={row.enabled ? "active" : "disabled"} />,
    },
    {
      id: "actions",
      header: t("common.actions"),
      cell: (row) =>
        manage && (
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => edit(row)}
          >
            {t("liveRouting.editMember")}
          </Button>
        ),
    },
  ];
  const memberForm = operation?.kind === "addMember" || operation?.kind === "updateMember";
  const member =
    operation?.kind === "updateMember"
      ? route.data?.members.find((row) => row.id === operation.memberId)
      : undefined;
  const validPriority =
    Number.isInteger(Number(priority)) && Number(priority) >= 1 && Number(priority) <= 100;
  const validMember =
    validPriority &&
    (operation?.kind !== "addMember" ||
      (account.isSuccess &&
        account.data.status === "ACTIVE" &&
        account.data.channel === route.data?.channel)) &&
    (operation?.kind !== "updateMember" || !enabled || member?.providerStatus === "ACTIVE");
  function confirm() {
    if (!operation) return;
    mutation.mutate(
      operation.kind === "addMember"
        ? { ...operation, providerAccountId: accountId, priority: Number(priority), enabled }
        : operation.kind === "updateMember"
          ? { ...operation, priority: Number(priority), enabled }
          : operation,
    );
  }
  return (
    <Section title={t("liveRouting.detail")}>
      {saved && (
        <p role="status" className="p-4">
          {t("liveRouting.saved")}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-3 p-4">
        <p className="text-sm">
          <EntityName kind="route" id={id} name={route.data?.code} />
        </p>
        <Button variant="outline" onClick={onClose}>
          {t("liveProviders.close")}
        </Button>
      </div>
      {route.isError ? (
        <ErrorState error={route.error} onRetry={() => void route.refetch()} />
      ) : route.isPending ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <h3>{route.data.code}</h3>
            <ChannelLabel
              channel={route.data.channel.toLowerCase() as "sms" | "email" | "whatsapp"}
            />
            <StatusBadge status={route.data.status.toLowerCase()} />
            {manage && (
              <>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    mutation.reset();
                    start({
                      kind: "status",
                      routeId: id,
                      status: route.data.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                    });
                  }}
                >
                  {t(route.data.status === "ACTIVE" ? "liveRouting.disable" : "liveRouting.enable")}
                </Button>
                <Button
                  disabled={mutation.isPending || route.data.members.length >= 100}
                  onClick={() => {
                    mutation.reset();
                    setCursors([undefined]);
                    setAccountId("");
                    setPriority(
                      String(
                        Array.from({ length: 100 }, (_, index) => index + 1).find(
                          (value) => !route.data.members.some((row) => row.priority === value),
                        ) ?? 1,
                      ),
                    );
                    setEnabled(true);
                    start({
                      kind: "addMember",
                      routeId: id,
                      providerAccountId: "",
                      priority: 1,
                      enabled: true,
                    });
                  }}
                >
                  {t("liveRouting.addMember")}
                </Button>
              </>
            )}
          </div>
          <DataTable columns={columns} rows={route.data.members} rowKey={(row) => row.id} />
          {tenantId && isTenantUuid(tenantId) ? (
            <RouteAssignments
              key={tenantId}
              actor={actor}
              tenantId={tenantId}
              route={route.data}
              onAction={(next) => {
                mutation.reset();
                start(next);
              }}
              busy={mutation.isPending}
            />
          ) : (
            <EmptyState title={t("liveRouting.chooseTenant")} />
          )}
        </>
      )}
      <Dialog
        open={operation !== null}
        onOpenChange={(value) => {
          if (!value && !mutation.isPending) setOperation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{operation && t(`liveRouting.action.${operation.kind}`)}</DialogTitle>
            <DialogDescription>{t("liveRouting.description")}</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs">
            {route.data?.code} / {id}
          </p>
          {operation &&
            (operation.kind === "assignTenant" || operation.kind === "assignSender") && (
              <p className="font-mono text-xs">
                <EntityName kind="tenant" id={operation.tenantId} />
                {operation.kind === "assignSender" && (
                  <EntityName
                    kind="sender"
                    id={operation.senderIdentityId}
                    tenantId={operation.tenantId}
                  />
                )}
              </p>
            )}
          {operation?.kind === "addMember" && (
            <>
              {accounts.isError ? (
                <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
              ) : accounts.isPending ? (
                <TableSkeleton rows={2} />
              ) : (
                <>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger aria-label={t("liveRouting.selectAccount")}>
                      <SelectValue placeholder={t("liveRouting.selectAccount")}>
                        {account.data?.code}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.data.items.map((row) => (
                        <SelectItem
                          key={row.providerAccountId}
                          value={row.providerAccountId}
                          disabled={
                            row.accountStatus !== "ACTIVE" ||
                            !!route.data?.members.some(
                              (member) => member.providerAccountId === row.providerAccountId,
                            )
                          }
                        >
                          {row.code} (
                          {t(`status.${row.accountStatus.toLowerCase() as "active" | "retired"}`)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <CursorControls
                    previous={cursors.length > 1}
                    next={accounts.data.nextCursor !== null}
                    busy={accounts.isFetching}
                    onPrevious={() => setCursors((current) => current.slice(0, -1))}
                    onNext={() => {
                      if (accounts.data.nextCursor)
                        setCursors((current) => [...current, accounts.data.nextCursor!]);
                    }}
                  />
                </>
              )}
              {account.isError && (
                <ErrorState error={account.error} onRetry={() => void account.refetch()} />
              )}
            </>
          )}
          {memberForm && (
            <>
              <Label htmlFor="route-member-priority">{t("liveRouting.priority")}</Label>
              <Input
                id="route-member-priority"
                type="number"
                min={1}
                max={100}
                step={1}
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              />
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={enabled}
                  onCheckedChange={(value) => setEnabled(value === true)}
                />
                {t("liveRouting.enabled")}
              </label>
            </>
          )}
          {mutation.isError && (
            <MessageAlert>{t(providerRouteFailureKey(mutation.error))}</MessageAlert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setOperation(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={mutation.isPending || (memberForm && !validMember)} onClick={confirm}>
              {t("liveRouting.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function RouteAssignments({
  actor,
  tenantId,
  route,
  onAction,
  busy,
}: {
  actor: SenderIdentityActor;
  tenantId: string;
  route: ConfiguredProviderRoute;
  onAction: (operation: ProviderRouteOperation) => void;
  busy: boolean;
}) {
  const { can } = useSession();
  const { t } = useI18n();
  const [page, setPage] = useState(1),
    [sender, setSender] = useState("");
  const tenant = useQuery(queries.configuredTenantRoute(actor, tenantId, route.channel));
  const senders = useQuery(queries.routeSenderOptions(actor, tenantId, route.channel, page));
  const selected = useQuery(queries.senderIdentityRead(actor, sender, tenantId, !!sender));
  const assignment = useQuery(queries.configuredSenderRoute(actor, tenantId, sender));
  const manage = can("platform.routing.manage");
  return (
    <div className="space-y-4 border-t p-4">
      <h3 className="font-semibold">{t("liveRouting.assignments")}</h3>
      <p className="font-mono text-xs">
        <EntityName kind="tenant" id={tenantId} />
      </p>
      <div>
        <h4>{t("liveRouting.tenantDefault")}</h4>
        {tenant.isError ? (
          <ErrorState error={tenant.error} onRetry={() => void tenant.refetch()} />
        ) : tenant.isPending ? (
          <TableSkeleton rows={1} />
        ) : tenant.data ? (
          <p>
            {tenant.data.routeCode} <StatusBadge status={tenant.data.routeStatus.toLowerCase()} />
          </p>
        ) : (
          <p>{t("liveRouting.noTenantRoute")}</p>
        )}
        {manage && (
          <Button
            variant="outline"
            disabled={busy || tenant.isPending || tenant.isError}
            onClick={() =>
              onAction({
                kind: "assignTenant",
                tenantId,
                routeId: route.id,
                channel: route.channel,
              })
            }
          >
            {t("liveRouting.action.assignTenant")}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <h4>{t("liveRouting.senderOverride")}</h4>
        {senders.isError ? (
          <ErrorState error={senders.error} onRetry={() => void senders.refetch()} />
        ) : senders.isPending ? (
          <TableSkeleton rows={2} />
        ) : (
          <>
            <Select value={sender} onValueChange={setSender}>
              <SelectTrigger aria-label={t("liveRouting.selectSender")}>
                <SelectValue placeholder={t("liveRouting.selectSender")}>
                  {selected.data ? senderLabel(selected.data) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {senders.data.items.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {senderLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CursorControls
              previous={page > 1}
              next={page * 20 < senders.data.total}
              busy={senders.isFetching}
              onPrevious={() => setPage((current) => current - 1)}
              onNext={() => setPage((current) => current + 1)}
            />
          </>
        )}
        {sender &&
          (selected.isError || assignment.isError ? (
            <ErrorState
              onRetry={() => {
                void selected.refetch();
                void assignment.refetch();
              }}
            />
          ) : selected.isPending || assignment.isPending ? (
            <TableSkeleton rows={1} />
          ) : assignment.data ? (
            <p>
              {assignment.data.routeCode}{" "}
              <StatusBadge status={assignment.data.routeStatus.toLowerCase()} />
            </p>
          ) : (
            <p>{t("liveRouting.noSenderRoute")}</p>
          ))}
        {manage && (
          <Button
            variant="outline"
            disabled={
              busy ||
              !sender ||
              !selected.data ||
              selected.data.channel !== route.channel.toLowerCase() ||
              selected.isError ||
              assignment.isPending ||
              assignment.isError
            }
            onClick={() =>
              onAction({
                kind: "assignSender",
                tenantId,
                senderIdentityId: sender,
                routeId: route.id,
              })
            }
          >
            {t("liveRouting.action.assignSender")}
          </Button>
        )}
      </div>
    </div>
  );
}
function CursorControls({
  previous,
  next,
  busy,
  onPrevious,
  onNext,
}: {
  previous: boolean;
  next: boolean;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("table.pagination")} className="flex gap-2 border-t p-3">
      <Button size="sm" variant="outline" disabled={!previous || busy} onClick={onPrevious}>
        {t("common.previous")}
      </Button>
      <Button size="sm" variant="outline" disabled={!next || busy} onClick={onNext}>
        {t("common.next")}
      </Button>
    </nav>
  );
}
