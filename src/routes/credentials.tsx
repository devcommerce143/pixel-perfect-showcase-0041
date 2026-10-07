import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { ApiCredential, ApiCredentialSortField, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/credentials")({
  head: () => pageHead("API Credentials", "Manage machine credentials used by applications to authenticate with the Dolf Connect API."),
  validateSearch: (search: Record<string, unknown>) => ({ applicationId: typeof search["applicationId"] === "string" ? search["applicationId"] : undefined }),
  component: () => <RequirePermission permission="credentials.view"><Credentials /></RequirePermission>,
});

function Credentials() {
  const { t, locale } = useI18n();
  const { can, user, isPlatform } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const { applicationId: filterApplicationId } = Route.useSearch();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApiCredential["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<ApiCredentialSortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const credentialsQuery = useQuery(queries.credentials(actor, { page, pageSize, search, filters: { ...(filterApplicationId ? { applicationId: filterApplicationId } : {}), ...(scopedTenantId ? { tenantId: scopedTenantId } : {}), status: statusFilter }, sortBy, sortDirection }));
  const apps = useQuery(queries.applications(actor, scopedTenantId));
  useEffect(() => { setPage(1); setApplicationId(filterApplicationId ?? ""); setScopes([]); setOpen(false); setTarget(null); setRotateTarget(null); }, [filterApplicationId, selectedTenantId]);
  const [target, setTarget] = useState<ApiCredential | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiCredential | null>(null);
  const [open, setOpen] = useState(false);
  const [applicationId, setApplicationId] = useState(filterApplicationId ?? "");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [secretResult, setSecretResult] = useState<{ credential: ApiCredential; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [secretAcknowledged, setSecretAcknowledged] = useState(false);
  const selectedApp = apps.data?.find((app) => app.id === applicationId);
  const generate = useMutation({
    mutationFn: () => api.createCredential(actor, { applicationId, scopes, environment: selectedApp?.environment ?? "production", expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, rateLimit: rateLimit ? Number(rateLimit) : null }),
    onSuccess: async (result) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["credentials"] }), qc.invalidateQueries({ queryKey: ["applications"] })]);
      toast.success(t("cred.created"));
      setOpen(false);
      setSecretResult(result);
      setCopied(false);
      setSecretAcknowledged(false);
    },
    onError: () => toast.error(t("cred.createError")),
  });
  const rotate = useMutation({
    mutationFn: (id: string) => api.rotateCredential(actor, id),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["credentials"] });
      toast.success(t("cred.rotated"));
      setRotateTarget(null);
      setSecretResult(result);
      setCopied(false);
      setSecretAcknowledged(false);
    },
    onError: () => toast.error(t("cred.createError")),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeCredential(actor, id),
    onSuccess: (_, id) => { toast.success(t("cred.revoked", { id })); void qc.invalidateQueries({ queryKey: ["credentials"] }); setTarget(null); },
  });
  const toggleSort = (field: ApiCredentialSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "clientId" || field === "applicationName" ? "asc" : "desc");
    setSortBy(field);
    setPage(1);
  };

  const columns: Column<ApiCredential>[] = [
    { id: "id", header: <SortableHeader label={t("cred.clientId")} field="clientId" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("clientId")} />, cell: (c) => (<div><div className="font-mono text-xs font-medium">{c.clientId}</div><div className="text-caption">{c.applicationName}</div></div>) },
    ...(isPlatform && !selectedTenantId ? [{ id: "tenant", header: t("common.tenant"), cell: (c: ApiCredential) => <span className="text-sm">{c.tenantName ?? c.tenantId}</span>, className: "hidden xl:table-cell" }] : []),
    { id: "application", header: <SortableHeader label={t("common.application")} field="applicationName" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("applicationName")} />, cell: (c) => <div><div>{c.applicationName}</div><div className="font-mono text-xs text-muted-foreground">{c.applicationId}</div></div>, className: "hidden lg:table-cell" },
    { id: "environment", header: t("common.environment"), cell: (c) => <span className="text-sm">{t(c.environment === "production" ? "common.production" : "common.sandbox")}</span> },
    { id: "status", header: <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} />, cell: (c) => <StatusBadge status={c.status} /> },
    { id: "rateLimit", header: t("cred.rateLimit"), cell: (c) => <span className="tabular-nums text-muted-foreground">{c.rateLimit ? `${formatNumber(c.rateLimit, locale)} ${t("cred.requestsPerSecond")}` : t("common.none")}</span>, className: "hidden md:table-cell" },
    { id: "expires", header: t("common.expires"), cell: (c) => <span className="tabular-nums text-muted-foreground">{c.expiresAt ? formatDate(c.expiresAt, locale) : t("common.never")}</span> },
    { id: "used", header: <SortableHeader label={t("common.lastUsed")} field="lastUsedAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("lastUsedAt")} />, cell: (c) => <span className="tabular-nums text-muted-foreground">{c.lastUsedAt ? formatDateTime(c.lastUsedAt, locale) : t("common.never")}</span>, className: "hidden lg:table-cell" },
    { id: "act", header: <span className="sr-only">{t("common.actions")}</span>, className: "text-end", cell: (c) =>
      can("credentials.manage") && c.status === "active" ? <div className="flex justify-end gap-1"><Button variant="outline" size="sm" className="h-7" onClick={() => setRotateTarget(c)}>{t("cred.rotate")}</Button><Button variant="ghost" size="sm" className="h-7 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setTarget(c)}>{t("cred.revoke")}</Button></div> : null },
  ];

  return (
    <>
      <PageHeader title={t("cred.title")} description={t("cred.subtitle")}
        actions={can("credentials.manage") && <Button size="sm" onClick={() => { setApplicationId(""); setScopes([]); setOpen(true); }}><Plus className="size-4" />{t("cred.new")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <KeyRound className="mt-0.5 size-4 shrink-0" />{t("cred.securityNote")}
        </div>
        <Section>
          <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("cred.search")}>
            <FilterSelect label={t("common.status")} value={statusFilter} onChange={(value) => { setStatusFilter(value as ApiCredential["status"] | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, { value: "active", label: t("status.active") }, { value: "expired", label: t("status.expired") }, { value: "revoked", label: t("status.revoked") }]} />
          </TableToolbar>
          <DataTable columns={columns} rows={credentialsQuery.data?.items} loading={credentialsQuery.isFetching} rowKey={(c) => c.id} />
          {credentialsQuery.data && <ListPagination page={credentialsQuery.data.page} pageSize={credentialsQuery.data.pageSize} total={credentialsQuery.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
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
      <Dialog open={open} onOpenChange={(value) => !generate.isPending && setOpen(value)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("cred.new")}</DialogTitle><DialogDescription>{t("cred.generateDescription")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>{t("common.application")}</Label><Select value={applicationId} onValueChange={(id) => { setApplicationId(id); setScopes(apps.data?.find((app) => app.id === id)?.scopes ?? []); setExpiresAt(""); setRateLimit(""); }}><SelectTrigger><SelectValue placeholder={t("cred.selectApplication")} /></SelectTrigger><SelectContent>{(apps.data ?? []).filter((app) => app.status === "active" && (!scopedTenantId || app.tenantId === scopedTenantId)).map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div>
            {selectedApp && <div className="space-y-2 rounded-md border bg-surface-subtle p-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">{t("common.environment")}</span><span>{t(selectedApp.environment === "production" ? "common.production" : "common.sandbox")}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">{t("common.tenant")}</span><span>{selectedApp.tenantName ?? selectedApp.tenantId}</span></div></div>}
            {selectedApp && <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="credential-expiry">{t("cred.expiresAt")}</Label><Input id="credential-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="credential-rate-limit">{t("cred.rateLimit")}</Label><Input id="credential-rate-limit" type="number" min="1" step="1" value={rateLimit} onChange={(event) => setRateLimit(event.target.value)} placeholder="60" /></div></div>}
            {selectedApp && <div className="space-y-2"><Label>{t("common.scopes")}</Label><div className="grid gap-2 sm:grid-cols-2">{selectedApp.scopes.map((scope) => <label key={scope} className="flex items-center gap-2 font-mono text-xs"><Checkbox checked={scopes.includes(scope)} onCheckedChange={(checked) => setScopes((current) => checked ? [...current, scope] : current.filter((value) => value !== scope))} />{scope}</label>)}</div>{!selectedApp.scopes.length && <p className="text-xs text-warning">{t("cred.noScopes")}</p>}</div>}
          </div>
          <DialogFooter><Button variant="outline" disabled={generate.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button disabled={!applicationId || !scopes.length || generate.isPending || !selectedApp} onClick={() => generate.mutate()}>{generate.isPending ? t("common.creating") : t("cred.generate")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!rotateTarget} onOpenChange={(value) => !value && setRotateTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("cred.rotateTitle")}</AlertDialogTitle><AlertDialogDescription>{t("cred.rotateBody", { id: rotateTarget?.clientId ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={rotate.isPending} onClick={(event) => { event.preventDefault(); if (rotateTarget) rotate.mutate(rotateTarget.id); }}>{t("cred.rotate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!secretResult} onOpenChange={(value) => { if (!value) { setSecretResult(null); setCopied(false); setSecretAcknowledged(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("cred.secretTitle")}</DialogTitle><DialogDescription>{t("cred.secretWarning")}</DialogDescription></DialogHeader>
          {secretResult && <div className="space-y-4"><div className="rounded-md border bg-surface-subtle p-3"><div className="mb-1 text-xs text-muted-foreground">{secretResult.credential.clientId}</div><code dir="ltr" className="block break-all text-xs">{secretResult.secret}</code></div><div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(secretResult.credential.clientId); toast.success(t("cred.copiedId")); } catch { toast.error(t("cred.copyFailed")); } }}>{t("cred.copyClientId")}</Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(secretResult.secret); setCopied(true); toast.success(t("cred.copied")); } catch { toast.error(t("cred.copyFailed")); } }}>{copied ? t("cred.copied") : t("cred.copy")}</Button>
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`${secretResult.credential.clientId}\n${secretResult.secret}`); toast.success(t("cred.copiedBoth")); } catch { toast.error(t("cred.copyFailed")); } }}>{t("cred.copyBoth")}</Button>
          </div><label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={secretAcknowledged} onCheckedChange={(checked) => setSecretAcknowledged(checked === true)} />{t("cred.confirmSecretWarning")}</label></div>}
          <DialogFooter><Button disabled={!secretAcknowledged} onClick={() => { setSecretResult(null); setCopied(false); setSecretAcknowledged(false); }}>{t("cred.done")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
