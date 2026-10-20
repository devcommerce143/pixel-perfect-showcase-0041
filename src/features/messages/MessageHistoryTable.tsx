import { useNavigate } from "@tanstack/react-router";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { messageHistoryDetailTenantId } from "@/lib/api/message-history-query-keys";
import type { MessageHistoryItem, PlatformMessageHistoryItem } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";

export function MessageHistoryTable({
  rows,
  loading,
  showTenant,
}: {
  rows: (MessageHistoryItem | PlatformMessageHistoryItem)[] | undefined;
  loading?: boolean;
  showTenant?: boolean;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const tenantColumn: Column<MessageHistoryItem | PlatformMessageHistoryItem> = {
    id: "tenant",
    header: t("common.tenant"),
    cell: (message) =>
      "tenantId" in message ? (
        <div className="min-w-32">
          <div className="font-medium">{message.tenantName}</div>
          <div className="break-all font-mono text-xs text-muted-foreground">
            {message.tenantId}
          </div>
        </div>
      ) : null,
  };
  const columns: Column<MessageHistoryItem | PlatformMessageHistoryItem>[] = [
    {
      id: "id",
      header: t("common.messageId"),
      cell: (message) => (
        <button
          type="button"
          className="font-mono text-xs font-medium text-primary whitespace-nowrap"
          onClick={(event) => {
            event.stopPropagation();
            openMessage(message);
          }}
        >
          {message.id}
        </button>
      ),
    },
    {
      id: "channel",
      header: t("common.channel"),
      cell: (message) => <ChannelLabel channel={message.channel} />,
    },
    {
      id: "application",
      header: t("msg.applicationId"),
      cell: (message) => <span className="font-mono text-xs">{message.applicationId}</span>,
    },
    ...(showTenant ? [tenantColumn] : []),
    {
      id: "status",
      header: t("common.status"),
      cell: (message) => <StatusBadge status={message.status} />,
    },
    {
      id: "accepted",
      header: t("msg.acceptedAt"),
      cell: (message) => (
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {formatDateTime(message.acceptedAt, locale)}
        </span>
      ),
    },
    {
      id: "queued",
      header: t("msg.queuedAt"),
      cell: (message) =>
        message.queuedAt ? (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDateTime(message.queuedAt, locale)}
          </span>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      rowKey={(message) => message.id}
      onRowClick={openMessage}
    />
  );

  function openMessage(message: MessageHistoryItem | PlatformMessageHistoryItem) {
    void navigate({
      to: "/messages/$messageId",
      params: { messageId: message.id },
      search: (previous) =>
        ({
          ...previous,
            historyTenantId: messageHistoryDetailTenantId(message),
        }) as never,
    });
  }
}
