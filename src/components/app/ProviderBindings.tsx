import { MessageAlert } from "@/components/app/MessageAlert";
import { EntityName } from "@/components/app/EntityName";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queries, senderBindingMutations } from "@/lib/api/queries";
import {
  bindingSenderReady,
  senderBindingFailureKey,
  senderBindingKey,
} from "@/lib/api/sender-bindings";
import type { StoredSenderBinding, SenderBindingOperation } from "@/lib/api/sender-bindings";
import type { ProviderAccountMetadata } from "@/lib/api/provider-monitoring";
import type { SenderIdentityActor, SenderIdentityRead } from "@/lib/api/types";
import { isTenantUuid } from "@/lib/api/http/tenant-mapper";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { DataTable, type Column } from "./DataTable";
import { ErrorState, EmptyState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function ProviderBindings({
  actor,
  account,
}: {
  actor: SenderIdentityActor;
  account: ProviderAccountMetadata;
}) {
  const { tenantId } = useGlobalTenantContext();
  const { t } = useI18n();
  return (
    <div className="border-t p-4">
      <h3 className="text-sm font-semibold">{t("senderBindings.title")}</h3>
      {tenantId && isTenantUuid(tenantId) ? (
        <ScopedBindings
          key={`${actor.userId}:${actor.role}:${actor.tenantId}:${tenantId}:${account.id}`}
          actor={actor}
          tenantId={tenantId}
          account={account}
        />
      ) : (
        <EmptyState title={t("senderBindings.chooseTenant")} />
      )}
    </div>
  );
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
function ScopedBindings({
  actor,
  tenantId,
  account,
}: {
  actor: SenderIdentityActor;
  tenantId: string;
  account: ProviderAccountMetadata;
}) {
  const { can } = useSession();
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const [creating, setCreating] = useState(false),
    [removing, setRemoving] = useState<StoredSenderBinding | null>(null),
    [selected, setSelected] = useState("");
  const [sender, setSender] = useState(""),
    [senderPage, setSenderPage] = useState(1),
    [providerName, setProviderName] = useState("");
  const [saved, setSaved] = useState(false);
  const list = useQuery(
    queries.storedSenderBindings(actor, {
      tenantId,
      providerAccountId: account.id,
      limit: 20,
      ...(cursor ? { cursor } : {}),
    }),
  );
  const senders = useQuery({
    ...queries.bindingSenderOptions(actor, tenantId, account.id, account.channel, senderPage),
    enabled: creating && can("platform.providers.manage"),
  });
  const senderDetail = useQuery(
    queries.senderIdentityRead(actor, sender, tenantId, creating && !!sender),
  );
  const detail = useQuery(queries.storedSenderBinding(actor, tenantId, account.id, selected));
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationKey: senderBindingKey(actor, tenantId, account.id),
    retry: false,
    mutationFn: (operation: SenderBindingOperation) =>
      senderBindingMutations.apply(actor, operation),
    onSuccess: async (result) => {
      if (!active.current) return;
      setCreating(false);
      setRemoving(null);
      setSaved(true);
      if (result.kind === "created") {
        setSelected(result.binding.id);
        setCursors([undefined]);
      } else if (selected === result.id) setSelected("");
      await qc.invalidateQueries({ queryKey: senderBindingKey(actor, tenantId, account.id) });
    },
  });
  const manage = can("platform.providers.manage");
  const columns: Column<StoredSenderBinding>[] = [
    {
      id: "id",
      header: t("senderBindings.id"),
      cell: (row) => (
        <button className="font-mono text-xs underline" onClick={() => setSelected(row.id)}>
          {row.providerSenderName}
        </button>
      ),
    },
    {
      id: "sender",
      header: t("senderBindings.senderId"),
      cell: (row) => (
        <span className="font-mono text-xs">
          <EntityName kind="sender" id={row.senderIdentityId} tenantId={tenantId} />
        </span>
      ),
    },
    { id: "name", header: t("senderBindings.providerName"), cell: (row) => row.providerSenderName },
    {
      id: "created",
      header: t("senderBindings.created"),
      cell: (row) => formatDateTime(row.createdAt, locale),
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
            onClick={() => {
              mutation.reset();
              setSaved(false);
              setRemoving(row);
            }}
          >
            {t("senderBindings.remove")}
          </Button>
        ),
    },
  ];
  const ready =
    senderDetail.data &&
    senderDetail.data.tenantId === tenantId &&
    bindingSenderReady(senderDetail.data, account.channel);
  const valid =
    !!ready &&
    !senderDetail.isError &&
    (account.channel !== "SMS" ||
      (providerName.length > 0 &&
        providerName.length <= 64 &&
        providerName.trim() === providerName));
  function create() {
    const common = {
      kind: "create" as const,
      tenantId,
      providerAccountId: account.id,
      senderIdentityId: sender,
    };
    mutation.mutate(
      account.channel === "SMS"
        ? { ...common, channel: "SMS", providerSenderName: providerName }
        : { ...common, channel: account.channel },
    );
  }
  return (
    <div className="space-y-3 pt-3">
      <p className="font-mono text-xs">
        <EntityName kind="tenant" id={tenantId} />
      </p>
      <p className="text-subtle">{t("senderBindings.note")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
          {t("common.refresh")}
        </Button>
        {manage && (
          <Button
            disabled={
              mutation.isPending ||
              account.status !== "ACTIVE" ||
              !account.transport ||
              account.transport === "TAQNYAT_WHATSAPP"
            }
            onClick={() => {
              mutation.reset();
              setSaved(false);
              setSender("");
              setSenderPage(1);
              setProviderName("");
              setCreating(true);
            }}
          >
            {t("senderBindings.create")}
          </Button>
        )}
      </div>
      {saved && <p role="status">{t("senderBindings.saved")}</p>}
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <TableSkeleton />
      ) : list.data.items.length ? (
        <DataTable columns={columns} rows={list.data.items} rowKey={(row) => row.id} />
      ) : (
        <EmptyState title={t("senderBindings.empty")} />
      )}
      <Paging
        previous={cursors.length > 1}
        next={!!list.data?.nextCursor && !list.isError}
        busy={list.isFetching}
        onPrevious={() => setCursors((current) => current.slice(0, -1))}
        onNext={() => {
          if (list.data?.nextCursor) setCursors((current) => [...current, list.data.nextCursor!]);
        }}
      />
      <Dialog
        open={creating}
        onOpenChange={(value) => {
          if (!mutation.isPending) setCreating(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("senderBindings.create")}</DialogTitle>
            <DialogDescription>{t("senderBindings.note")}</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs">
            {account.code} / <EntityName kind="tenant" id={tenantId} />
          </p>
          {senders.isError ? (
            <ErrorState error={senders.error} onRetry={() => void senders.refetch()} />
          ) : senders.isPending ? (
            <TableSkeleton rows={2} />
          ) : (
            <>
              <Select value={sender} onValueChange={setSender}>
                <SelectTrigger aria-label={t("senderBindings.selectSender")}>
                  <SelectValue placeholder={t("senderBindings.selectSender")}>
                    {senderDetail.data ? senderLabel(senderDetail.data) : undefined}
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
              <Paging
                previous={senderPage > 1}
                next={senderPage * 20 < senders.data.total}
                busy={senders.isFetching}
                onPrevious={() => setSenderPage((current) => current - 1)}
                onNext={() => setSenderPage((current) => current + 1)}
              />
            </>
          )}
          {senderDetail.isError && (
            <ErrorState error={senderDetail.error} onRetry={() => void senderDetail.refetch()} />
          )}
          {senderDetail.data && (
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={senderDetail.data.verificationStatus} />
              <StatusBadge status={senderDetail.data.operationalStatus} />
            </div>
          )}
          {sender && senderDetail.isSuccess && !ready && (
            <MessageAlert>
              {t(
                account.channel === "EMAIL"
                  ? "senderBindings.emailReadiness"
                  : "senderBindings.whatsappReadiness",
              )}
            </MessageAlert>
          )}
          {account.channel === "SMS" ? (
            <>
              <Label htmlFor="binding-provider-name">{t("senderBindings.providerName")}</Label>
              <Input
                id="binding-provider-name"
                dir="ltr"
                value={providerName}
                onChange={(event) => setProviderName(event.target.value)}
                maxLength={64}
              />
            </>
          ) : (
            <p className="text-subtle">{t("senderBindings.derived")}</p>
          )}
          {mutation.isError && (
            <MessageAlert>{t(senderBindingFailureKey(mutation.error))}</MessageAlert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setCreating(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button disabled={mutation.isPending || !valid} onClick={create}>
              {t("senderBindings.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removing !== null}
        onOpenChange={(value) => {
          if (!value && !mutation.isPending) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("senderBindings.remove")}</DialogTitle>
            <DialogDescription>{t("senderBindings.removeNote")}</DialogDescription>
          </DialogHeader>
          <p className="font-mono text-xs">
            <EntityName kind="tenant" id={tenantId} /> / {account.code}
          </p>
          <p>{removing?.providerSenderName}</p>
          {mutation.isError && (
            <MessageAlert>{t(senderBindingFailureKey(mutation.error))}</MessageAlert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setRemoving(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => {
                if (removing)
                  mutation.mutate({
                    kind: "remove",
                    id: removing.id,
                    tenantId,
                    providerAccountId: account.id,
                  });
              }}
            >
              {t("senderBindings.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(value) => {
          if (!value) setSelected("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("senderBindings.detail")}</DialogTitle>
            <DialogDescription>{t("entity.details")}</DialogDescription>
          </DialogHeader>
          {detail.isError ? (
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
          ) : detail.isPending ? (
            <TableSkeleton rows={3} />
          ) : (
            <dl className="space-y-2">
              <div>
                <dt>{t("senderBindings.senderId")}</dt>
                <dd className="font-mono text-xs">
                  <EntityName kind="sender" id={detail.data.senderIdentityId} tenantId={tenantId} />
                </dd>
              </div>
              <div>
                <dt>{t("senderBindings.providerName")}</dt>
                <dd>{detail.data.providerSenderName}</dd>
              </div>
              <div>
                <dt>{t("senderBindings.created")}</dt>
                <dd>{formatDateTime(detail.data.createdAt, locale)}</dd>
              </div>
              <div>
                <dt>{t("senderBindings.updated")}</dt>
                <dd>{formatDateTime(detail.data.updatedAt, locale)}</dd>
              </div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Paging({
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
      <Button variant="outline" size="sm" disabled={!previous || busy} onClick={onPrevious}>
        {t("common.previous")}
      </Button>
      <Button variant="outline" size="sm" disabled={!next || busy} onClick={onNext}>
        {t("common.next")}
      </Button>
    </nav>
  );
}
