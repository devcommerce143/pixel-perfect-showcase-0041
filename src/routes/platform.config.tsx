import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { ConfigParam } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useSession } from "@/lib/auth/session";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/config")({
  head: () => pageHead("System Configuration", "Platform-wide configuration."),
  component: () => <RequirePermission permission="platform.config"><Config /></RequirePermission>,
});

function Config() {
  const { t, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const q = useQuery(queries.config());
  const [selected, setSelected] = useState<ConfigParam | null>(null);
  const [value, setValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const sensitive = !!selected && /(token|retry|rate_limit|ttl|timeout|recipient|segment|max_attempts)/i.test(selected.key);
  const save = useMutation({
    mutationFn: () => api.updateConfig(selected!.key, value),
    onSuccess: async () => { toast.success(t("cfg.saved")); await queryClient.invalidateQueries({ queryKey: ["config"] }); setSelected(null); setConfirmOpen(false); setError(""); },
    onError: () => setError(t("cfg.saveError")),
  });
  const openEdit = (param: ConfigParam) => { setSelected(param); setValue(param.value); setError(""); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); setError(""); if (!value.trim()) { setError(t("cfg.required")); return; } if (sensitive) setConfirmOpen(true); else save.mutate(); };
  const columns: Column<ConfigParam>[] = [
    { id: "k", header: t("cfg.key"), cell: (c) => <span dir="ltr" className="font-mono text-xs font-medium">{c.key}</span> },
    { id: "v", header: t("common.value"), cell: (c) => <code dir="ltr" className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{c.value}</code> },
    { id: "d", header: t("common.description"), className: "hidden md:table-cell", cell: (c) => <span className="text-muted-foreground">{c.description}</span> },
  ];
  const groups = [...new Set((q.data ?? []).map((c) => c.category))];
  return (
    <>
      <PageHeader title={t("cfg.title")} description={t("cfg.subtitle")} />
      <PageBody>
        <div className="flex items-start gap-2.5 rounded-md border border-info/25 bg-info-soft px-4 py-2.5 text-[0.8125rem] text-info">
          <Lock className="mt-0.5 size-4 shrink-0" />{t(can("platform.config.manage") ? "cfg.manageNotice" : "cfg.readOnly")}
        </div>
        {q.isLoading ? <Section><DataTable columns={columns} rows={undefined} loading rowKey={(c) => c.key} /></Section>
          : groups.map((g) => (
            <Section key={g} title={g}><DataTable dense columns={columns} rows={q.data?.filter((c) => c.category === g)} rowKey={(c) => c.key} onRowClick={can("platform.config.manage") ? openEdit : undefined} /></Section>
          ))}
      </PageBody>
          <Sheet open={!!selected} onOpenChange={(value) => !save.isPending && !value && setSelected(null)}><SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-lg"><SheetHeader><SheetTitle>{t("cfg.editTitle")}</SheetTitle><SheetDescription>{selected?.description}</SheetDescription></SheetHeader>{selected && <form className="space-y-4 px-4" onSubmit={submit} noValidate><div className="space-y-1.5"><Label htmlFor="config-key">{t("cfg.key")}</Label><Input id="config-key" value={selected.key} readOnly dir="ltr" className="font-mono" /></div><div className="space-y-1.5"><Label htmlFor="config-value">{t("common.value")}</Label><Input id="config-value" value={value} onChange={(event) => setValue(event.target.value)} dir="ltr" aria-invalid={!!error} /></div>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setSelected(null)}>{t("common.cancel")}</Button><Button type="submit" disabled={!can("platform.config.manage") || save.isPending}>{save.isPending ? t("common.saving") : t("common.save")}</Button></div></form>}</SheetContent></Sheet>
          <AlertDialog open={confirmOpen} onOpenChange={(value) => !save.isPending && setConfirmOpen(value)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("cfg.confirmTitle")}</AlertDialogTitle><AlertDialogDescription>{t("cfg.confirmBody", { key: selected?.key ?? "" })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={save.isPending} onClick={(event) => { event.preventDefault(); save.mutate(); }}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
