import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { PlatformApiClient, PlatformApiClientSortField } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import type { SenderIdentityActor } from "@/lib/api/types";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/api-clients")({
  head: () => pageHead("API Clients", "Machine identities across tenants."),
  component: () => <RequirePermission permission="platform.apiClients"><ApiClients /></RequirePermission>,
});

function ApiClients() {
  const { t, locale, dir } = useI18n();
  const { can, user } = useSession();
  const { tenantId: selectedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PlatformApiClient["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<PlatformApiClientSortField>("clientId");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<PlatformApiClient | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PlatformApiClient | null>(null);
  const [rateLimit, setRateLimit] = useState("");
  const [rateError, setRateError] = useState("");
  const listQuery = { page, pageSize, search, filters: { status, ...(selectedTenantId ? { tenantId: selectedTenantId } : {}) }, sortBy, sortDirection };
  const q = useQuery(queries.platformClients(listQuery, actor));
  useEffect(() => { setPage(1); setSelected(null); }, [selectedTenantId]);
  const toggleSort = (field: PlatformApiClientSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "clientId" || field === "tenantName" ? "asc" : "desc");
    setSortBy(field);
    setPage(1);
  };
  const update = useMutation({
    mutationFn: () => api.updatePlatformClient(actor, selected!.id, Number(rateLimit)),
    onSuccess: async (client) => { toast.success(t("apc.updated")); await queryClient.invalidateQueries({ queryKey: ["platformClients"] }); setSelected(client); setRateError(""); },
    onError: () => setRateError(t("apc.updateError")),
  });
  const revoke = useMutation({
    mutationFn: (client: PlatformApiClient) => api.setPlatformClientStatus(actor, client.id, "revoked"),
    onSuccess: async (_, client) => { toast.success(t("apc.revoked")); await queryClient.invalidateQueries({ queryKey: ["platformClients"] }); setSelected({ ...client, status: "revoked" }); setRevokeTarget(null); },
  });
  const columns: Column<PlatformApiClient>[] = [
    { id: "c", header: <SortableHeader label={t("cred.clientId")} field="clientId" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("clientId")} />, cell: (c) => <span className="font-mono text-xs font-medium">{c.clientId}</span> },
    { id: "t", header: <SortableHeader label={t(selectedTenantId ? "common.application" : "nav.tenants")} field={selectedTenantId ? "clientId" : "tenantName"} sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort(selectedTenantId ? "clientId" : "tenantName")} />, cell: (c) => (<div>{!selectedTenantId && <div>{c.tenantName}</div>}<div className="text-caption">{c.applicationName}</div></div>) },
    { id: "s", header: <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} />, cell: (c) => <StatusBadge status={c.status} /> },
    { id: "r", header: t("apc.rateLimit"), cell: (c) => <span className="tabular-nums">{formatNumber(c.rateLimit, locale)}</span> },
    { id: "u", header: <SortableHeader label={t("common.lastUsed")} field="lastUsedAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("lastUsedAt")} />, className: "hidden md:table-cell", cell: (c) => <span className="tabular-nums text-muted-foreground">{c.lastUsedAt ? formatDateTime(c.lastUsedAt, locale) : t("common.never")}</span> },
  ];
  return (
    <>
      <PageHeader title={t("apc.title")} description={t("apc.subtitle")} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("apc.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as PlatformApiClient["status"] | "all"); setPage(1); }}
              options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "revoked", "expired"] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.isPlaceholderData ? undefined : q.data?.items} loading={q.isFetching} rowKey={(c) => c.id} onRowClick={(client) => { setSelected(client); setRateLimit(String(client.rateLimit)); setRateError(""); }} />
          {q.data && !q.isPlaceholderData && <ListPagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">{selected && <><SheetHeader><SheetTitle>{selected.clientId}</SheetTitle><SheetDescription>{selected.id}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><dl className="grid grid-cols-2 gap-4 text-sm">{!selectedTenantId && <div><dt className="text-label">{t("nav.tenants")}</dt><dd>{selected.tenantName}</dd></div>}<div><dt className="text-label">{t("common.application")}</dt><dd>{selected.applicationName}</dd></div><div><dt className="text-label">{t("common.status")}</dt><dd><StatusBadge status={selected.status} /></dd></div><div><dt className="text-label">{t("common.lastUsed")}</dt><dd>{selected.lastUsedAt ? formatDateTime(selected.lastUsedAt, locale) : t("common.never")}</dd></div></dl>{can("platform.apiClients.manage") && selected.status === "active" && <><form className="space-y-2 border-t pt-4" onSubmit={(event) => { event.preventDefault(); if (!Number.isInteger(Number(rateLimit)) || Number(rateLimit) < 1) { setRateError(t("apc.invalidRate")); return; } update.mutate(); }}><Label htmlFor="api-client-rate">{t("apc.rateLimit")}</Label><Input id="api-client-rate" type="number" min="1" step="1" value={rateLimit} onChange={(event) => setRateLimit(event.target.value)} aria-invalid={!!rateError} />{rateError && <p className="text-xs text-danger">{rateError}</p>}<Button type="submit" variant="outline" disabled={update.isPending}>{update.isPending ? t("common.saving") : t("common.save")}</Button></form><Button variant="destructive" onClick={() => setRevokeTarget(selected)}>{t("cred.revoke")}</Button></>}</div></>}</SheetContent></Sheet>
      <AlertDialog open={!!revokeTarget} onOpenChange={(value) => !value && setRevokeTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("apc.revokeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("apc.revokeBody", { clientId: revokeTarget?.clientId ?? "", tenant: revokeTarget?.tenantName ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (revokeTarget) revoke.mutate(revokeTarget); }} disabled={revoke.isPending}>{t("cred.revoke")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
