import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/app/States";
import type { DashboardRecentMessage, DashboardRecentMessages } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";

export function LiveRecentMessages({
  data,
  isError,
  onRetry,
}: {
  data: DashboardRecentMessages | undefined;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!data) return <TableSkeleton />;
  if (data.items.length === 0) {
    return <EmptyState title={t("dash.recentEmptyTitle")} body={t("dash.recentEmptyBody")} />;
  }
  return <RecentMessagesTable items={data.items} showTenant={data.scope === "platform"} />;
}

function RecentMessagesTable({ items, showTenant }: { items: DashboardRecentMessage[]; showTenant: boolean }) {
  const { t, locale } = useI18n();
  const columns: Column<DashboardRecentMessage>[] = [
    {
      id: "id",
      header: t("entity.message"),
      cell: (message) => (
        <span className="whitespace-nowrap font-mono text-xs font-medium text-primary">
          {message.applicationName}
        </span>
      ),
    },
    { id: "channel", header: t("common.channel"), cell: (message) => <ChannelLabel channel={message.channel} /> },
    {
      id: "recipient",
      header: t("common.recipient"),
      cell: (message) => message.recipient
        ? <span dir="ltr" className="font-mono text-xs">{message.recipient}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    { id: "app", header: t("common.application"), cell: (message) => message.applicationName, className: "hidden xl:table-cell" },
    ...(showTenant ? [{ id: "tenant", header: t("common.tenant"), cell: (message: DashboardRecentMessage) => message.tenantName, className: "hidden xl:table-cell" }] : []),
    {
      id: "template",
      header: t("common.template"),
      cell: (message) => message.templateKey ? <span className="font-mono text-xs">{message.templateKey}</span> : <span className="text-muted-foreground">—</span>,
      className: "hidden lg:table-cell",
    },
    { id: "status", header: t("common.status"), cell: (message) => <StatusBadge status={message.status} /> },
    { id: "accepted", header: t("common.createdAt"), cell: (message) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(message.acceptedAt, locale)}</span> },
  ];
  return <DataTable columns={columns} rows={items} dense rowKey={(message) => message.id} />;
}
