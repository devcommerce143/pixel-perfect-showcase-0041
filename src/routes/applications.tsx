import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { queries } from "@/lib/api/queries";
import type { Application } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/applications")({
  head: () => pageHead("Applications", "Systems integrated with Dolf Connect through secured APIs, with enabled channels and credentials."),
  loader: ({ context }) => context.queryClient.ensureQueryData(queries.applications()),
  component: () => <RequirePermission permission="apps.view"><Applications /></RequirePermission>,
});

function Applications() {
  const { t, locale } = useI18n();
  const { can } = useSession();
  const { data } = useSuspenseQuery(queries.applications());
  const columns: Column<Application>[] = [
    { id: "name", header: t("common.name"), cell: (a) => (<div><div className="font-medium">{a.name}</div><div className="font-mono text-xs text-muted-foreground">{a.id}</div></div>) },
    { id: "env", header: t("common.environment"), cell: (a) => (
      <span className={cn("rounded-sm border px-1.5 py-0.5 text-xs font-medium", a.environment === "production" ? "border-primary/30 text-primary" : "text-muted-foreground")}>
        {t(a.environment === "production" ? "common.production" : "common.sandbox")}
      </span>) },
    { id: "channels", header: t("apps.channels"), cell: (a) => <div className="flex flex-wrap gap-3">{a.channels.map((c) => <ChannelLabel key={c} channel={c} />)}</div>, className: "hidden lg:table-cell" },
    { id: "creds", header: t("apps.credentials"), cell: (a) => <span className="tabular-nums">{a.credentialCount}</span> },
    { id: "status", header: t("common.status"), cell: (a) => <StatusBadge status={a.status} /> },
    { id: "last", header: t("apps.lastActivity"), cell: (a) => <span className="text-muted-foreground tabular-nums">{formatDateTime(a.lastActivityAt, locale)}</span> },
  ];
  return (
    <>
      <PageHeader title={t("apps.title")} description={t("apps.subtitle")}
        actions={can("apps.manage") && <Button size="sm"><Plus className="size-4" />{t("apps.new")}</Button>} />
      <PageBody><Section><DataTable columns={columns} rows={data} rowKey={(a) => a.id} /></Section></PageBody>
    </>
  );
}
