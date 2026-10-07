import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Info, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { PortalUser, SenderIdentityActor, UserSortField } from "@/lib/api/types";
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
  const { can, user } = useSession();
  const { tenantId: requestedTenantId } = Route.useSearch();
  const isPlatform = user?.role === "super_admin";
  const selectedTenantId = isPlatform ? requestedTenantId : user?.tenantId ?? undefined;
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const qc = useQueryClient();
  const tenantsQuery = useQuery({
    queryKey: ["tenants", "users"],
    queryFn: () => api.listTenants({ page: 1, pageSize: 200, filters: { status: "active" }, sortBy: "name", sortDirection: "asc" }),
  });
  const tenantOptions = tenantsQuery.data?.items.filter((tenant) => tenant.status !== "suspended") ?? [];
  const tenantNames = new Map(tenantOptions.map((tenant) => [tenant.id, tenant.name]));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PortalUser["status"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<UserSortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [inviteTenantId, setInviteTenantId] = useState(selectedTenantId ?? "");
  const q = useQuery(queries.users(actor, { page, pageSize, search, filters: { status, ...(selectedTenantId ? { tenantId: selectedTenantId } : {}) }, sortBy, sortDirection }));
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
  const [role, setRole] = useState<PortalUser["role"]>("operator");
  const [selected, setSelected] = useState<PortalUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PortalUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editFirstNameArabic, setEditFirstNameArabic] = useState("");
  const [editLastNameArabic, setEditLastNameArabic] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobileNumber, setEditMobileNumber] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editPreferredLanguage, setEditPreferredLanguage] = useState<"en" | "ar">("en");
  const [editRole, setEditRole] = useState<PortalUser["role"]>("operator");
  const [editTouched, setEditTouched] = useState(false);
  const [editError, setEditError] = useState("");
  useEffect(() => { setPage(1); setSelected(null); setInviteTenantId(selectedTenantId ?? ""); }, [selectedTenantId, tenantsQuery.data]);

  if (selectedTenantId && !tenantNames.has(selectedTenantId)) {
    tenantNames.set(selectedTenantId, selectedTenantId);
  }
  const cleanMobile = mobileNumber.trim();
  const valid = firstName.trim() && lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !!role && (!cleanMobile || /^\+?[0-9\s-]{7,20}$/.test(cleanMobile));
  const inviteTenantValue = selectedTenantId ?? inviteTenantId;
  const inviteValid = valid && (!isPlatform || !!inviteTenantValue) && (!isPlatform || !selectedTenantId || inviteTenantValue === selectedTenantId);
  const invite = useMutation({
    mutationFn: () => api.inviteUser(actor, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(firstNameArabic.trim() ? { firstNameArabic: firstNameArabic.trim() } : {}),
      ...(lastNameArabic.trim() ? { lastNameArabic: lastNameArabic.trim() } : {}),
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email: email.trim(),
      ...(cleanMobile ? { mobileNumber: cleanMobile } : {}),
      ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      ...(department.trim() ? { department: department.trim() } : {}),
      preferredLanguage,
      role,
      ...(inviteTenantValue ? { tenantId: inviteTenantValue } : {}),
    }),
    onSuccess: () => { toast.success(t("users.invited", { email: email.trim() })); void qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); setFirstName(""); setLastName(""); setFirstNameArabic(""); setLastNameArabic(""); setEmail(""); setMobileNumber(""); setJobTitle(""); setDepartment(""); setPreferredLanguage("en"); setRole("operator"); setInviteTenantId(selectedTenantId ?? ""); },
  });
  const update = useMutation({
    mutationFn: () => api.updateUser(actor, selected!.id, {
      name: `${editFirstName.trim()} ${editLastName.trim()}`.trim(),
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      ...(editFirstNameArabic.trim() ? { firstNameArabic: editFirstNameArabic.trim() } : {}),
      ...(editLastNameArabic.trim() ? { lastNameArabic: editLastNameArabic.trim() } : {}),
      email: editEmail.trim(),
      ...(editMobileNumber.trim() ? { mobileNumber: editMobileNumber.trim() } : {}),
      ...(editJobTitle.trim() ? { jobTitle: editJobTitle.trim() } : {}),
      ...(editDepartment.trim() ? { department: editDepartment.trim() } : {}),
      preferredLanguage: editPreferredLanguage,
      role: editRole,
    }),
    onSuccess: async (user) => { toast.success(t("users.updated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected(user); setEditOpen(false); },
    onError: () => setEditError(t("users.updateError")),
  });
  const resend = useMutation({
    mutationFn: (id: string) => api.resendInvitation(actor, id),
    onSuccess: () => { if (selected) toast.success(t("users.resent", { email: selected.email })); },
    onError: () => toast.error(t("users.resendError")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { user: PortalUser; status: "active" | "disabled" }) => api.setUserStatus(actor, input.user.id, input.status),
    onSuccess: async (_, input) => { toast.success(t(input.status === "active" ? "users.reactivated" : "users.deactivated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected({ ...input.user, status: input.status }); setDeactivateTarget(null); },
  });
  const editValid = editFirstName.trim().length > 1 && editLastName.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim()) && (!editMobileNumber.trim() || /^\+?[0-9\s-]{7,20}$/.test(editMobileNumber.trim()));
  const openEdit = (user: PortalUser) => {
    setSelected(user);
    setEditFirstName(user.firstName ?? user.name.split(" ")[0] ?? "");
    setEditLastName(user.lastName ?? user.name.split(" ").slice(1).join(" ") ?? "");
    setEditFirstNameArabic(user.firstNameArabic ?? "");
    setEditLastNameArabic(user.lastNameArabic ?? "");
    setEditEmail(user.email);
    setEditMobileNumber(user.mobileNumber ?? "");
    setEditJobTitle(user.jobTitle ?? "");
    setEditDepartment(user.department ?? "");
    setEditPreferredLanguage(user.preferredLanguage ?? "en");
    setEditRole(user.role);
    setEditTouched(false);
    setEditError("");
    setEditOpen(true);
  };
  const toggleSort = (field: UserSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "lastLoginAt" ? "desc" : "asc");
    setSortBy(field);
    setPage(1);
  };

  const columns: Column<PortalUser>[] = [
    ...(!selectedTenantId ? [{ id: "t", header: <SortableHeader label={t("common.tenant")} field="tenantName" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("tenantName")} />, cell: (u: PortalUser) => <span>{u.tenantName ?? tenantNames.get(u.tenantId ?? "") ?? u.tenantId ?? t("common.notFound")}</span> }] : []),
    { id: "n", header: <SortableHeader label={t("common.name")} field="name" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("name")} />, cell: (u) => (<div><div className="font-medium">{u.name}</div><div dir="ltr" className="text-caption text-start">{u.email}</div></div>) },
    { id: "r", header: <SortableHeader label={t("common.role")} field="role" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("role")} />, cell: (u) => t(`role.${u.role}`) },
    { id: "s", header: <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} />, cell: (u) => <StatusBadge status={u.status} /> },
    { id: "m", header: t("users.mfa"), cell: (u) => <span className={u.mfa ? "text-success" : "text-muted-foreground"}>{u.mfa ? t("users.on") : t("users.off")}</span> },
    { id: "l", header: <SortableHeader label={t("users.lastLogin")} field="lastLoginAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("lastLoginAt")} />, className: "hidden md:table-cell", cell: (u) => <span className="tabular-nums text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : t("common.never")}</span> },
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
          <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("users.search")}>
            <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as PortalUser["status"] | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, ...(["active", "invited", "disabled"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.isPlaceholderData ? undefined : q.data?.items} loading={q.isFetching} rowKey={(u) => u.id} onRowClick={setSelected} />
          {q.data && !q.isPlaceholderData && <ListPagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
      </PageBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("users.addUser")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {isPlatform && !selectedTenantId && (
              <div className="space-y-1.5"><Label>{t("common.tenant")}</Label>
                <Select {...(inviteTenantValue ? { value: inviteTenantValue } : {})} onValueChange={setInviteTenantId}><SelectTrigger><SelectValue placeholder={t("ten.selectTenant")} /></SelectTrigger><SelectContent>{tenantOptions.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="first-name-en">{t("users.firstNameEn")}</Label><Input id="first-name-en" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="last-name-en">{t("users.lastNameEn")}</Label><Input id="last-name-en" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="first-name-ar">{t("users.firstNameAr")}</Label><Input id="first-name-ar" dir="rtl" value={firstNameArabic} onChange={(e) => setFirstNameArabic(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="last-name-ar">{t("users.lastNameAr")}</Label><Input id="last-name-ar" dir="rtl" value={lastNameArabic} onChange={(e) => setLastNameArabic(e.target.value)} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="ue">{t("common.email")}</Label><Input id="ue" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="mobile">{t("users.mobile")}</Label><Input id="mobile" dir="ltr" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="job-title">{t("users.jobTitle")}</Label><Input id="job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="department">{t("users.department")}</Label><Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} /></div><div className="space-y-1.5"><Label>{t("common.role")}</Label><Select value={role} onValueChange={(v) => setRole(v as PortalUser["role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["client_admin", "operator", "viewer"] as const).map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-1.5"><Label>{t("users.preferredLanguage")}</Label><Select value={preferredLanguage} onValueChange={(v) => setPreferredLanguage(v as "en" | "ar")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!inviteValid || invite.isPending} onClick={() => invite.mutate()}>{t("users.addUser")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!selected && !editOpen} onOpenChange={(value) => !value && setSelected(null)}><SheetContent className="w-full sm:max-w-md"><SheetHeader><SheetTitle>{selected?.name}</SheetTitle><SheetDescription>{selected?.id} · {selected?.email}</SheetDescription></SheetHeader>{selected && <div className="space-y-4 px-4"><div className="grid gap-2 text-sm"><div><div className="text-label">{t("users.firstNameEn")}</div><div>{selected.firstName ?? (selected.name.split(" ")[0] ?? t("common.notFound"))}</div></div><div><div className="text-label">{t("users.lastNameEn")}</div><div>{selected.lastName ?? (selected.name.split(" ").slice(1).join(" ") || t("common.notFound"))}</div></div>{selected.firstNameArabic || selected.lastNameArabic ? <div><div className="text-label">{t("users.firstNameAr")}</div><div dir="rtl">{[selected.firstNameArabic, selected.lastNameArabic].filter(Boolean).join(" ") || t("common.notFound")}</div></div> : null}</div><div className="grid gap-2 text-sm"><div><div className="text-label">{t("common.role")}</div><div>{t(`role.${selected.role}`)}</div></div><div><div className="text-label">{t("common.status")}</div><StatusBadge status={selected.status} /></div></div><div className="grid gap-2 text-sm"><div><div className="text-label">{t("users.mobile")}</div><div className="font-mono" dir="ltr">{selected.mobileNumber ?? t("common.notFound")}</div></div><div><div className="text-label">{t("users.jobTitle")}</div><div>{selected.jobTitle ?? t("common.notFound")}</div></div><div><div className="text-label">{t("users.department")}</div><div>{selected.department ?? t("common.notFound")}</div></div><div><div className="text-label">{t("users.preferredLanguage")}</div><div>{selected.preferredLanguage === "ar" ? "العربية" : "English"}</div></div></div><div><div className="text-label">{t("users.lastLogin")}</div><div className="text-sm">{selected.lastLoginAt ? formatDateTime(selected.lastLoginAt, locale) : t("common.never")}</div></div><div><div className="text-label">{t("users.mfa")}</div><div>{selected.mfa ? t("users.on") : t("users.off")}</div></div>{can("users.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{selected.status === "invited" && <Button variant="outline" disabled={resend.isPending} onClick={() => resend.mutate(selected.id)}>{t("users.resend")}</Button>}{selected.status === "active" ? <Button variant="destructive" onClick={() => setDeactivateTarget(selected)}>{t("users.deactivate")}</Button> : selected.status === "disabled" && <Button variant="outline" onClick={() => changeStatus.mutate({ user: selected, status: "active" })}>{t("users.reactivate")}</Button>}</div>}</div>}</SheetContent></Sheet>
      <Sheet open={editOpen} onOpenChange={(value) => !update.isPending && setEditOpen(value)}><SheetContent className="w-full sm:max-w-lg"><SheetHeader><SheetTitle>{t("users.edit")}</SheetTitle><SheetDescription>{t("users.editDescription")}</SheetDescription></SheetHeader><form className="space-y-4 px-4" onSubmit={(event) => { event.preventDefault(); setEditTouched(true); if (editValid) update.mutate(); }} noValidate><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="edit-first-name-en">{t("users.firstNameEn")}</Label><Input id="edit-first-name-en" value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} aria-invalid={editTouched && editFirstName.trim().length <= 1} /></div><div className="space-y-1.5"><Label htmlFor="edit-last-name-en">{t("users.lastNameEn")}</Label><Input id="edit-last-name-en" value={editLastName} onChange={(event) => setEditLastName(event.target.value)} aria-invalid={editTouched && editLastName.trim().length <= 1} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="edit-first-name-ar">{t("users.firstNameAr")}</Label><Input id="edit-first-name-ar" dir="rtl" value={editFirstNameArabic} onChange={(event) => setEditFirstNameArabic(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="edit-last-name-ar">{t("users.lastNameAr")}</Label><Input id="edit-last-name-ar" dir="rtl" value={editLastNameArabic} onChange={(event) => setEditLastNameArabic(event.target.value)} /></div></div><div className="space-y-1.5"><Label htmlFor="edit-user-email">{t("common.email")}</Label><Input id="edit-user-email" type="email" dir="ltr" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} aria-invalid={editTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="edit-mobile">{t("users.mobile")}</Label><Input id="edit-mobile" dir="ltr" value={editMobileNumber} onChange={(event) => setEditMobileNumber(event.target.value)} aria-invalid={editTouched && !!editMobileNumber.trim() && !/^\+?[0-9\s-]{7,20}$/.test(editMobileNumber.trim())} /></div><div className="space-y-1.5"><Label htmlFor="edit-job-title">{t("users.jobTitle")}</Label><Input id="edit-job-title" value={editJobTitle} onChange={(event) => setEditJobTitle(event.target.value)} /></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="edit-department">{t("users.department")}</Label><Input id="edit-department" value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)} /></div><div className="space-y-1.5"><Label>{t("common.role")}</Label><Select value={editRole} onValueChange={(value) => setEditRole(value as PortalUser["role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["client_admin", "operator", "viewer"] as const).map((item) => <SelectItem key={item} value={item}>{t(`role.${item}`)}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-1.5"><Label>{t("users.preferredLanguage")}</Label><Select value={editPreferredLanguage} onValueChange={(value) => setEditPreferredLanguage(value as "en" | "ar")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>{editTouched && !editValid && <p className="text-xs text-danger">{t("users.invalidDetails")}</p>}{editError && <p role="alert" className="text-sm text-danger">{editError}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={update.isPending}>{t("common.cancel")}</Button><Button type="submit" disabled={!editValid || update.isPending}>{update.isPending ? t("common.saving") : t("common.save")}</Button></div></form></SheetContent></Sheet>
      <AlertDialog open={!!deactivateTarget} onOpenChange={(value) => !value && setDeactivateTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("users.deactivateTitle")}</AlertDialogTitle><AlertDialogDescription>{t("users.deactivateBody", { name: deactivateTarget?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (deactivateTarget) changeStatus.mutate({ user: deactivateTarget, status: "disabled" }); }} disabled={changeStatus.isPending}>{t("users.deactivate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
