import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, KeyRound, Plus, ShieldAlert } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const apps = useQuery(queries.applications());
  const [target, setTarget] = useState<ApiCredential | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiCredential | null>(null);
  const [open, setOpen] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [secretResult, setSecretResult] = useState<{ credential: ApiCredential; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const selectedApp = apps.data?.find((app) => app.id === applicationId);
  const generate = useMutation({
    mutationFn: () => api.createCredential({ applicationId, scopes }),
    onSuccess: async (result) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["credentials"] }), qc.invalidateQueries({ queryKey: ["applications"] })]);
      toast.success(t("cred.created"));
      setOpen(false);
      setSecretResult(result);
      setCopied(false);
    },
    onError: () => toast.error(t("cred.createError")),
  });
  const rotate = useMutation({
    mutationFn: (id: string) => api.rotateCredential(id),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["credentials"] });
      toast.success(t("cred.rotated"));
      setRotateTarget(null);
      setSecretResult(result);
      setCopied(false);
    },
    onError: () => toast.error(t("cred.createError")),
  });
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
      <Dialog open={open} onOpenChange={(value) => !generate.isPending && setOpen(value)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("cred.new")}</DialogTitle><DialogDescription>{t("cred.generateDescription")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>{t("common.application")}</Label><Select value={applicationId} onValueChange={(id) => { setApplicationId(id); setScopes(apps.data?.find((app) => app.id === id)?.scopes ?? []); }}><SelectTrigger><SelectValue placeholder={t("cred.selectApplication")} /></SelectTrigger><SelectContent>{(apps.data ?? []).filter((app) => app.status === "active").map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div>
            {selectedApp && <div className="space-y-2"><Label>{t("common.scopes")}</Label><div className="grid gap-2 sm:grid-cols-2">{selectedApp.scopes.map((scope) => <label key={scope} className="flex items-center gap-2 font-mono text-xs"><Checkbox checked={scopes.includes(scope)} onCheckedChange={(checked) => setScopes((current) => checked ? [...current, scope] : current.filter((value) => value !== scope))} />{scope}</label>)}</div>{!selectedApp.scopes.length && <p className="text-xs text-warning">{t("cred.noScopes")}</p>}</div>}
          </div>
          <DialogFooter><Button variant="outline" disabled={generate.isPending} onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button disabled={!applicationId || !scopes.length || generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? t("common.creating") : t("cred.generate")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!rotateTarget} onOpenChange={(value) => !value && setRotateTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("cred.rotateTitle")}</AlertDialogTitle><AlertDialogDescription>{t("cred.rotateBody", { id: rotateTarget?.clientId ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={rotate.isPending} onClick={(event) => { event.preventDefault(); if (rotateTarget) rotate.mutate(rotateTarget.id); }}>{t("cred.rotate")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <Dialog open={!!secretResult} onOpenChange={(value) => { if (!value) { setSecretResult(null); setCopied(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("cred.secretTitle")}</DialogTitle><DialogDescription>{t("cred.secretWarning")}</DialogDescription></DialogHeader>
          {secretResult && <div className="space-y-3"><div className="rounded-md border bg-surface-subtle p-3"><div className="mb-1 text-xs text-muted-foreground">{secretResult.credential.clientId}</div><code dir="ltr" className="block break-all text-xs">{secretResult.secret}</code></div><Button variant="outline" disabled={copied} onClick={async () => { try { await navigator.clipboard.writeText(secretResult.secret); setCopied(true); toast.success(t("cred.copied")); } catch { toast.error(t("cred.copyFailed")); } }}><Copy className="size-4" />{copied ? t("cred.copied") : t("cred.copy")}</Button></div>}
          <DialogFooter><Button onClick={() => { setSecretResult(null); setCopied(false); }}>{t("cred.done")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
