import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { TableSkeleton } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { TenantSettings } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Tenant settings for Dolf Connect."),
  component: () => <RequirePermission permission="settings.view"><Settings /></RequirePermission>,
});

const THRESHOLDS = [50, 75, 90, 100];
const ZONES = ["Asia/Riyadh", "Asia/Dubai", "UTC"];

function Settings() {
  const { t } = useI18n();
  const { can } = useSession();
  const ro = !can("settings.manage");
  const qc = useQueryClient();
  const q = useQuery(queries.settings());
  const [f, setF] = useState<TenantSettings | null>(null);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: (s: TenantSettings) => api.updateSettings(s),
    onSuccess: () => { toast.success(t("common.saved")); void qc.invalidateQueries({ queryKey: ["settings"] }); },
  });
  if (!f) return <><PageHeader title={t("set.title")} description={t("set.subtitle")} /><PageBody><TableSkeleton /></PageBody></>;
  const up = <K extends keyof TenantSettings>(k: K, v: TenantSettings[K]) => setF({ ...f, [k]: v });
  const row = "grid gap-1.5 sm:grid-cols-[16rem_1fr] sm:items-start sm:gap-6 px-4 py-3";

  return (
    <>
      <PageHeader title={t("set.title")} description={t("set.subtitle")}
        actions={!ro && <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(f)}>{save.isPending && <Loader2 className="size-4 animate-spin" />}{t("common.save")}</Button>} />
      <PageBody>
        <fieldset disabled={ro} className="space-y-4">
          <Section title={t("set.org")}>
            <div className="divide-y">
              <div className={row}><Label htmlFor="on">{t("set.orgName")}</Label><Input id="on" className="max-w-md" value={f.organizationName} onChange={(e) => up("organizationName", e.target.value)} /></div>
              <div className={row}><Label>{t("set.defaultLang")}</Label>
                <Select disabled={ro} value={f.defaultLanguage} onValueChange={(v) => up("defaultLanguage", v as "en" | "ar")}><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
              <div className={row}><Label>{t("set.timezone")}</Label>
                <Select disabled={ro} value={f.timezone} onValueChange={(v) => up("timezone", v)}><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </Section>
          <Section title={t("set.notifications")}>
            <div className="divide-y">
              <div className={row}><div><Label>{t("set.quotaAlerts")}</Label><p className="text-caption">{t("set.quotaAlertsHint")}</p></div>
                <div className="flex flex-wrap gap-4">{THRESHOLDS.map((n) => (
                  <label key={n} className="flex items-center gap-2 text-sm tabular-nums">
                    <Checkbox checked={f.quotaAlerts.includes(n)} onCheckedChange={(c) => up("quotaAlerts", c ? [...f.quotaAlerts, n].sort((a, b) => a - b) : f.quotaAlerts.filter((x) => x !== n))} />{n}%
                  </label>))}</div></div>
              <div className={row}><Label htmlFor="ae">{t("set.alertEmail")}</Label><Input id="ae" dir="ltr" className="max-w-md" value={f.alertEmails} onChange={(e) => up("alertEmails", e.target.value)} /></div>
            </div>
          </Section>
          <Section title={t("set.security")}>
            <div className="divide-y">
              <div className={row}><Label htmlFor="mfa">{t("set.mfa")}</Label><Switch id="mfa" checked={f.mfaRequired} onCheckedChange={(v) => up("mfaRequired", v)} /></div>
              <div className={row}><div><Label htmlFor="ip">{t("set.ipAllowlist")}</Label><p className="text-caption">{t("set.ipHint")}</p></div>
                <Textarea id="ip" dir="ltr" rows={3} className="max-w-md font-mono text-xs" value={f.ipAllowlist} onChange={(e) => up("ipAllowlist", e.target.value)} /></div>
              <div className={row}><Label htmlFor="rt">{t("set.retention")}</Label><Input id="rt" type="number" min={1} className="max-w-[8rem]" value={f.retentionDays} onChange={(e) => up("retentionDays", Number(e.target.value))} /></div>
            </div>
          </Section>
        </fieldset>
      </PageBody>
    </>
  );
}
