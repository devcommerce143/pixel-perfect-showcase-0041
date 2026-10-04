import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { queries } from "@/lib/api/queries";
import type { ConfigParam } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/config")({
  head: () => pageHead("System Configuration", "Platform-wide configuration."),
  component: () => <RequirePermission permission="platform.config"><Config /></RequirePermission>,
});

function Config() {
  const { t } = useI18n();
  const q = useQuery(queries.config());
  const columns: Column<ConfigParam>[] = [
    { id: "k", header: t("cfg.key"), cell: (c) => <span dir="ltr" className="font-mono text-xs font-medium">{c.key}</span> },
    { id: "v", header: t("common.value"), cell: (c) => <code dir="ltr" className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{c.value}</code> },
    { id: "d", header: t("common.description"), className: "hidden md:table-cell", cell: (c) => <span className="text-muted-foreground">{c.description}</span> },
  ];
  const groups = [...new Set((q.data ?? []).map((c) => c.category))];
  return (
    <>
      <PageHeader title={t("cfg.title")} description={t("cfg.subtitle")} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <Lock className="mt-0.5 size-4 shrink-0" />{t("cfg.readOnly")}
        </div>
        {q.isLoading ? <Section><DataTable columns={columns} rows={undefined} loading rowKey={(c) => c.key} /></Section>
          : groups.map((g) => (
            <Section key={g} title={g}><DataTable dense columns={columns} rows={q.data?.filter((c) => c.category === g)} rowKey={(c) => c.key} /></Section>
          ))}
      </PageBody>
    </>
  );
}
