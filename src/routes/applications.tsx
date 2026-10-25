import { MessageAlert } from "@/components/app/MessageAlert";
import { EntityName } from "@/components/app/EntityName";
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
import { EmptyState, ErrorState } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { TenantOptionsStatus } from "@/components/app/TenantOptionsStatus";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, apiMode } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import {
  applicationDetailTenantId,
  applicationMutationControlsEnabled,
  applicationScopeKey,
  applicationSelectionMatchesScope,
} from "@/lib/api/application-ui-policy";
import { eligibleTenantOptions, isActiveTenant } from "@/lib/api/tenant-options";
import type { Application, ApplicationSortField, Channel, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  LiveApplicationActions,
  ApplicationCredentialsLink,
} from "@/components/app/LiveApplicationActions";

export const Route = createFileRoute("/applications")({
  head: () => pageHead("Applications", "Systems integrated with Dolf Connect through secured APIs, with enabled channels and credentials."),
  component: ApplicationsRoute,
});

function ApplicationsRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="apps.view">
      <Applications key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`} />
    </RequirePermission>
  );
}

function Applications() {
  const { t, locale, dir } = useI18n();
  const { can, user, isPlatform } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const isLive = apiMode === "live";
  const canManageApplications = applicationMutationControlsEnabled(apiMode) && can("apps.manage");
  const platformAllTenants = isPlatform && !selectedTenantId;
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const queryClient = useQueryClient();
  const tenantsQuery = useQuery({ ...queries.tenantOptions(), enabled: isPlatform });
  const tenants = tenantsQuery.isSuccess ? eligibleTenantOptions(tenantsQuery.data) : [];
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const currentApplicationScopeKey = applicationScopeKey(actor, selectedTenantId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Application["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<ApplicationSortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const applicationsQuery = useQuery(queries.applicationsPage(
    actor,
    isLive
        ? { page, pageSize, search, filters: { status }, sortBy, sortDirection }
      : { page, pageSize, search, filters: { status, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) }, sortBy, sortDirection },
    selectedTenantId ?? undefined,
    !isLive || !platformAllTenants,
    isLive,
  ));
  const allTenantApplicationsQuery = useQuery(queries.allTenantApplicationsPage(
    actor,
      { page, pageSize, search, filters: { status }, sortBy, sortDirection },
    isLive && platformAllTenants,
  ));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);
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
  const selectedMatchesTenant = !!selected && applicationSelectionMatchesScope(
    selected.tenantId,
    selectedScopeKey,
    currentApplicationScopeKey,
    isPlatform,
  );
  const detailTenantId = applicationDetailTenantId(
    isPlatform,
    selectedTenantId,
    selected?.tenantId,
  );
  const applicationDetailQuery = useQuery(queries.application(
    actor,
    selectedMatchesTenant ? selected.id : "",
    detailTenantId,
    isLive && selectedMatchesTenant,
  ));
  const displayedApplication = isLive
    ? applicationDetailQuery.data && selected
      ? {
          ...applicationDetailQuery.data,
          ...(selected.tenantName ? { tenantName: selected.tenantName } : {}),
        }
      : applicationDetailQuery.data
    : selected;
  const activeApplicationsQuery = isLive && platformAllTenants
    ? allTenantApplicationsQuery
    : applicationsQuery;
  const effectiveTenantId = selectedTenantId ?? tenantId;
  const activeTenantSelected = isActiveTenant(
    effectiveTenantId,
    tenantsQuery.data,
    tenantsQuery.isSuccess && !tenantsQuery.isFetching,
  );
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
      setSelectedScopeKey(currentApplicationScopeKey);
    },
    onError: () => setError(t("apps.nameExists")),
  });
  const changeStatus = useMutation({
    mutationFn: (application: Application) => api.setApplicationStatus(actor, application.id, application.status === "active" ? "disabled" : "active"),
    onSuccess: async (_, application) => { const status = application.status === "active" ? "disabled" : "active"; toast.success(t(status === "disabled" ? "apps.deactivated" : "apps.activated")); await Promise.all([queryClient.invalidateQueries({ queryKey: ["applications"] }), queryClient.invalidateQueries({ queryKey: ["applicationsPage"] })]); setSelected({ ...application, status }); setSelectedScopeKey(currentApplicationScopeKey); setStatusTarget(null); },
  });
  const toggleSort = (field: ApplicationSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "lastActivityAt" || field === "updatedAt" ? "desc" : "asc");
    setSortBy(field);
    setPage(1);
  };
  useEffect(() => {
    setPage(1);
    setSelected(null);
    setSelectedScopeKey(null);
    setTenantId(selectedTenantId ?? "");
  }, [currentApplicationScopeKey, selectedTenantId]);
  const valid = name.trim().length > 1 && channels.length > 0 && scopes.length > 0 && (isPlatform ? (editingId ? !!tenantId : activeTenantSelected) : !!actor.tenantId);
  const showActiveTenantRequired = isPlatform && !editingId && !!effectiveTenantId &&
    tenantsQuery.isSuccess && !tenantsQuery.isFetching && !activeTenantSelected;
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
    {
      id: "name",
      header: (
        <SortableHeader
          label={t("common.name")}
          field="name"
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={() => toggleSort("name")}
        />
      ),
      cell: (a) => (
        <div>
          <div className="font-medium">{a.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{a.environment}</div>
        </div>
      ),
    },
    ...(isPlatform && platformAllTenants
      ? [
          {
            id: "tenant",
            header: t("common.tenant"),
            cell: (a: Application) => (
              <div>
                <div>
                  <EntityName
                    kind="tenant"
                    id={a.tenantId}
                    name={a.tenantName ?? tenantNames.get(a.tenantId)}
                  />
                </div>
              </div>
            ),
            className: "hidden lg:table-cell",
          },
        ]
      : []),
    { id: "env", header: t("common.environment"), cell: (a) => (
      <span className={cn("rounded-sm border px-1.5 py-0.5 text-xs font-medium", a.environment === "production" ? "border-primary/30 text-primary" : "text-muted-foreground")}>
        {t(a.environment === "production" ? "common.production" : "common.sandbox")}
      </span>) },
    { id: "channels", header: t("apps.channels"), cell: (a) => <div className="flex flex-wrap gap-3">{a.channels.map((c) => <ChannelLabel key={c} channel={c} />)}</div>, className: "hidden lg:table-cell" },
    ...(!isLive
      ? [
          {
            id: "creds",
            header: t("apps.apiCredentials"),
            cell: (a: Application) => (
              <span className="tabular-nums">
                {typeof a.credentialCount === "number" ? a.credentialCount : t("apps.notAvailable")}
              </span>
            ),
          },
        ]
      : []),
    {
      id: "status",
      header: (
        <SortableHeader
          label={t("common.status")}
          field="status"
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={() => toggleSort("status")}
        />
      ),
      cell: (a) => <StatusBadge status={a.status} />,
    },
    ...(isLive
      ? [
          {
            id: "created",
            header: (
              <SortableHeader
                label={t("apps.createdAt")}
                field="createdAt"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={() => toggleSort("createdAt")}
              />
            ),
            cell: (a: Application) => (
              <span className="tabular-nums">{formatDateTime(a.createdAt, locale)}</span>
            ),
          },
        ]
      : [
          {
            id: "last",
            header: (
              <SortableHeader
                label={t("apps.lastActivity")}
                field="lastActivityAt"
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={() => toggleSort("lastActivityAt")}
              />
            ),
            cell: (a: Application) => (
              <span className="text-muted-foreground tabular-nums">
                {a.lastActivityAt
                  ? formatDateTime(a.lastActivityAt, locale)
                  : t("apps.notAvailable")}
              </span>
            ),
          },
        ]),
  ];
  return (
    <>
      <PageHeader title={t("apps.title")} description={t("apps.subtitle")}
        actions={
          isLive ? (
            <LiveApplicationActions
              tenantId={selectedTenantId}
              onSaved={(application) => {
                setSelected(application);
                setSelectedScopeKey(currentApplicationScopeKey);
              }}
            />
          ) : (
            canManageApplications && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" />
                {t("apps.new")}
              </Button>
            )
          )
        }
      />
      <PageBody><Section>
        {isLive && platformAllTenants && <div role="status" className="border-b px-4 py-3 text-caption">{t("apps.allTenantApplicationsNote")}</div>}
        {platformAllTenants && !isLive ? (
          <EmptyState title={t("ten.selectTenant")} body={t("apps.selectTenantForApplications")} />
        ) : (
          <>
              {
                <TableToolbar
                  search={search}
                  onSearch={(value) => {
                    setSearch(value.slice(0, 120));
                    setPage(1);
                  }}
                  placeholder={t("common.search")}
                >
                  <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as Application["status"] | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "disabled"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} />
                </TableToolbar>}
            {activeApplicationsQuery.isError
              ? <ErrorState error={activeApplicationsQuery.error} onRetry={() => void activeApplicationsQuery.refetch()} />
              : <DataTable columns={columns} rows={activeApplicationsQuery.data?.items} loading={activeApplicationsQuery.isFetching} rowKey={(a) => a.id} onRowClick={(application) => { setSelected(application); setSelectedScopeKey(currentApplicationScopeKey); }} />}
            {activeApplicationsQuery.data && !activeApplicationsQuery.isError && <ListPagination page={activeApplicationsQuery.data.page} pageSize={activeApplicationsQuery.data.pageSize} total={activeApplicationsQuery.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
          </>
        )}
      </Section></PageBody>
        {!isLive && <Sheet open={open} onOpenChange={(value) => !save.isPending && setOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{t(editingId ? "apps.edit" : "apps.new")}</SheetTitle><SheetDescription>{t("apps.createDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-5 px-4 pb-6" onSubmit={submitApplication} noValidate>
              {isPlatform && !selectedTenantId && (
                <div className="space-y-1.5">
                  <Label>{t("common.tenant")} *</Label>
                  <TenantOptionsStatus query={tenantsQuery} />
                  <Select
                    value={tenantId}
                    onValueChange={setTenantId}
                    disabled={!!editingId || !tenantsQuery.isSuccess || tenantsQuery.isFetching}
                  >
                    <SelectTrigger aria-invalid={touched && !tenantId}>
                      <SelectValue placeholder={t("ten.selectTenant")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showActiveTenantRequired && (
                    <p role="alert" className="text-xs text-danger">
                      {t("ten.activeRequired")}
                    </p>
                  )}
                  {editingId && <p className="text-caption">{t("apps.tenantImmutable")}</p>}
                </div>
              )}
            {isPlatform && selectedTenantId && <div className="space-y-1.5"><TenantOptionsStatus query={tenantsQuery} />{showActiveTenantRequired && <p role="alert" className="text-xs text-danger">{t("ten.activeRequired")}</p>}</div>}
            <div className="space-y-1.5"><Label htmlFor="application-name">{t("common.name")} *</Label><Input id="application-name" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={touched && name.trim().length <= 1} />{touched && name.trim().length <= 1 && <p className="text-xs text-danger">{t("apps.nameRequired")}</p>}</div>
            <div className="space-y-1.5"><Label>{t("common.environment")}</Label><Select value={environment} onValueChange={(value) => setEnvironment(value as Application["environment"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="production">{t("common.production")}</SelectItem><SelectItem value="sandbox">{t("common.sandbox")}</SelectItem></SelectContent></Select></div>
            <section className="space-y-2"><h3 className="text-sm font-semibold">{t("apps.channels")}</h3><div className="grid gap-3 sm:grid-cols-3">{channelOptions.map((channel) => <label key={channel} className="flex items-center gap-2 text-sm"><Checkbox checked={channels.includes(channel)} onCheckedChange={(checked) => setChannels((current) => toggle(current, channel, checked === true))} />{t(`channel.${channel}`)}</label>)}</div>{touched && !channels.length && <p className="text-xs text-danger">{t("apps.selectChannel")}</p>}</section>
            <section className="space-y-2"><h3 className="text-sm font-semibold">{t("common.scopes")}</h3><div className="grid gap-3 sm:grid-cols-2">{scopeOptions.map((scope) => <label key={scope} className="flex items-center gap-2 font-mono text-xs"><Checkbox checked={scopes.includes(scope)} onCheckedChange={(checked) => setScopes((current) => toggle(current, scope, checked === true))} />{scope}</label>)}</div>{touched && !scopes.length && <p className="text-xs text-danger">{t("apps.selectScope")}</p>}</section>
            {error && <MessageAlert className="text-sm text-danger">{error}</MessageAlert>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "common.create")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>}
      <Sheet open={selectedMatchesTenant} onOpenChange={(value) => {
        if (!value) {
          setSelected(null);
          setSelectedScopeKey(null);
        }
      }}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">
          {isLive && applicationDetailQuery.isError ? (
            <ErrorState
              error={applicationDetailQuery.error}
              onRetry={() => void applicationDetailQuery.refetch()}
            />
          ) : isLive && applicationDetailQuery.isLoading ? (
            <p role="status" className="p-4 text-caption">
              {t("apps.detailLoading")}
            </p>
          ) : isLive && applicationDetailQuery.data === null ? (
            <EmptyState title={t("apps.notFound")} />
          ) : (
            displayedApplication && (
              <>
                <SheetHeader>
                  <SheetTitle>{displayedApplication.name}</SheetTitle>
                  <SheetDescription>
                    {displayedApplication.name} ·{" "}
                    {t(
                      displayedApplication.environment === "production"
                        ? "common.production"
                        : "common.sandbox",
                    )}
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-label">{t("common.tenant")}</dt>
                      <dd>
                        {displayedApplication.tenantName ??
                          tenantNames.get(displayedApplication.tenantId) ??
                          t("entity.unavailable")}
                      </dd>
                      <dd className="font-mono text-xs text-muted-foreground">
                        <EntityName kind="tenant" id={displayedApplication.tenantId} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label">{t("common.application")}</dt>
                      <dd className="font-mono text-xs">{displayedApplication.name}</dd>
                    </div>
                    <div>
                      <dt className="text-label">{t("common.environment")}</dt>
                      <dd>
                        {t(
                          displayedApplication.environment === "production"
                            ? "common.production"
                            : "common.sandbox",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-label">{t("common.status")}</dt>
                      <dd>
                        <StatusBadge status={displayedApplication.status} />
                      </dd>
                    </div>
                    {!isLive && (
                      <div>
                        <dt className="text-label">{t("apps.apiCredentials")}</dt>
                        <dd>
                          {typeof displayedApplication.credentialCount === "number" ? (
                            <Link
                              className="text-primary hover:underline"
                              to={`/credentials?applicationId=${displayedApplication.id}` as never}
                            >
                              {displayedApplication.credentialCount}
                            </Link>
                          ) : (
                            t("apps.notAvailable")
                          )}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-label">{t("apps.createdAt")}</dt>
                      <dd>{formatDateTime(displayedApplication.createdAt, locale)}</dd>
                    </div>
                    {displayedApplication.createdBy && (
                      <div>
                        <dt className="text-label">{t("apps.createdBy")}</dt>
                        <dd>{displayedApplication.createdBy}</dd>
                      </div>
                    )}
                    {displayedApplication.updatedAt && (
                      <div>
                        <dt className="text-label">{t("common.updatedAt")}</dt>
                        <dd>{formatDateTime(displayedApplication.updatedAt, locale)}</dd>
                      </div>
                    )}
                    {!isLive && (
                      <div>
                        <dt className="text-label">{t("apps.lastActivity")}</dt>
                        <dd>
                          {displayedApplication.lastActivityAt
                            ? formatDateTime(displayedApplication.lastActivityAt, locale)
                            : t("apps.notAvailable")}
                        </dd>
                      </div>
                    )}
                    {displayedApplication.senderAccess && (
                      <div>
                        <dt className="text-label">{t("apps.senderAccess")}</dt>
                        <dd>
                          {t(
                            displayedApplication.senderAccess === "all_eligible"
                              ? "apps.allEligibleSenders"
                              : "apps.allowListedSenders",
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t("apps.channels")}</h3>
                    <div className="flex flex-wrap gap-3">
                      {displayedApplication.channels.map((channel) => (
                        <ChannelLabel key={channel} channel={channel} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t("common.scopes")}</h3>
                    <div className="flex flex-wrap gap-1">
                      {displayedApplication.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                  {displayedApplication.channelAvailability && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        {t("apps.channelAvailability")}
                      </h3>
                      <dl className="space-y-2 text-sm">
                        {displayedApplication.channelAvailability.map((availability) => (
                          <div
                            key={availability.channel}
                            className="flex flex-wrap justify-between gap-2"
                          >
                            <dt>
                              <ChannelLabel channel={availability.channel} />
                            </dt>
                            <dd>
                              {t(
                                availability.granted
                                  ? "apps.channelGranted"
                                  : "apps.channelNotGranted",
                              )}{" "}
                              ·{" "}
                              {t(
                                availability.available
                                  ? "apps.channelAvailable"
                                  : "apps.channelUnavailable",
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {isLive && <ApplicationCredentialsLink application={displayedApplication} />}
                  {isLive && (
                    <LiveApplicationActions
                      key={`${user?.id}:${currentApplicationScopeKey}:${displayedApplication.id}`}
                      application={displayedApplication}
                      tenantId={detailTenantId}
                      onSaved={(saved) => {
                        setSelected({
                          ...saved,
                          ...(displayedApplication.tenantName
                            ? { tenantName: displayedApplication.tenantName }
                            : {}),
                        });
                        setSelectedScopeKey(currentApplicationScopeKey);
                      }}
                    />
                  )}
                  {canManageApplications && (
                    <div className="flex gap-2 border-t pt-4">
                      <Button variant="outline" onClick={() => openEdit(displayedApplication)}>
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant={
                          displayedApplication.status === "active" ? "destructive" : "outline"
                        }
                        onClick={() => setStatusTarget(displayedApplication)}
                      >
                        {t(
                          displayedApplication.status === "active"
                            ? "apps.deactivate"
                            : "apps.activate",
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </SheetContent>
      </Sheet>
      {!isLive && <AlertDialog open={impactConfirm} onOpenChange={setImpactConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("apps.accessChangeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("apps.accessChangeBody", { name: selected?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={save.isPending} onClick={(event) => { event.preventDefault(); setImpactConfirm(false); save.mutate(); }}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
      {!isLive && <AlertDialog open={!!statusTarget} onOpenChange={(value) => !value && setStatusTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t(statusTarget?.status === "active" ? "apps.deactivateTitle" : "apps.activateTitle")}</AlertDialogTitle><AlertDialogDescription>{t(statusTarget?.status === "active" ? "apps.deactivateBody" : "apps.activateBody", { name: statusTarget?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (statusTarget) changeStatus.mutate(statusTarget); }} disabled={changeStatus.isPending}>{t(statusTarget?.status === "active" ? "apps.deactivate" : "apps.activate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    </>
  );
}
