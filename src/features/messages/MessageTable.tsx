import { useNavigate } from "@tanstack/react-router";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import type { Message } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useSession } from "@/lib/auth/session";

export function MessageTable({ rows, loading, compact, showTenant }: { rows: Message[] | undefined; loading?: boolean; compact?: boolean; showTenant?: boolean }) {
  const { t, locale } = useI18n();
  const { isPlatform } = useSession();
  const navigate = useNavigate();
  const columns: Column<Message>[] = [
    { id: "id", header: t("common.messageId"), cell: (m) => <span className="font-mono text-xs font-medium text-primary whitespace-nowrap">{m.id}</span> },
    { id: "channel", header: t("common.channel"), cell: (m) => <ChannelLabel channel={m.channel} /> },
    { id: "recipient", header: t("common.recipient"), cell: (m) => <span dir="ltr" className="font-mono text-xs">{m.recipient}</span> },
    { id: "app", header: t("common.application"), cell: (m) => m.applicationName, className: compact ? "hidden xl:table-cell" : "" },
    ...((showTenant ?? isPlatform) ? [{ id: "tenant", header: t("common.tenant"), cell: (m: Message) => m.tenantName, className: compact ? "hidden xl:table-cell" : "" }] : []),
    { id: "template", header: t("common.template"), cell: (m) => m.templateName ? <span className="font-mono text-xs">{m.templateName}</span> : <span className="text-muted-foreground">—</span>, className: "hidden lg:table-cell" },
    { id: "status", header: t("common.status"), cell: (m) => <StatusBadge status={m.status} /> },
    { id: "created", header: t("common.createdAt"), cell: (m) => <span className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(m.createdAt, locale)}</span> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      dense={compact}
      rowKey={(m) => m.id}
      onRowClick={(m) => navigate({ to: "/messages/$messageId", params: { messageId: m.id } })}
    />
  );
}
