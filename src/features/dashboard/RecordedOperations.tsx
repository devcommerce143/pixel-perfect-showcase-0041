import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import { dashboardAuditQuery } from "@/lib/api/dashboard-completion";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { ErrorState, EmptyState, TableSkeleton } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { Button } from "@/components/ui/button";

export function DashboardRecordedHealth({ actor }: { actor: SenderIdentityActor }) {
  const { t, locale } = useI18n();
  const health = useQuery(queries.providerMonitoring(actor, { limit: 5 }));
  return (
    <div>
      <p className="px-4 pt-3 text-caption">{t("dashOps.healthHint")}</p>
      {health.isError ? (
        <ErrorState onRetry={() => void health.refetch()} />
      ) : health.isPending ? (
        <TableSkeleton rows={3} />
      ) : health.data.items.length === 0 ? (
        <EmptyState title={t("liveProviders.empty")} />
      ) : (
        <ul className="divide-y">
          {health.data.items.map((row) => (
            <li key={row.providerAccountId} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link
                  className="font-medium underline"
                  to="/platform/providers"
                  search={{ providerId: row.providerAccountId }}
                >
                  {row.code}
                </Link>
                <StatusBadge status={row.state.toLowerCase()} />
              </div>
              <ChannelLabel channel={row.channel.toLowerCase() as "sms" | "email" | "whatsapp"} />
              <p className="text-caption">
                {row.lastCheckedAt === null
                  ? t("liveProviders.noObservation")
                  : formatDateTime(row.lastCheckedAt, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Button
        className="m-3"
        variant="ghost"
        size="sm"
        disabled={health.isFetching}
        onClick={() => void health.refetch()}
      >
        {t("common.refresh")}
      </Button>
    </div>
  );
}

export function DashboardRecentAudit({ actor }: { actor: SenderIdentityActor }) {
  const { t, locale } = useI18n();
  const [range, setRange] = useState(() => dashboardAuditQuery());
  const activity = useQuery(queries.administrativeAudit(actor, range));
  function refresh() {
    const next = dashboardAuditQuery();
    setRange(next);
    if (next.acceptedFrom === range.acceptedFrom && next.acceptedTo === range.acceptedTo)
      void activity.refetch();
  }
  return (
    <div>
      <p className="px-4 pt-3 text-caption">{t("dashOps.auditHint")}</p>
      {activity.isError ? (
        <ErrorState onRetry={refresh} />
      ) : activity.isPending ? (
        <TableSkeleton rows={3} />
      ) : activity.data.items.length === 0 ? (
        <EmptyState title={t("dashOps.noAudit")} />
      ) : (
        <ul className="divide-y">
          {activity.data.items.map((event) => (
            <li key={event.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="break-all font-medium">{event.action}</span>
                <StatusBadge status={event.outcome.toLowerCase()} />
              </div>
              <p className="text-caption">{formatDateTime(event.createdAt, locale)}</p>
            </li>
          ))}
        </ul>
      )}
      <Button
        className="m-3"
        variant="ghost"
        size="sm"
        disabled={activity.isFetching}
        onClick={refresh}
      >
        {t("common.refresh")}
      </Button>
    </div>
  );
}
