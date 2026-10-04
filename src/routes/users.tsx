import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Info, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
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
import type { PortalUser } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/users")({
  head: () => pageHead("Users", "Manage users and role assignments."),
  component: () => <RequirePermission permission="users.view"><Users /></RequirePermission>,
});

function Users() {
  const { t, locale } = useI18n();
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery(queries.users());
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PortalUser["role"]>("operator");
  const [selected, setSelected] = useState<PortalUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PortalUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<PortalUser["role"]>("operator");
  const [editTouched, setEditTouched] = useState(false);
  const [editError, setEditError] = useState("");
  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const invite = useMutation({
    mutationFn: () => api.inviteUser({ name, email, role }),
    onSuccess: () => { toast.success(t("users.invited", { email })); void qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); setName(""); setEmail(""); },
  });
  const update = useMutation({
    mutationFn: () => api.updateUser(selected!.id, { name: editName.trim(), email: editEmail.trim(), role: editRole }),
    onSuccess: async (user) => { toast.success(t("users.updated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected(user); setEditOpen(false); },
    onError: () => setEditError(t("users.updateError")),
  });
  const resend = useMutation({
    mutationFn: (id: string) => api.resendInvitation(id),
    onSuccess: () => { if (selected) toast.success(t("users.resent", { email: selected.email })); },
    onError: () => toast.error(t("users.resendError")),
  });
  const changeStatus = useMutation({
    mutationFn: (input: { user: PortalUser; status: "active" | "disabled" }) => api.setUserStatus(input.user.id, input.status),
    onSuccess: async (_, input) => { toast.success(t(input.status === "active" ? "users.reactivated" : "users.deactivated")); await qc.invalidateQueries({ queryKey: ["users"] }); setSelected({ ...input.user, status: input.status }); setDeactivateTarget(null); },
  });
  const editValid = editName.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim());
  const openEdit = (user: PortalUser) => { setSelected(user); setEditName(user.name); setEditEmail(user.email); setEditRole(user.role); setEditTouched(false); setEditError(""); setEditOpen(true); };
  const rows = q.data?.filter((u) => !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<PortalUser>[] = [
    { id: "n", header: t("common.name"), cell: (u) => (<div><div className="font-medium">{u.name}</div><div dir="ltr" className="text-caption text-start">{u.email}</div></div>) },
    { id: "r", header: t("common.role"), cell: (u) => t(`role.${u.role}`) },
    { id: "s", header: t("common.status"), cell: (u) => <StatusBadge status={u.status} /> },
    { id: "m", header: t("users.mfa"), cell: (u) => <span className={u.mfa ? "text-success" : "text-muted-foreground"}>{u.mfa ? t("users.on") : t("users.off")}</span> },
    { id: "l", header: t("users.lastLogin"), className: "hidden md:table-cell", cell: (u) => <span className="tabular-nums text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : t("common.never")}</span> },
  ];

  return (
    <>
      <PageHeader title={t("users.title")} description={t("users.subtitle")}
        actions={can("users.manage") && <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="size-4" />{t("users.invite")}</Button>} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <Info className="mt-0.5 size-4 shrink-0" />{t("users.sso")}
        </div>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("users.search")} />
          <DataTable columns={columns} rows={rows} loading={q.isLoading} rowKey={(u) => u.id} onRowClick={setSelected} />
        </Section>
      </PageBody>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("users.invite")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="un">{t("users.fullName")}</Label><Input id="un" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="ue">{t("common.email")}</Label><Input id="ue" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("common.role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as PortalUser["role"])}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["client_admin", "operator", "viewer"] as const).map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!valid || invite.isPending} onClick={() => invite.mutate()}>{t("users.invite")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={!!selected && !editOpen} onOpenChange={(value) => !value && setSelected(null)}><SheetContent className="w-full sm:max-w-md"><SheetHeader><SheetTitle>{selected?.name}</SheetTitle><SheetDescription>{selected?.id} · {selected?.email}</SheetDescription></SheetHeader>{selected && <div className="space-y-4 px-4"><div className="flex items-center gap-2"><span>{t("common.role")}</span><span>{t(`role.${selected.role}`)}</span></div><div className="flex items-center gap-2"><span>{t("common.status")}</span><StatusBadge status={selected.status} /></div><div><div className="text-label">{t("users.lastLogin")}</div><div className="text-sm">{selected.lastLoginAt ? formatDateTime(selected.lastLoginAt, locale) : t("common.never")}</div></div>{can("users.manage") && <div className="flex flex-wrap gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>{selected.status === "invited" && <Button variant="outline" disabled={resend.isPending} onClick={() => resend.mutate(selected.id)}>{t("users.resend")}</Button>}{selected.status === "active" ? <Button variant="destructive" onClick={() => setDeactivateTarget(selected)}>{t("users.deactivate")}</Button> : selected.status === "disabled" && <Button variant="outline" onClick={() => changeStatus.mutate({ user: selected, status: "active" })}>{t("users.reactivate")}</Button>}</div>}</div>}</SheetContent></Sheet>
      <Sheet open={editOpen} onOpenChange={(value) => !update.isPending && setEditOpen(value)}><SheetContent className="w-full sm:max-w-lg"><SheetHeader><SheetTitle>{t("users.edit")}</SheetTitle><SheetDescription>{t("users.editDescription")}</SheetDescription></SheetHeader><form className="space-y-4 px-4" onSubmit={(event) => { event.preventDefault(); setEditTouched(true); if (editValid) update.mutate(); }} noValidate><div className="space-y-1.5"><Label htmlFor="edit-user-name">{t("users.fullName")}</Label><Input id="edit-user-name" value={editName} onChange={(event) => setEditName(event.target.value)} aria-invalid={editTouched && editName.trim().length <= 1} /></div><div className="space-y-1.5"><Label htmlFor="edit-user-email">{t("common.email")}</Label><Input id="edit-user-email" type="email" dir="ltr" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} aria-invalid={editTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())} /></div><div className="space-y-1.5"><Label>{t("common.role")}</Label><Select value={editRole} onValueChange={(value) => setEditRole(value as PortalUser["role"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["client_admin", "operator", "viewer"] as const).map((item) => <SelectItem key={item} value={item}>{t(`role.${item}`)}</SelectItem>)}</SelectContent></Select></div>{editTouched && !editValid && <p className="text-xs text-danger">{t("users.invalidDetails")}</p>}{editError && <p role="alert" className="text-sm text-danger">{editError}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={update.isPending}>{t("common.cancel")}</Button><Button type="submit" disabled={!editValid || update.isPending}>{update.isPending ? t("common.saving") : t("common.save")}</Button></div></form></SheetContent></Sheet>
      <AlertDialog open={!!deactivateTarget} onOpenChange={(value) => !value && setDeactivateTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("users.deactivateTitle")}</AlertDialogTitle><AlertDialogDescription>{t("users.deactivateBody", { name: deactivateTarget?.name ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (deactivateTarget) changeStatus.mutate({ user: deactivateTarget, status: "disabled" }); }} disabled={changeStatus.isPending}>{t("users.deactivate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
