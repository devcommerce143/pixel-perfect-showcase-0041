import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { ApiCredential } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/credentials")({
  head: () => pageHead("API Credentials", "Manage machine credentials used by applications to authenticate with the Dolf Connect API."),
  loader: ({ context }) => context.queryClient.ensureQueryData(queries.credentials()),
  component: () => <RequirePermission permission="credentials.view"><Credentials /></RequirePermission>,
});

function Credentials() {
  const { t, locale } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(queries.credentials());
  const [target, setTarget] = useState<ApiCredential | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeCredential(id),
    onSuccess: (_, id) => { toast.success(t("cred.revoked", { id })); void qc.invalidateQueries({ queryKey: ["credentials"] }); setTarget(null); },
  });

  const columns: Column<ApiCredential>[] = [
    { id: "id", header: t("cred.clientId"), cell: (c) => (<div><div className="font-mono text-xs font-medium">{c.clientId}</div><div className="text-caption">{c.applicationName}</div></div>) },
    { id: "key", header: t("cred.key"), cell: (c) => <span dir="ltr" className="font-mono text-xs text-muted-foreground">{c.keyPrefix}••••••••</span> },
    { id: "scopes", header: t("common.scopes"), cell: (c) => <div className="flex flex-wrap gap-1">{c.scopes.map((s) => <span key={s} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem]">{s}</span>)}</div>, className: "hidden xl:table-cell" },
    { id: "status", header: t("common.status"), cell: (c) => <StatusBadge status={c.status} /> },
    { id: "expires", header: t("common.expires"), cell: (c) => <span className="tabular-nums text-muted-foreground">{formatDate(c.expiresAt, locale)}</span> },
    { id: "used", header: t("common.lastUsed"), cell: (c) => <span className="tabular-nums text-muted-foreground">{c.lastUsedAt ? formatDateTime(c.lastUsedAt, locale) : t("common.never")}</span>, className: "hidden lg:table-cell" },
    { id: "act", header: <span className="sr-only">{t("common.actions")}</span>, className: "text-end", cell: (c) =>
      can("credentials.manage") && c.status === "active" ? (
        <Button variant="ghost" size="sm" className="h-7 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setTarget(c)}>{t("cred.revoke")}</Button>
      ) : null },
  ];

  return (
    <>
      <PageHeader title={t("cred.title")} description={t("cred.subtitle")}
        actions={can("credentials.manage") && <Button size="sm"><Plus className="size-4" />{t("cred.new")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <KeyRound className="mt-0.5 size-4 shrink-0" />{t("cred.securityNote")}
        </div>
        <Section><DataTable columns={columns} rows={data} rowKey={(c) => c.id} /></Section>
      </PageBody>
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-danger" />{t("cred.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cred.revokeBody", { id: target?.clientId ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={revoke.isPending}
              onClick={(e) => { e.preventDefault(); if (target) revoke.mutate(target.id); }}>
              {t("cred.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
