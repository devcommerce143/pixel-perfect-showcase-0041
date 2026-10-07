import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Send } from "lucide-react";
import { FilterSelect } from "@/components/app/FilterSelect";
import { TablePagination, TableToolbar } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { MessageTable } from "@/features/messages/MessageTable";
import { queries } from "@/lib/api/queries";
import type { Channel, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/")({
  head: () => pageHead("Message History", "Search, filter and inspect SMS, WhatsApp and Email messages sent through Dolf Connect."),
  component: () => <RequirePermission permission="messages.view"><MessageHistory /></RequirePermission>,
});

const STATUSES = ["queued", "processing", "sent", "delivered", "read", "failed", "rejected"];

function MessageHistory() {
  const { t } = useI18n();
  const { can, user, isPlatform } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const messageQuery = { page, pageSize: 20, search, channel: channel as Channel | "all", status, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) };
  const q = useQuery(queries.messages(messageQuery, actor));
  useEffect(() => { setPage(1); }, [selectedTenantId]);
  const exportMessages = async () => {
    if (!q.data?.total) return;
    const all = await queryClient.fetchQuery(queries.messages({ ...messageQuery, page: 1, pageSize: q.data.total }, actor));
    const headers = ["id", ...(isPlatform && !selectedTenantId ? [t("common.tenant")] : []), "channel", "recipient", "application", "template", "status", "createdAt"];
    const rows = all.items.map((message) => [message.id, ...(isPlatform && !selectedTenantId ? [message.tenantName] : []), message.channel, message.recipient, message.applicationName, message.templateName ?? "", message.status, message.createdAt]);
    const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dolf-connect-messages-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={t("msg.historyTitle")}
        description={t("msg.historySubtitle")}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={!q.data?.total} onClick={() => void exportMessages()}><Download className="size-4" />{t("common.export")}</Button>
            {can("messages.send") && <Button asChild size="sm"><Link to="/messages/send"><Send className="size-4 rtl:-scale-x-100" />{t("nav.send")}</Link></Button>}
          </>
        }
      />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder={t("msg.searchPlaceholder")}>
            <FilterSelect label={t("common.channel")} value={channel} onChange={(v) => { setChannel(v); setPage(1); }}
              options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((c) => ({ value: c, label: t(`channel.${c}`) }))]} />
            <FilterSelect label={t("common.status")} value={status} onChange={(v) => { setStatus(v); setPage(1); }}
              options={[{ value: "all", label: t("common.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) }))]} />
          </TableToolbar>
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <MessageTable rows={q.data?.items} loading={q.isFetching} showTenant={isPlatform && !selectedTenantId} />}
          {q.data && q.data.total > 0 && <TablePagination page={page} pageSize={20} total={q.data.total} onPage={setPage} />}
        </Section>
      </PageBody>
    </>
  );
}
