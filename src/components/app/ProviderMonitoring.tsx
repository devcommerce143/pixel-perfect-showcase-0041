import { useState } from "react";
import { ProviderBalanceObservation } from "./ProviderBalanceObservation";
import { ProviderAccountActions } from "./ProviderAccountActions";
import { ProviderBindings } from "./ProviderBindings";
import { SmsPilotControlState } from "./SmsPilotControlState";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import type { ProviderHealthRecord, ProviderRecordedCheck } from "@/lib/api/provider-monitoring";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { DataTable, type Column } from "./DataTable";
import { StatusBadge } from "./StatusBadge";
import { ChannelLabel } from "./ChannelLabel";
import { ErrorState, EmptyState, TableSkeleton } from "./States";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProviderMonitoring({
  view,
  initialId,
}: {
  view: "accounts" | "health";
  initialId?: string | undefined;
}) {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const [channel, setChannel] = useState<"SMS" | "EMAIL" | "WHATSAPP" | "all">("all");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const [selected, setSelected] = useState(initialId ?? "");
  const list = useQuery(
    queries.providerMonitoring(actor, {
      limit: 20,
      ...(cursor ? { cursor } : {}),
      ...(channel !== "all" ? { channel } : {}),
    }),
  );
  const columns: Column<ProviderHealthRecord>[] = [
    {
      id: "code",
      header: t("liveProviders.code"),
      cell: (row) => (
        <button className="text-start underline" onClick={() => setSelected(row.providerAccountId)}>
          {row.code}
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
      header: t("providerAccounts.transport"),
      cell: (row) =>
        row.transport ? t(`providerTransport.${row.transport}`) : t("liveProviders.notAvailable"),
    },
    {
      id: "account-status",
      header: t("liveProviders.accountStatus"),
      cell: (row) => <StatusBadge status={row.accountStatus.toLowerCase()} />,
    },
    {
      id: "health",
      header: t("liveProviders.observedState"),
      cell: (row) => <StatusBadge status={row.state.toLowerCase()} />,
    },
    {
      id: "checked",
      header: t("liveProviders.lastChecked"),
      cell: (row) =>
        row.lastCheckedAt
          ? formatDateTime(row.lastCheckedAt, locale)
          : t("liveProviders.noObservation"),
    },
    {
      id: "http",
      header: t("liveProviders.http"),
      cell: (row) => row.lastHttpStatus ?? t("liveProviders.notAvailable"),
    },
    {
      id: "latency",
      header: t("liveProviders.latency"),
      cell: (row) =>
        row.lastLatencyMs === null
          ? t("liveProviders.notAvailable")
          : t("liveProviders.milliseconds", { value: row.lastLatencyMs }),
    },
    {
      id: "failure",
      header: t("liveProviders.failure"),
      cell: (row) =>
        row.lastFailureClass
          ? t(`liveProviders.failure.${row.lastFailureClass}`)
          : t("liveProviders.notAvailable"),
    },
  ];
  return (
    <>
      <PageHeader
        title={t(view === "health" ? "health.title" : "liveProviders.title")}
        description={t("liveProviders.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {view === "accounts" && (
              <ProviderAccountActions
                actor={actor}
                onCreated={(id) => {
                  setSelected(id);
                  setCursors([undefined]);
                }}
              />
            )}
            <Button
              variant="outline"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              {t("common.refresh")}
            </Button>
          </div>
        }
      />
      <PageBody>
        {view === "health" && <SmsPilotControlState actor={actor} />}
        <Section>
          <div className="p-4">
            <Select
              value={channel}
              onValueChange={(value) => {
                setChannel(value as typeof channel);
                setCursors([undefined]);
                setSelected("");
              }}
            >
              <SelectTrigger className="w-56" aria-label={t("common.channel")}>
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
          </div>
          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : list.isPending ? (
            <TableSkeleton />
          ) : (
            <>
              {list.data.items.length ? (
                <DataTable
                  columns={columns}
                  rows={list.data.items}
                  rowKey={(row) => row.providerAccountId}
                />
              ) : (
                <EmptyState title={t("liveProviders.empty")} />
              )}
              <CursorButtons
                previous={cursors.length > 1}
                next={list.data.nextCursor !== null}
                pending={list.isFetching}
                onPrevious={() => setCursors((current) => current.slice(0, -1))}
                onNext={() => {
                  if (list.data.nextCursor)
                    setCursors((current) => [...current, list.data.nextCursor!]);
                }}
              />
            </>
          )}
        </Section>
        {selected && (
          <ProviderDetails
            key={selected}
            actor={actor}
            id={selected}
            configurable={view === "accounts"}
            onClose={() => setSelected("")}
          />
        )}
      </PageBody>
    </>
  );
}

