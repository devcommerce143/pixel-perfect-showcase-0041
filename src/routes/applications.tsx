import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Application, ApplicationSortField, Channel, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/applications")({
  head: () => pageHead("Applications", "Systems integrated with Dolf Connect through secured APIs, with enabled channels and credentials."),
  component: () => <RequirePermission permission="apps.view"><Applications /></RequirePermission>,
});

function Applications() {
  const { t, locale, dir } = useI18n();
  const { can, user, isPlatform } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const queryClient = useQueryClient();
  const tenantsQuery = useQuery({ ...queries.tenants({ pageSize: 100, filters: { status: "active" } }), enabled: isPlatform });
  const tenantNames = new Map((tenantsQuery.data?.items ?? []).map((tenant) => [tenant.id, tenant.name]));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Application["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<ApplicationSortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const applicationsQuery = useQuery(queries.applicationsPage(actor, { page, pageSize, search, filters: { status, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) }, sortBy, sortDirection }));
  const data = applicationsQuery.data?.items ?? [];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<Application | null>(null);
  const [statusTarget, setStatusTarget] = useState<Application | null>(null);
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [environment, setEnvironment] = useState<Application["environment"]>("production");
  const [channels, setChannels] = useState<Channel[]>(["sms"]);
  const [scopes, setScopes] = useState<string[]>(["messages:send"]);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [impactConfirm, setImpactConfirm] = useState(false);
  const save = useMutation({
    mutationFn: () => editingId ? api.updateApplication(actor, editingId, { name: name.trim(), environment, channels, scopes }) : api.createApplication(actor, { tenantId: isPlatform ? selectedTenantId ?? tenantId : actor.tenantId ?? "", name: name.trim(), environment, channels, scopes }),
    onSuccess: async (application) => {
      toast.success(t(editingId ? "apps.updated" : "apps.created"));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["applications"] }), queryClient.invalidateQueries({ queryKey: ["applicationsPage"] })]);
      setOpen(false);
      setName("");
      setError("");
      setEditingOriginal(null);
      setSelected(application);
    },
    onError: () => setError(t("apps.nameExists")),
  });
  const changeStatus = useMutation({
    mutationFn: (application: Application) => api.setApplicationStatus(actor, application.id, application.status === "active" ? "disabled" : "active"),
    onSuccess: async (_, application) => { const status = application.status === "active" ? "disabled" : "active"; toast.success(t(status === "disabled" ? "apps.deactivated" : "apps.activated")); await Promise.all([queryClient.invalidateQueries({ queryKey: ["applications"] }), queryClient.invalidateQueries({ queryKey: ["applicationsPage"] })]); setSelected({ ...application, status }); setStatusTarget(null); },
  });
  const toggleSort = (field: ApplicationSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "lastActivityAt" || field === "updatedAt" ? "desc" : "asc");
    setSortBy(field);
    setPage(1);
  };
  useEffect(() => { setPage(1); setSelected(null); setTenantId(selectedTenantId ?? ""); }, [selectedTenantId]);
  const valid = name.trim().length > 1 && channels.length > 0 && scopes.length > 0 && (isPlatform ? !!(selectedTenantId || tenantId) : !!actor.tenantId);
  const channelOptions: Channel[] = ["sms", "whatsapp", "email"];
  const scopeOptions = ["messages:send", "messages:read", "templates:read", "webhooks:manage"];
  const toggle = <T extends string,>(items: T[], item: T, checked: boolean): T[] => checked ? [...items, item] : items.filter((value) => value !== item);
  const openCreate = () => { setEditingId(null); setEditingOriginal(null); setName(""); setTenantId(isPlatform ? selectedTenantId ?? "" : actor.tenantId ?? ""); setEnvironment("production"); setChannels(["sms"]); setScopes(["messages:send"]); setTouched(false); setError(""); setOpen(true); };
  const openEdit = (application: Application) => { setSelected(null); setEditingId(application.id); setEditingOriginal(application); setTenantId(application.tenantId); setName(application.name); setEnvironment(application.environment); setChannels([...application.channels]); setScopes([...application.scopes]); setTouched(false); setError(""); setOpen(true); };
  const submitApplication = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    const removedChannels = editingOriginal?.channels.filter((channel) => !channels.includes(channel)) ?? [];
    const removedScopes = editingOriginal?.scopes.filter((scope) => !scopes.includes(scope)) ?? [];
    if (editingId && editingOriginal?.status === "active" && editingOriginal.environment === "production" && environment === "production" && (removedChannels.length > 0 || removedScopes.length > 0)) {
      setImpactConfirm(true);
      return;
    }
    save.mutate();
  };
  const columns: Column<Application>[] = [
    { id: "name", header: <SortableHeader label={t("common.name")} field="name" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("name")} />, cell: (a) => (<div><div className="font-medium">{a.name}</div><div className="font-mono text-xs text-muted-foreground">{a.id}</div></div>) },
    ...(isPlatform && !selectedTenantId ? [{ id: "tenant", header: t("common.tenant"), cell: (a: Application) => tenantNames.get(a.tenantId) ?? a.tenantId, className: "hidden lg:table-cell" }] : []),
    { id: "env", header: t("common.environment"), cell: (a) => (
      <span className={cn("rounded-sm border px-1.5 py-0.5 text-xs font-medium", a.environment === "production" ? "border-primary/30 text-primary" : "text-muted-foreground")}>
        {t(a.environment === "production" ? "common.production" : "common.sandbox")}
      </span>) },
    { id: "channels", header: t("apps.channels"), cell: (a) => <div className="flex flex-wrap gap-3">{a.channels.map((c) => <ChannelLabel key={c} channel={c} />)}</div>, className: "hidden lg:table-cell" },
    { id: "creds", header: t("apps.apiCredentials"), cell: (a) => <span className="tabular-nums">{a.credentialCount}</span> },
    { id: "status", header: <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} />, cell: (a) => <StatusBadge status={a.status} /> },
    { id: "last", header: <SortableHeader label={t("apps.lastActivity")} field="lastActivityAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("lastActivityAt")} />, cell: (a) => <span className="text-muted-foreground tabular-nums">{formatDateTime(a.lastActivityAt, locale)}</span> },
  ];
  return (
    <>
      <PageHeader title={t("apps.title")} description={t("apps.subtitle")}
        actions={can("apps.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("apps.new")}</Button>} />
      <PageBody><Section>
        <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("common.search")}>
          <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as Application["status"] | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "disabled"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} />
        </TableToolbar>
        <DataTable columns={columns} rows={applicationsQuery.data?.items} loading={applicationsQuery.isFetching} rowKey={(a) => a.id} onRowClick={setSelected} />
        {applicationsQuery.data && <ListPagination page={applicationsQuery.data.page} pageSize={applicationsQuery.data.pageSize} total={applicationsQuery.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      </Section></PageBody>
        <Sheet open={open} onOpenChange={(value) => !save.isPending && setOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{t(editingId ? "apps.edit" : "apps.new")}</SheetTitle><SheetDescription>{t("apps.createDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-5 px-4 pb-6" onSubmit={submitApplication} noValidate>
            {isPlatform && !selectedTenantId && <div className="space-y-1.5"><Label>{t("common.tenant")} *</Label><Select value={tenantId} onValueChange={setTenantId} disabled={!!editingId}><SelectTrigger aria-invalid={touched && !tenantId}><SelectValue placeholder={t("ten.selectTenant")} /></SelectTrigger><SelectContent>{(tenantsQuery.data?.items ?? []).map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.id}</SelectItem>)}</SelectContent></Select>{editingId && <p className="text-caption">{t("apps.tenantImmutable")}</p>}</div>}
            <div className="space-y-1.5"><Label htmlFor="application-name">{t("common.name")} *</Label><Input id="application-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={touched && name.trim().length <= 1} />{touched && name.trim().length <= 1 && <p className="text-xs text-danger">{t("apps.nameRequired")}</p>}</div>
            <div className="space-y-1.5"><Label>{t("common.environment")}</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as Application["environment"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="production">{t("common.production")}</SelectItem><SelectItem value="sandbox">{t("common.sandbox")}</SelectItem></SelectContent></Select></div>
            <section className="space-y-2"><h3 className="text-sm font-semibold">{t("apps.channels")}</h3><div className="grid gap-3 sm:grid-cols-3">{channelOptions.map((channel) => <label key={channel} className="flex items-center gap-2 text-sm"><Checkbox checked={channels.includes(channel)} onCheckedChange={(checked) => setChannels((current) => toggle(current, channel, checked === true))} />{t(`channel.${channel}`)}</label>)}</div>{touched && !channels.length && <p className="text-xs text-danger">{t("apps.selectChannel")}</p>}</section>
            <section className="space-y-2"><h3 className="text-sm font-semibold">{t("common.scopes")}</h3><div className="grid gap-3 sm:grid-cols-2">{scopeOptions.map((scope) => <label key={scope} className="flex items-center gap-2 font-mono text-xs"><Checkbox checked={scopes.includes(scope)} onCheckedChange={(checked) => setScopes((current) => toggle(current, scope, checked === true))} />{scope}</label>)}</div>{touched && !scopes.length && <p className="text-xs text-danger">{t("apps.selectScope")}</p>}</section>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "common.create")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={!!selected} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">
          {selected && <><SheetHeader><SheetTitle>{selected.name}</SheetTitle><SheetDescription>{selected.id} · {t(selected.environment === "production" ? "common.production" : "common.sandbox")}</SheetDescription></SheetHeader><div className="space-y-4 px-4"><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("common.tenant")}</dt><dd>{tenantNames.get(selected.tenantId) ?? user?.tenantName ?? selected.tenantId}</dd></div><div><dt className="text-label">{t("common.applicationId")}</dt><dd className="font-mono text-xs">{selected.id}</dd></div><div><dt className="text-label">{t("common.environment")}</dt><dd>{t(selected.environment === "production" ? "common.production" : "common.sandbox")}</dd></div><div><dt className="text-label">{t("common.status")}</dt><dd><StatusBadge status={selected.status} /></dd></div><div><dt className="text-label">{t("apps.apiCredentials")}</dt><dd><Link className="text-primary hover:underline" to={`/credentials?applicationId=${selected.id}` as never}>{selected.credentialCount}</Link></dd></div><div><dt className="text-label">{t("apps.createdAt")}</dt><dd>{formatDateTime(selected.createdAt, locale)}</dd></div>{selected.createdBy && <div><dt className="text-label">{t("apps.createdBy")}</dt><dd>{selected.createdBy}</dd></div>}{selected.updatedAt && <div><dt className="text-label">{t("common.updatedAt")}</dt><dd>{formatDateTime(selected.updatedAt, locale)}</dd></div>}<div><dt className="text-label">{t("apps.lastActivity")}</dt><dd>{formatDateTime(selected.lastActivityAt, locale)}</dd></div></dl><div><h3 className="mb-2 text-sm font-semibold">{t("apps.channels")}</h3><div className="flex flex-wrap gap-3">{selected.channels.map((channel) => <ChannelLabel key={channel} channel={channel} />)}</div></div><div><h3 className="mb-2 text-sm font-semibold">{t("common.scopes")}</h3><div className="flex flex-wrap gap-1">{selected.scopes.map((scope) => <span key={scope} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">{scope}</span>)}</div></div>{can("apps.manage") && <div className="flex gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button><Button variant={selected.status === "active" ? "destructive" : "outline"} onClick={() => setStatusTarget(selected)}>{t(selected.status === "active" ? "apps.deactivate" : "apps.activate")}</Button></div>}</div></>}
        </SheetContent>
      </Sheet>
      <AlertDialog open={impactConfirm} onOpenChange={setImpactConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("apps.accessChangeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("apps.accessChangeBody", { name: selected?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={save.isPending} onClick={(event) => { event.preventDefault(); setImpactConfirm(false); save.mutate(); }}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!statusTarget} onOpenChange={(value) => !value && setStatusTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(statusTarget?.status === "active" ? "apps.deactivateTitle" : "apps.activateTitle")}</AlertDialogTitle><AlertDialogDescription>{t(statusTarget?.status === "active" ? "apps.deactivateBody" : "apps.activateBody", { name: statusTarget?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (statusTarget) changeStatus.mutate(statusTarget); }} disabled={changeStatus.isPending}>{t(statusTarget?.status === "active" ? "apps.deactivate" : "apps.activate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
