import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Info, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DataTable, ListPagination, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { TenantOptionsStatus } from "@/components/app/TenantOptionsStatus";
import { EmptyState, ErrorState } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import { eligibleTenantOptions, isActiveTenant } from "@/lib/api/tenant-options";
import { availableUserStatusTransitions, userMutationErrorMessage } from "@/lib/api/user-management";
import type { PortalUser, SenderIdentityActor, TenantUserRole, UserListQuery, UserSortField, UserStatus } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/users")({
  validateSearch: (search: Record<string, unknown>) => ({ tenantId: typeof search["tenantId"] === "string" ? search["tenantId"] : undefined }),
  head: () => pageHead("Users", "Manage users and role assignments."),
  component: () => <RequirePermission permission="users.view"><Users /></RequirePermission>,
});

function Users() {
  const { t, locale } = useI18n();
  const { can, user, mode: apiMode } = useSession();
  const { tenantId: requestedTenantId } = Route.useSearch();
  const isPlatform = user?.role === "super_admin";
  const selectedTenantId = isPlatform ? requestedTenantId : user?.tenantId ?? undefined;
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const qc = useQueryClient();
  const tenantsQuery = useQuery({ ...queries.tenantOptions(), enabled: isPlatform });
  const tenantOptions = tenantsQuery.isSuccess ? eligibleTenantOptions(tenantsQuery.data) : [];
  const tenantNames = new Map(tenantOptions.map((tenant) => [tenant.id, tenant.name]));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<PortalUser["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<UserSortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [inviteTenantId, setInviteTenantId] = useState(selectedTenantId ?? "");
  const activeTenantSelected = isActiveTenant(
    selectedTenantId ?? inviteTenantId,
    tenantsQuery.data,
    tenantsQuery.isSuccess && !tenantsQuery.isFetching,
  );
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const userListQuery: UserListQuery = {
    page,
    pageSize,
    search: debouncedSearch,
    filters: { status, ...(apiMode === "mock" && selectedTenantId ? { tenantId: selectedTenantId } : {}) },
    sortBy: selectedTenantId && sortBy === "tenantName" ? "name" : sortBy,
    sortDirection,
  };
  const targetTenantId = isPlatform ? selectedTenantId : undefined;
  const q = useQuery(queries.users(actor, userListQuery, targetTenantId));
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstNameArabic, setFirstNameArabic] = useState("");
  const [lastNameArabic, setLastNameArabic] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "ar">("en");
  const [role, setRole] = useState<TenantUserRole>("operator");
  const [selected, setSelected] = useState<PortalUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ user: PortalUser; status: UserStatus } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editFirstNameArabic, setEditFirstNameArabic] = useState("");
  const [editLastNameArabic, setEditLastNameArabic] = useState("");
  const [editMobileNumber, setEditMobileNumber] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPreferredLanguage, setEditPreferredLanguage] = useState<"en" | "ar">("en");
  const [editRole, setEditRole] = useState<TenantUserRole>("operator");
  const [editTouched, setEditTouched] = useState(false);
  const [editError, setEditError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [createTouched, setCreateTouched] = useState(false);
  const [createError, setCreateError] = useState("");
  useEffect(() => { setPage(1); setSelected(null); setInviteTenantId(selectedTenantId ?? ""); setSortBy("name"); }, [selectedTenantId, tenantsQuery.data]);

  if (selectedTenantId && !tenantNames.has(selectedTenantId)) {
    tenantNames.set(selectedTenantId, selectedTenantId);
  }
  const cleanMobile = mobileNumber.trim();
  const valid = firstName.trim().length > 0 && firstName.trim().length <= 100 &&
    lastName.trim().length > 0 && lastName.trim().length <= 100 &&
    firstNameArabic.length <= 100 && lastNameArabic.length <= 100 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 320 &&
    cleanMobile.length <= 32 && jobTitle.trim().length <= 120 &&
    department.trim().length <= 120;
  const inviteTenantValue = selectedTenantId ?? inviteTenantId;
  const inviteValid = valid && (!isPlatform || (activeTenantSelected && (!selectedTenantId || inviteTenantValue === selectedTenantId)));
  const invite = useMutation({
    retry: false,
    mutationFn: () => api.inviteUser(actor, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(firstNameArabic.trim() ? { firstNameArabic: firstNameArabic.trim() } : {}),
      ...(lastNameArabic.trim() ? { lastNameArabic: lastNameArabic.trim() } : {}),
      email: email.trim(),
      ...(cleanMobile ? { mobileNumber: cleanMobile } : {}),
      ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      ...(department.trim() ? { department: department.trim() } : {}),
      preferredLanguage,
      role,
    }, isPlatform ? inviteTenantValue : undefined),
    onSuccess: () => { toast.success(t("users.createdLocal", { email: email.trim() })); void qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); setFirstName(""); setLastName(""); setFirstNameArabic(""); setLastNameArabic(""); setEmail(""); setMobileNumber(""); setJobTitle(""); setDepartment(""); setPreferredLanguage("en"); setRole("operator"); setInviteTenantId(selectedTenantId ?? ""); setCreateTouched(false); setCreateError(""); },
    onError: (error) => setCreateError(t(userMutationErrorMessage(error, "create"))),
  });
  const update = useMutation({
    mutationFn: () => api.updateUser(actor, selected!.id, {
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      firstNameArabic: editFirstNameArabic.trim() || null,
      lastNameArabic: editLastNameArabic.trim() || null,
      mobileNumber: editMobileNumber.trim() || null,
      jobTitle: editJobTitle.trim() || null,
      department: editDepartment.trim() || null,
      preferredLanguage: editPreferredLanguage,
    }, isPlatform ? selected?.tenantId ?? undefined : undefined),
    retry: false,
    onSuccess: async (user) => { toast.success(t("users.updated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected(user); setEditOpen(false); },
    onError: (error) => setEditError(t(userMutationErrorMessage(error, "profile"))),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { user: PortalUser; status: UserStatus }) => api.setUserStatus(actor, input.user.id, input.status, isPlatform ? input.user.tenantId ?? undefined : undefined),
    retry: false,
    onSuccess: async (updated) => { toast.success(t("users.statusUpdated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected(updated); setStatusTarget(null); setStatusError(""); },
    onError: (error) => setStatusError(t(userMutationErrorMessage(error, "status"))),
  });
  const changeRole = useMutation({
    mutationFn: () => api.setUserRole(actor, selected!.id, editRole, isPlatform ? selected?.tenantId ?? undefined : undefined),
    retry: false,
    onSuccess: async (updated) => { toast.success(t("users.roleUpdated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected(updated); setRoleOpen(false); setRoleError(""); },
    onError: (error) => setRoleError(t(userMutationErrorMessage(error, "role"))),
  });
  const editValid = editFirstName.trim().length > 0 && editFirstName.trim().length <= 100 &&
    editLastName.trim().length > 0 && editLastName.trim().length <= 100 &&
    editFirstNameArabic.length <= 100 && editLastNameArabic.length <= 100 &&
    editMobileNumber.length <= 32 && editJobTitle.length <= 120 &&
    editDepartment.length <= 120;
  const openEdit = (user: PortalUser) => {
    setSelected(user);
    setEditFirstName(user.firstName ?? user.name.split(" ")[0] ?? "");
    setEditLastName(user.lastName ?? user.name.split(" ").slice(1).join(" ") ?? "");
    setEditFirstNameArabic(user.firstNameArabic ?? "");
    setEditLastNameArabic(user.lastNameArabic ?? "");
    setEditMobileNumber(user.mobileNumber ?? "");
    setEditJobTitle(user.jobTitle ?? "");
    setEditDepartment(user.department ?? "");
    setEditPreferredLanguage(user.preferredLanguage ?? "en");
    setEditTouched(false);
    setEditError("");
    setEditOpen(true);
  };
  const openRoleChange = (user: PortalUser) => {
    if (user.role === "super_admin") return;
    setSelected(user);
    setEditRole(user.role);
    setRoleError("");
    setRoleOpen(true);
  };
  const changeSort = (field: UserSortField) => {
    setSortBy(field);
    setPage(1);
  };
  const toggleSortDirection = () => {
    setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    setPage(1);
  };

  const canManageSelected = Boolean(
    selected &&
    can("users.manage") &&
    selected.role !== "super_admin" &&
    (!isPlatform || selected.tenantId),
  );
  const columns: Column<PortalUser>[] = [
    ...(!selectedTenantId ? [{
      id: "t",
      header: t("common.tenant"),
      cell: (u: PortalUser) => u.tenantName ?? (u.tenantId ? tenantNames.get(u.tenantId) : t("users.platformAccount")) ?? t("users.unavailable"),
    }] : []),
    {
      id: "n",
      header: t("common.name"),
      cell: (u) => (<div><div className="font-medium">{u.name}</div><div dir="ltr" className="text-caption text-start">{u.email}</div></div>),
    },
    {
      id: "r",
      header: t("common.role"),
      cell: (u) => t(`role.${u.role}`),
    },
    {
      id: "s",
      header: t("common.status"),
      cell: (u) => <StatusBadge status={u.status} />,
    },
    ...(apiMode === "mock" ? [{ id: "m", header: t("users.mfa"), cell: (u: PortalUser) => <span className={u.mfa ? "text-success" : "text-muted-foreground"}>{u.mfa ? t("users.on") : t("users.off")}</span> }] : []),
    {
      id: "l",
      header: t("users.lastLogin"),
      className: "hidden md:table-cell",
      cell: (u) => <span className="tabular-nums text-muted-foreground">{u.lastLoginAt === undefined ? t("users.unavailable") : u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : t("common.never")}</span>,
    },
  ];

  return (
    <>
      <PageHeader title={t("users.title")} description={selectedTenantId ? t("users.subtitleSelectedTenant") : t("users.subtitleAllTenants")}
        actions={can("users.manage") && <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="size-4" />{t("users.addUser")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <Info className="mt-0.5 size-4 shrink-0" />{t("users.sso")}
        </div>
        <Section>
          <TableToolbar
            search={search}
            onSearch={(value) => { setSearch(value); setPage(1); }}
            placeholder={t(isPlatform && !selectedTenantId ? "users.searchPlatform" : "users.search")}
            maxLength={200}
          >
            <FilterSelect
              label={t("common.status")}
              value={status}
              onChange={(value) => { setStatus(value as PortalUser["status"] | "all"); setPage(1); }}
              options={[
                { value: "all", label: t("common.allStatuses") },
                ...(["active", "invited", ...(apiMode === "mock" ? ["pending_activation" as const] : []), "suspended", "disabled"] as const)
                  .map((item) => ({ value: item, label: t(`status.${item}`) })),
              ]}
            />
            <label className="flex items-center gap-2 text-caption">
              {t("users.sortBy")}
              <Select value={userListQuery.sortBy ?? "name"} onValueChange={(value) => changeSort(value as UserSortField)}>
                <SelectTrigger className="h-8 w-36" aria-label={t("users.sortBy")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t("common.name")}</SelectItem>
                  <SelectItem value="email">{t("users.sortEmail")}</SelectItem>
                  <SelectItem value="status">{t("common.status")}</SelectItem>
                  <SelectItem value="createdAt">{t("users.createdDate")}</SelectItem>
                  {isPlatform && !selectedTenantId && <SelectItem value="tenantName">{t("common.tenant")}</SelectItem>}
                </SelectContent>
              </Select>
            </label>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={toggleSortDirection}
              aria-label={t(sortDirection === "asc" ? "users.switchToDescending" : "users.switchToAscending")}
              title={t(sortDirection === "asc" ? "users.switchToDescending" : "users.switchToAscending")}
            >
              {sortDirection === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
              {t(sortDirection === "asc" ? "users.ascending" : "users.descending")}
            </Button>
          </TableToolbar>
          {q.isError ? (
            <ErrorState onRetry={() => { void q.refetch(); }} />
          ) : q.data && !q.isPlaceholderData && q.data.total === 0 ? (
            <EmptyState title={t("users.noUsers")} />
          ) : (
            <DataTable columns={columns} rows={q.isPlaceholderData ? undefined : q.data?.items} loading={q.isFetching} rowKey={(u) => u.id} onRowClick={setSelected} />
          )}
          {q.data && !q.isError && !q.isPlaceholderData && q.data.total > 0 && <ListPagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
      </PageBody>
      <Dialog open={open} onOpenChange={(value) => { if (!invite.isPending) { setOpen(value); if (value) setCreateError(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("users.addUser")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="rounded-md border border-info/25 bg-info-soft px-3 py-2 text-xs text-info">{t("users.sso")}</p>
            {isPlatform && !selectedTenantId && (
              <div className="space-y-1.5"><Label>{t("common.tenant")}</Label>
                <TenantOptionsStatus query={tenantsQuery} />
                <Select {...(inviteTenantValue ? { value: inviteTenantValue } : {})} onValueChange={setInviteTenantId} disabled={!tenantsQuery.isSuccess || tenantsQuery.isFetching}><SelectTrigger><SelectValue placeholder={t("ten.selectTenant")} /></SelectTrigger><SelectContent>{tenantOptions.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent></Select>
                {inviteTenantId && tenantsQuery.isSuccess && !tenantsQuery.isFetching && !activeTenantSelected && <p role="alert" className="text-xs text-danger">{t("ten.activeRequired")}</p>}
              </div>
            )}
            {isPlatform && selectedTenantId && <div className="space-y-1.5"><TenantOptionsStatus query={tenantsQuery} />{tenantsQuery.isSuccess && !tenantsQuery.isFetching && !activeTenantSelected && <p role="alert" className="text-xs text-danger">{t("ten.activeRequired")}</p>}</div>}
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="first-name-en">{t("users.firstNameEn")}</Label><Input id="first-name-en" maxLength={100} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="last-name-en">{t("users.lastNameEn")}</Label><Input id="last-name-en" maxLength={100} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="first-name-ar">{t("users.firstNameAr")}</Label><Input id="first-name-ar" dir="rtl" maxLength={100} value={firstNameArabic} onChange={(e) => setFirstNameArabic(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="last-name-ar">{t("users.lastNameAr")}</Label><Input id="last-name-ar" dir="rtl" maxLength={100} value={lastNameArabic} onChange={(e) => setLastNameArabic(e.target.value)} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="ue">{t("common.email")}</Label><Input id="ue" maxLength={320} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="mobile">{t("users.mobile")}</Label><Input id="mobile" maxLength={32} dir="ltr" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="job-title">{t("users.jobTitle")}</Label><Input id="job-title" maxLength={120} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="department">{t("users.department")}</Label><Input id="department" maxLength={120} value={department} onChange={(e) => setDepartment(e.target.value)} /></div><div className="space-y-1.5"><Label>{t("common.role")}</Label><Select value={role} onValueChange={(v) => setRole(v as TenantUserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["client_admin", "operator", "viewer"] as const).map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-1.5"><Label>{t("users.preferredLanguage")}</Label><Select value={preferredLanguage} onValueChange={(v) => setPreferredLanguage(v as "en" | "ar")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">{t("users.languageEn")}</SelectItem><SelectItem value="ar">{t("users.languageAr")}</SelectItem></SelectContent></Select></div>
            {createTouched && !valid && <p role="alert" className="text-xs text-danger">{t("users.invalidDetails")}</p>}
            {createError && <p role="alert" className="text-sm text-danger">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={invite.isPending}>{t("common.cancel")}</Button>
            <Button disabled={!inviteValid || invite.isPending} onClick={() => { setCreateTouched(true); if (inviteValid) invite.mutate(); }}>{invite.isPending ? t("common.saving") : t("users.addUser")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!selected && !editOpen && !roleOpen} onOpenChange={(value) => !value && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>{selected?.id} · {selected?.email}</SheetDescription>
          </SheetHeader>
          {selected && <div className="space-y-4 px-4">
            <div className="grid gap-2 text-sm">
              <div><div className="text-label">{t("users.firstNameEn")}</div><div>{selected.firstName ?? t("users.unavailable")}</div></div>
              <div><div className="text-label">{t("users.lastNameEn")}</div><div>{selected.lastName ?? t("users.unavailable")}</div></div>
              {(selected.firstNameArabic || selected.lastNameArabic) && <div><div className="text-label">{t("users.firstNameAr")}</div><div dir="rtl">{[selected.firstNameArabic, selected.lastNameArabic].filter(Boolean).join(" ")}</div></div>}
            </div>
            <div className="grid gap-2 text-sm">
              <div><div className="text-label">{t("common.role")}</div><div>{t(`role.${selected.role}`)}</div></div>
              <div><div className="text-label">{t("common.status")}</div><StatusBadge status={selected.status} /></div>
            </div>
            <div className="grid gap-2 text-sm">
              <div><div className="text-label">{t("users.mobile")}</div><div className="font-mono" dir="ltr">{selected.mobileNumber ?? t("users.unavailable")}</div></div>
              <div><div className="text-label">{t("users.jobTitle")}</div><div>{selected.jobTitle ?? t("users.unavailable")}</div></div>
              <div><div className="text-label">{t("users.department")}</div><div>{selected.department ?? t("users.unavailable")}</div></div>
              <div><div className="text-label">{t("users.preferredLanguage")}</div><div>{selected.preferredLanguage === "ar" ? t("users.languageAr") : selected.preferredLanguage === "en" ? t("users.languageEn") : t("users.unavailable")}</div></div>
              {selected.tenantId && <div><div className="text-label">{t("common.tenant")}</div><div>{selected.tenantName ?? tenantNames.get(selected.tenantId) ?? selected.tenantId}</div></div>}
            </div>
            <div><div className="text-label">{t("users.lastLogin")}</div><div className="text-sm">{selected.lastLoginAt === undefined ? t("users.unavailable") : selected.lastLoginAt ? formatDateTime(selected.lastLoginAt, locale) : t("common.never")}</div></div>
            {apiMode === "mock" && <div><div className="text-label">{t("users.mfa")}</div><div>{selected.mfa ? t("users.on") : t("users.off")}</div></div>}
            {canManageSelected && <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>
              <Button variant="outline" onClick={() => openRoleChange(selected)}>{t("users.changeRole")}</Button>
              {availableUserStatusTransitions(selected.status).map((nextStatus) => (
                <Button
                  key={nextStatus}
                  variant={nextStatus === "suspended" || nextStatus === "disabled" ? "destructive" : "outline"}
                  onClick={() => { setStatusError(""); setStatusTarget({ user: selected, status: nextStatus }); }}
                >
                  {t(nextStatus === "active" ? "users.activate" : nextStatus === "suspended" ? "users.suspend" : "users.disable")}
                </Button>
              ))}
            </div>}
          </div>}
        </SheetContent>
      </Sheet>
      <Sheet open={editOpen} onOpenChange={(value) => !update.isPending && setEditOpen(value)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>{t("users.edit")}</SheetTitle><SheetDescription>{t("users.editDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(event) => { event.preventDefault(); setEditTouched(true); if (editValid) update.mutate(); }} noValidate>
            <div className="space-y-1.5"><Label htmlFor="edit-user-email">{t("common.email")}</Label><Input id="edit-user-email" type="email" dir="ltr" value={selected?.email ?? ""} readOnly disabled /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="edit-first-name-en">{t("users.firstNameEn")}</Label><Input id="edit-first-name-en" maxLength={100} value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} aria-invalid={editTouched && !editFirstName.trim()} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-last-name-en">{t("users.lastNameEn")}</Label><Input id="edit-last-name-en" maxLength={100} value={editLastName} onChange={(event) => setEditLastName(event.target.value)} aria-invalid={editTouched && !editLastName.trim()} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="edit-first-name-ar">{t("users.firstNameAr")}</Label><Input id="edit-first-name-ar" dir="rtl" maxLength={100} value={editFirstNameArabic} onChange={(event) => setEditFirstNameArabic(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-last-name-ar">{t("users.lastNameAr")}</Label><Input id="edit-last-name-ar" dir="rtl" maxLength={100} value={editLastNameArabic} onChange={(event) => setEditLastNameArabic(event.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="edit-mobile">{t("users.mobile")}</Label><Input id="edit-mobile" maxLength={32} dir="ltr" value={editMobileNumber} onChange={(event) => setEditMobileNumber(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="edit-job-title">{t("users.jobTitle")}</Label><Input id="edit-job-title" maxLength={120} value={editJobTitle} onChange={(event) => setEditJobTitle(event.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="edit-department">{t("users.department")}</Label><Input id="edit-department" maxLength={120} value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("users.preferredLanguage")}</Label><Select value={editPreferredLanguage} onValueChange={(value) => setEditPreferredLanguage(value as "en" | "ar")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">{t("users.languageEn")}</SelectItem><SelectItem value="ar">{t("users.languageAr")}</SelectItem></SelectContent></Select></div>
            {editTouched && !editValid && <p className="text-xs text-danger">{t("users.invalidDetails")}</p>}
            {editError && <p role="alert" className="text-sm text-danger">{editError}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={update.isPending}>{t("common.cancel")}</Button><Button type="submit" disabled={!editValid || update.isPending}>{update.isPending ? t("common.saving") : t("common.save")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>
      <Dialog open={roleOpen} onOpenChange={(value) => !changeRole.isPending && setRoleOpen(value)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("users.roleChangeTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("users.roleChangeBody", { role: t(`role.${editRole}`) })}</p>
            <div className="space-y-1.5"><Label>{t("common.role")}</Label><Select value={editRole} onValueChange={(value) => setEditRole(value as TenantUserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["client_admin", "operator", "viewer"] as const).map((item) => <SelectItem key={item} value={item}>{t(`role.${item}`)}</SelectItem>)}</SelectContent></Select></div>
            {roleError && <p role="alert" className="text-sm text-danger">{roleError}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRoleOpen(false)} disabled={changeRole.isPending}>{t("common.cancel")}</Button><Button onClick={() => changeRole.mutate()} disabled={!selected || selected.role === editRole || changeRole.isPending}>{changeRole.isPending ? t("common.saving") : t("users.changeRole")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!statusTarget} onOpenChange={(value) => { if (!changeStatus.isPending && !value) setStatusTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(statusTarget?.status === "active" ? "users.activateTitle" : statusTarget?.status === "suspended" ? "users.suspendTitle" : "users.disableTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t(statusTarget?.status === "active" ? "users.activateBody" : statusTarget?.status === "suspended" ? "users.suspendBody" : "users.disableBody", { name: statusTarget?.user.name ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          {statusError && <p role="alert" className="text-sm text-danger">{statusError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changeStatus.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); if (statusTarget) changeStatus.mutate(statusTarget); }} disabled={!statusTarget || changeStatus.isPending}>
              {t(statusTarget?.status === "active" ? "users.activate" : statusTarget?.status === "suspended" ? "users.suspend" : "users.disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