function ProviderDetails({
  actor,
  id,
  onClose,
  configurable,
}: {
  actor: SenderIdentityActor;
  id: string;
  onClose: () => void;
  configurable: boolean;
}) {
  const { t, locale } = useI18n();
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const detail = useQuery(queries.providerMetadata(actor, id));
  const health = useQuery(queries.providerObservedHealth(actor, id));
  const checks = useQuery(
    queries.providerRecordedChecks(actor, id, { limit: 20, ...(cursor ? { cursor } : {}) }),
  );
  const columns: Column<ProviderRecordedCheck>[] = [
    {
      id: "started",
      header: t("liveProviders.started"),
      cell: (row) => formatDateTime(row.startedAt, locale),
    },
    {
      id: "finished",
      header: t("liveProviders.finished"),
      cell: (row) => formatDateTime(row.finishedAt, locale),
    },
    {
      id: "succeeded",
      header: t("liveProviders.recordedResult"),
      cell: (row) => <StatusBadge status={row.succeeded ? "success" : "failure"} />,
    },
    {
      id: "applied",
      header: t("liveProviders.applied"),
      cell: (row) => t(row.applied ? "liveProviders.yes" : "liveProviders.no"),
    },
    {
      id: "state",
      header: t("liveProviders.observedState"),
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={row.stateBefore.toLowerCase()} />
          <span>{t("liveProviders.to")}</span>
          <StatusBadge status={row.stateAfter.toLowerCase()} />
        </div>
      ),
    },
    {
      id: "http",
      header: t("liveProviders.http"),
      cell: (row) => row.httpStatus ?? t("liveProviders.notAvailable"),
    },
    {
      id: "latency",
      header: t("liveProviders.latency"),
      cell: (row) =>
        row.latencyMs === null
          ? t("liveProviders.notAvailable")
          : t("liveProviders.milliseconds", { value: row.latencyMs }),
    },
    {
      id: "failure",
      header: t("liveProviders.failure"),
      cell: (row) =>
        row.failureClass
          ? t(`liveProviders.failure.${row.failureClass}`)
          : t("liveProviders.notAvailable"),
    },
  ];
  return (
    <Section title={t("liveProviders.detail")}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <EntityName kind="provider" id={id} name={detail.data?.code} />
        </p>
        <Button
          variant="outline"
          disabled={health.isFetching || checks.isFetching || detail.isFetching}
          onClick={() => {
            void health.refetch();
            void checks.refetch();
            void detail.refetch();
          }}
        >
          {t("common.refresh")}
        </Button>
        <Button variant="outline" onClick={onClose}>
          {t("liveProviders.close")}
        </Button>
      </div>
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : detail.isPending ? (
        <TableSkeleton rows={2} />
      ) : (
        <dl className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <dt>{t("liveProviders.code")}</dt>
            <dd>{detail.data.code}</dd>
          </div>
          <div>
            <dt>{t("providerAccounts.transport")}</dt>
            <dd>
              {detail.data.transport
                ? t(`providerTransport.${detail.data.transport}`)
                : t("liveProviders.notAvailable")}
            </dd>
          </div>
          <div>
            <dt>{t("liveProviders.accountStatus")}</dt>
            <dd>
              <StatusBadge status={detail.data.status.toLowerCase()} />
            </dd>
          </div>
          <div>
            <dt>{t("liveProviders.keyVersion")}</dt>
            <dd>{detail.data.keyVersion}</dd>
          </div>
        </dl>
      )}
      {health.isError ? (
        <ErrorState error={health.error} onRetry={() => void health.refetch()} />
      ) : health.isPending ? (
        <TableSkeleton rows={2} />
      ) : (
        <div className="flex flex-wrap gap-4 p-4">
          <StatusBadge status={health.data.state.toLowerCase()} />
          <p>{t("liveProviders.successes", { value: health.data.consecutiveSuccesses })}</p>
          <p>{t("liveProviders.failures", { value: health.data.consecutiveFailures })}</p>
          <p>
            {t("liveProviders.lastChecked")}:{" "}
            {health.data.lastCheckedAt
              ? formatDateTime(health.data.lastCheckedAt, locale)
              : t("liveProviders.noObservation")}
          </p>
        </div>
      )}
      {configurable && detail.data && !detail.isError && (
        <div className="p-4">
          <ProviderAccountActions actor={actor} account={detail.data} />
          <ProviderBindings actor={actor} account={detail.data} />
        </div>
      )}
      {configurable && health.data && (
        <ProviderBalanceObservation
          observation={health.data.balanceObservation}
          readFailed={health.isError}
        />
      )}
      <h3 className="p-4 text-sm font-semibold">{t("liveProviders.checkHistory")}</h3>
      {checks.isError ? (
        <ErrorState error={checks.error} onRetry={() => void checks.refetch()} />
      ) : checks.isPending ? (
        <TableSkeleton />
      ) : (
        <>
          {checks.data.items.length ? (
            <DataTable columns={columns} rows={checks.data.items} rowKey={(row) => row.id} />
          ) : (
            <EmptyState title={t("liveProviders.noChecks")} />
          )}
          <CursorButtons
            previous={cursors.length > 1}
            next={checks.data.nextCursor !== null}
            pending={checks.isFetching}
            onPrevious={() => setCursors((current) => current.slice(0, -1))}
            onNext={() => {
              if (checks.data.nextCursor)
                setCursors((current) => [...current, checks.data.nextCursor!]);
            }}
          />
        </>
      )}
    </Section>
  );
}
function CursorButtons({
  previous,
  next,
  pending,
  onPrevious,
  onNext,
}: {
  previous: boolean;
  next: boolean;
  pending: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("table.pagination")} className="flex gap-2 border-t p-4">
      <Button variant="outline" size="sm" disabled={!previous || pending} onClick={onPrevious}>
        {t("common.previous")}
      </Button>
      <Button variant="outline" size="sm" disabled={!next || pending} onClick={onNext}>
        {t("common.next")}
      </Button>
    </nav>
  );
}
import { EntityName } from "./EntityName";
