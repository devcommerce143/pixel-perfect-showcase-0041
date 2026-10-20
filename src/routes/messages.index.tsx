import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Send } from "lucide-react";
import { FilterSelect } from "@/components/app/FilterSelect";
import { TablePagination, TableToolbar } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { EmptyState, ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageTable } from "@/features/messages/MessageTable";
import { MessageHistoryTable } from "@/features/messages/MessageHistoryTable";
import { queries } from "@/lib/api/queries";
import { messageHistoryScope } from "@/lib/api/message-history-query-keys";
import { buildMessageHistoryQuery, defaultMessageHistoryDateRange, isValidMessageHistoryDateRange, messageHistoryPageCsv } from "@/lib/api/http/message-history-mapper";
import type { Channel, MessageHistoryDateRange, MessageHistoryStatus, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/")({
  head: () => pageHead("Message History", "Filter and inspect SMS, WhatsApp and Email message history."),
  component: () => <RequirePermission permission="messages.view"><MessageHistory /></RequirePermission>,
});

const MOCK_STATUSES = ["queued", "processing", "sent", "delivered", "read", "failed", "rejected"];
const HISTORY_STATUSES: MessageHistoryStatus[] = ["accepted", "queued", "dispatching", "submitted", "failed", "unknown", "delivered", "read"];

function MessageHistory() {
  const { t } = useI18n();
  const { can, user, isPlatform, mode } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const historyScope = messageHistoryScope(isPlatform, selectedTenantId);
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<MessageHistoryDateRange>(() => defaultMessageHistoryDateRange());
  const messageQuery = { page, pageSize: 20, search, channel: channel as Channel | "all", status, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) };
  const mockQuery = useQuery({ ...queries.messages(messageQuery, actor), enabled: mode === "mock" });
  const rangeValid = isValidMessageHistoryDateRange(dateRange);
  const historyQuery = useMemo(() => {
    if (!rangeValid) return null;
    return buildMessageHistoryQuery(dateRange, {
      page,
      pageSize: 20,
      ...(channel !== "all" ? { channel: channel as Channel } : {}),
      ...(status !== "all" ? { status: status as MessageHistoryStatus } : {}),
    });
  }, [channel, dateRange, page, rangeValid, status]);
  const liveQuery = useQuery(queries.messageHistory(
    historyQuery,
    actor,
    isPlatform ? selectedTenantId : undefined,
    mode === "live" && historyScope === "tenant",
  ));
  const allTenantsLiveQuery = useQuery(queries.allTenantMessageHistory(
    historyQuery,
    actor,
    mode === "live" && historyScope === "all-tenants",
  ));
  const activeLiveQuery = historyScope === "all-tenants" ? allTenantsLiveQuery : liveQuery;
  const q = mode === "live" ? activeLiveQuery : mockQuery;
  useEffect(() => { setPage(1); }, [selectedTenantId]);
  const exportMessages = async () => {
    if (mode === "live" || !mockQuery.data?.total) return;
    const all = await queryClient.fetchQuery(queries.messages({ ...messageQuery, page: 1, pageSize: mockQuery.data.total }, actor));
    const headers = ["id", ...(isPlatform && !selectedTenantId ? [t("common.tenant")] : []), "channel", "recipient", "application", "template", "status", "createdAt"];
    const rows = all.items.map((message) => [message.id, ...(isPlatform && !selectedTenantId ? [message.tenantName] : []), message.channel, message.recipient, message.applicationName, message.templateName ?? "", message.status, message.createdAt]);
    const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
    saveCsv(csv, "dolf-connect-messages");
  };
  const exportCurrentHistoryPage = () => {
    if (mode !== "live" || !activeLiveQuery.data?.items.length) return;
    saveCsv(messageHistoryPageCsv(activeLiveQuery.data.items), "dolf-connect-message-history-page");
  };

  return (
    <>
      <PageHeader
        title={t("msg.historyTitle")}
        description={t("msg.historySubtitle")}
        actions={
          <>
            {mode === "mock"
              ? <Button variant="outline" size="sm" disabled={!mockQuery.data?.total} onClick={() => void exportMessages()}><Download className="size-4" />{t("common.export")}</Button>
              : <Button variant="outline" size="sm" disabled={!activeLiveQuery.data?.items.length} aria-describedby="message-history-export-note" onClick={exportCurrentHistoryPage}><Download className="size-4" />{t("msg.exportCurrentPage")}</Button>}
            {can("messages.send") && <Button asChild size="sm"><Link to="/messages/send"><Send className="size-4 rtl:-scale-x-100" />{t("nav.send")}</Link></Button>}
          </>
        }
      />
      <PageBody>
        <Section>
          {mode === "mock" ? (
            <TableToolbar search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder={t("msg.searchPlaceholder")}>
              <FilterSelect label={t("common.channel")} value={channel} onChange={(v) => { setChannel(v); setPage(1); }}
                options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((c) => ({ value: c, label: t(`channel.${c}`) }))]} />
              <FilterSelect label={t("common.status")} value={status} onChange={(v) => { setStatus(v); setPage(1); }}
                options={[{ value: "all", label: t("common.allStatuses") }, ...MOCK_STATUSES.map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) }))]} />
            </TableToolbar>
          ) : (
            <div className="flex flex-col gap-3 border-b px-4 py-3">
              <p id="message-history-export-note" className="text-caption text-muted-foreground">{t("msg.exportCurrentPageNote")}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="grid gap-1.5">
                  <Label htmlFor="message-history-from">{t("msg.dateFrom")}</Label>
                  <Input id="message-history-from" type="date" value={dateRange.from} max={dateRange.through} onChange={(event) => { setDateRange((range) => ({ ...range, from: event.target.value })); setPage(1); }} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="message-history-through">{t("msg.dateThrough")}</Label>
                  <Input id="message-history-through" type="date" value={dateRange.through} min={dateRange.from} onChange={(event) => { setDateRange((range) => ({ ...range, through: event.target.value })); setPage(1); }} />
                </div>
                <FilterSelect label={t("common.channel")} value={channel} onChange={(v) => { setChannel(v); setPage(1); }}
                  options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((c) => ({ value: c, label: t(`channel.${c}`) }))]} />
                <FilterSelect label={t("common.status")} value={status} onChange={(v) => { setStatus(v); setPage(1); }}
                  options={[{ value: "all", label: t("common.allStatuses") }, ...HISTORY_STATUSES.map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) }))]} />
              </div>
              {!rangeValid && <p role="alert" className="text-sm text-danger">{t("msg.dateRangeInvalid")}</p>}
            </div>
          )}
          {q.isError ? (
            <ErrorState onRetry={() => void q.refetch()} />
          ) : mode === "live" ? (
            rangeValid ? <>
              <MessageHistoryTable
                rows={activeLiveQuery.data?.items}
                loading={activeLiveQuery.isFetching}
                showTenant={historyScope === "all-tenants"}
              />
              {activeLiveQuery.data && activeLiveQuery.data.total > 0 && <TablePagination page={page} pageSize={activeLiveQuery.data.pageSize} total={activeLiveQuery.data.total} onPage={setPage} />}
            </> : null
          ) : (
            <>
              <MessageTable rows={mockQuery.data?.items} loading={mockQuery.isFetching} showTenant={historyScope === "all-tenants"} />
              {mockQuery.data && mockQuery.data.total > 0 && <TablePagination page={page} pageSize={20} total={mockQuery.data.total} onPage={setPage} />}
            </>
          )}
        </Section>
      </PageBody>
    </>
  );
}

function saveCsv(csv: string, filePrefix: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
