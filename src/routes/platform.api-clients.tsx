import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { PlatformApiClient } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useSession } from "@/lib/auth/session";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/api-clients")({
  head: () => pageHead("API Clients", "Machine identities across tenants."),
  component: () => <RequirePermission permission="platform.apiClients"><ApiClients /></RequirePermission>,
});

function ApiClients() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<PlatformApiClient | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PlatformApiClient | null>(null);
  const [rateLimit, setRateLimit] = useState("");
  const [rateError, setRateError] = useState("");
  const q = useQuery(queries.platformClients({ search, status, pageSize: 50 }));
  const update = useMutation({
    mutationFn: () => api.updatePlatformClient(selected!.id, Number(rateLimit)),
    onSuccess: async (client) => { toast.success(t("apc.updated")); await queryClient.invalidateQueries({ queryKey: ["platformClients"] }); setSelected(client); setRateError(""); },
    onError: () => setRateError(t("apc.updateError")),
  });
  const revoke = useMutation({
    mutationFn: (client: PlatformApiClient) => api.setPlatformClientStatus(client.id, "revoked"),
    onSuccess: async (_, client) => { toast.success(t("apc.revoked")); await queryClient.invalidateQueries({ queryKey: ["platformClients"] }); setSelected({ ...client, status: "revoked" }); setRevokeTarget(null); },
  });
  const columns: Column<PlatformApiClient>[] = [
    { id: "c", header: t("cred.clientId"), cell: (c) => <span className="font-mono text-xs font-medium">{c.clientId}</span> },
    { id: "t", header: t("nav.tenants"), cell: (c) => (<div><div>{c.tenantName}</div><div className="text-caption">{c.applicationName}</div></div>) },
    { id: "s", header: t("common.status"), cell: (c) => <StatusBadge status={c.status} /> },
    { id: "r", header: t("apc.rateLimit"), cell: (c) => <span className="tabular-nums">{formatNumber(c.rateLimit, locale)}</span> },
    { id: "u", header: t("common.lastUsed"), className: "hidden md:table-cell", cell: (c) => <span className="tabular-nums text-muted-foreground">{c.lastUsedAt ? formatDateTime(c.lastUsedAt, locale) : t("common.never")}</span> },
  ];
  return (
    <>
      <PageHeader title={t("apc.title")} description={t("apc.subtitle")} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("apc.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={setStatus}
              options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "revoked", "expired"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(c) => c.id} onRowClick={(client) => { setSelected(client); setRateLimit(String(client.rateLimit)); setRateError(""); }} />
        </Section>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{selected.clientId}</SheetTitle><SheetDescription>{selected.id}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-label">{t("nav.tenants")}</dt><dd>{selected.tenantName}</dd></div><div><dt className="text-label">{t("common.application")}</dt><dd>{selected.applicationName}</dd></div><div><dt className="text-label">{t("common.status")}</dt><dd><StatusBadge status={selected.status} /></dd></div><div><dt className="text-label">{t("common.lastUsed")}</dt><dd>{selected.lastUsedAt ? formatDateTime(selected.lastUsedAt, locale) : t("common.never")}</dd></div></dl>{can("platform.apiClients.manage") && selected.status === "active" && <><form className="space-y-2 border-t pt-4" onSubmit={(event) => { event.preventDefault(); if (!Number.isInteger(Number(rateLimit)) || Number(rateLimit) < 1) { setRateError(t("apc.invalidRate")); return; } update.mutate(); }}><Label htmlFor="api-client-rate">{t("apc.rateLimit")}</Label><Input id="api-client-rate" type="number" min="1" step="1" value={rateLimit} onChange={(event) => setRateLimit(event.target.value)} aria-invalid={!!rateError} />{rateError && <p className="text-xs text-danger">{rateError}</p>}<Button type="submit" variant="outline" disabled={update.isPending}>{update.isPending ? t("common.saving") : t("common.save")}</Button></form><Button variant="destructive" onClick={() => setRevokeTarget(selected)}>{t("cred.revoke")}</Button></>}</div></>}</SheetContent></Sheet>
      <AlertDialog open={!!revokeTarget} onOpenChange={(value) => !value && setRevokeTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("apc.revokeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("apc.revokeBody", { clientId: revokeTarget?.clientId ?? "", tenant: revokeTarget?.tenantName ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (revokeTarget) revoke.mutate(revokeTarget); }} disabled={revoke.isPending}>{t("cred.revoke")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
