import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Send } from "lucide-react";
import { FilterSelect } from "@/components/app/FilterSelect";
import { TablePagination, TableToolbar } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { MessageTable } from "@/features/messages/MessageTable";
import { queries } from "@/lib/api/queries";
import type { Channel } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/")({
  head: () => pageHead("Message History", "Search, filter and inspect SMS, WhatsApp and Email messages sent through Dolf Connect."),
  component: () => <RequirePermission permission="messages.view"><MessageHistory /></RequirePermission>,
});

const STATUSES = ["queued", "processing", "sent", "delivered", "read", "failed", "rejected"];

function MessageHistory() {
  const { t } = useI18n();
  const { can } = useSession();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const q = useQuery(queries.messages({ page, pageSize: 20, search, channel: channel as Channel | "all", status }));

  return (
    <>
      <PageHeader
        title={t("msg.historyTitle")}
        description={t("msg.historySubtitle")}
        actions={
          <>
            <Button variant="outline" size="sm"><Download className="size-4" />{t("common.export")}</Button>
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
          {q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <MessageTable rows={q.data?.items} loading={q.isFetching} />}
          {q.data && q.data.total > 0 && <TablePagination page={page} pageSize={20} total={q.data.total} onPage={setPage} />}
        </Section>
      </PageBody>
    </>
  );
}
