import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, Download, User } from "lucide-react";
import { toast } from "sonner";
import { DataTable, TablePagination, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { queries } from "@/lib/api/queries";
import type { AuditEvent } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/audit")({
  head: () => pageHead("Audit Logs", "Immutable record of security-relevant and administrative actions in Dolf Connect."),
  component: () => <RequirePermission permission="audit.view"><Audit /></RequirePermission>,
});

function Audit() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const [page, setPage] = useState(1);
  const q = useQuery(queries.audit({ page, pageSize: 20, search, status: result }));
  const exportAudit = async () => {
    if (!q.data?.total) return;
    const all = await queryClient.fetchQuery(queries.audit({ page: 1, pageSize: q.data.total, search, status: result }));
    const cell = (value: string) => {
      const text = value.replace(/^[=+@-]/, "'$&");
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [["id", "at", "actor", "actor_type", "action", "resource", "result", "ip"], ...all.items.map((event) => [event.id, event.at, event.actor, event.actorType, event.action, event.resource, event.result, event.ip])];
    const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dolf-connect-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(t("audit.exported"));
  };
  const columns: Column<AuditEvent>[] = [
    { id: "time", header: t("audit.time"), cell: (a) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(a.at, locale)}</span> },
    { id: "actor", header: t("audit.actor"), cell: (a) => (
      <span className="inline-flex items-center gap-1.5">
        {a.actorType === "service" ? <Bot className="size-4 text-muted-foreground" aria-label={t("audit.service")} /> : <User className="size-4 text-muted-foreground" aria-hidden />}
        <span className={a.actorType === "service" ? "font-mono text-xs" : ""}>{a.actor}</span>
      </span>) },
    { id: "action", header: t("audit.action"), cell: (a) => <span className="font-mono text-xs">{a.action}</span> },
    { id: "resource", header: t("audit.resource"), cell: (a) => a.resource, className: "hidden lg:table-cell" },
    { id: "result", header: t("audit.result"), cell: (a) => <StatusBadge status={a.result} /> },
    { id: "ip", header: t("audit.ip"), cell: (a) => <span dir="ltr" className="font-mono text-xs text-muted-foreground">{a.ip}</span>, className: "hidden md:table-cell" },
  ];
  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")}
        actions={<Button variant="outline" size="sm" disabled={!q.data?.total} onClick={() => void exportAudit()}><Download className="size-4" />{t("common.export")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder={t("audit.search")}>
            <FilterSelect label={t("audit.result")} value={result} onChange={(v) => { setResult(v); setPage(1); }}
              options={[{ value: "all", label: t("common.allStatuses") }, { value: "success", label: t("status.success") }, { value: "failure", label: t("status.failure") }]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(a) => a.id} dense />
          {q.data && q.data.total > 0 && <TablePagination page={page} pageSize={20} total={q.data.total} onPage={setPage} />}
        </Section>
      </PageBody>
    </>
  );
}
