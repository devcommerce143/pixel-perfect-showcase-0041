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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const invite = useMutation({
    mutationFn: () => api.inviteUser({ name, email, role }),
    onSuccess: () => { toast.success(t("users.invited", { email })); void qc.invalidateQueries({ queryKey: ["users"] }); setOpen(false); setName(""); setEmail(""); },
  });
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
          <DataTable columns={columns} rows={rows} loading={q.isLoading} rowKey={(u) => u.id} />
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
    </>
  );
}
