import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { queries } from "@/lib/api/queries";
import type { Channel, Template } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/templates")({
  head: () => pageHead("Templates", "Versioned, approval-controlled message templates for SMS, WhatsApp and Email."),
  component: () => <RequirePermission permission="templates.view"><Templates /></RequirePermission>,
});

function Templates() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Template | null>(null);
  const q = useQuery(queries.templates({ search, channel: channel as Channel | "all", status }));

  const columns: Column<Template>[] = [
    { id: "name", header: t("common.name"), cell: (r) => <span className="font-mono text-xs font-medium">{r.name}</span> },
    { id: "channel", header: t("common.channel"), cell: (r) => <ChannelLabel channel={r.channel} /> },
    { id: "category", header: t("common.category"), cell: (r) => r.category, className: "hidden md:table-cell" },
    { id: "lang", header: t("common.language"), cell: (r) => r.language.toUpperCase() },
    { id: "version", header: t("common.version"), cell: (r) => <span className="tabular-nums">v{r.version}</span> },
    { id: "status", header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
    { id: "updated", header: t("common.updatedAt"), cell: (r) => <span className="text-muted-foreground">{formatDate(r.updatedAt, locale)}</span> },
  ];

  return (
    <>
      <PageHeader title={t("tpl.title")} description={t("tpl.subtitle")}
        actions={can("templates.manage") && <Button size="sm"><Plus className="size-4" />{t("tpl.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("tpl.search")}>
            <FilterSelect label={t("common.channel")} value={channel} onChange={setChannel}
              options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((c) => ({ value: c, label: t(`channel.${c}`) }))]} />
            <FilterSelect label={t("common.status")} value={status} onChange={setStatus}
              options={[{ value: "all", label: t("common.allStatuses") }, ...["approved", "pending", "rejected", "draft"].map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(r) => r.id} onRowClick={setSelected} />
        </Section>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-base">{selected.name}</SheetTitle>
                <SheetDescription>{selected.id} · v{selected.version} · {selected.category}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                <div className="flex items-center gap-3"><ChannelLabel channel={selected.channel} /><StatusBadge status={selected.status} /></div>
                <div>
                  <div className="text-label mb-1.5">{t("tpl.preview")}</div>
                  <div className="rounded-md border bg-surface-subtle p-3 text-body" dir={selected.language === "ar" ? "rtl" : "ltr"}>{selected.body}</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
