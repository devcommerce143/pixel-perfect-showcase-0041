import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, type Column } from "@/components/app/DataTable";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuotaBar } from "@/features/usage/QuotaMeter";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { BulkJob, Channel } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/bulk")({
  head: () => pageHead("Bulk Send", "Upload, validate and send bulk SMS, WhatsApp and Email jobs."),
  component: () => <RequirePermission permission="messages.bulk"><BulkSend /></RequirePermission>,
});

const PHONE = /^\+?[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function BulkSend() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const jobs = useQuery(queries.bulkJobs());
  const apps = useQuery(queries.applications());
  const templates = useQuery(queries.templates({ status: "approved" }));
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [appId, setAppId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<{ name: string; valid: number; invalid: number } | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return setFile(null);
    const rows = (await f.text()).split(/\r?\n/).map((l) => l.split(",")[0]?.trim() ?? "").filter(Boolean);
    const re = channel === "email" ? EMAIL : PHONE;
    const valid = rows.filter((r) => re.test(r.replace(/\s/g, ""))).length;
    setFile({ name: f.name, valid, invalid: rows.length - valid });
  };

  const submit = useMutation({
    mutationFn: () => api.createBulkJob({ name, channel, applicationId: appId, templateId: templateId || null, recipients: file?.valid ?? 0, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (j) => { toast.success(t("bulk.submitted", { id: j.id })); void qc.invalidateQueries({ queryKey: ["bulkJobs"] }); setName(""); setFile(null); },
  });

  const needsTemplate = channel === "whatsapp";
  const canSubmit = name && appId && file && file.valid > 0 && (!needsTemplate || templateId) && !submit.isPending;

  const columns: Column<BulkJob>[] = [
    { id: "job", header: t("bulk.job"), cell: (j) => (<div><div className="font-medium">{j.name}</div><div className="font-mono text-xs text-muted-foreground">{j.id}</div></div>) },
    { id: "ch", header: t("common.channel"), cell: (j) => <ChannelLabel channel={j.channel} /> },
    { id: "app", header: t("common.application"), cell: (j) => j.applicationName, className: "hidden lg:table-cell" },
    { id: "status", header: t("common.status"), cell: (j) => <StatusBadge status={j.status} /> },
    { id: "prog", header: t("bulk.progress"), cell: (j) => {
      const pct = j.total ? ((j.delivered + j.failed) / j.total) * 100 : 0;
      return <div className="w-40"><QuotaBar pct={pct} /><div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatNumber(j.delivered + j.failed, locale)} / {formatNumber(j.total, locale)}</div></div>;
    } },
    { id: "by", header: t("bulk.createdBy"), cell: (j) => (<div><div>{j.createdBy}</div><div className="text-xs tabular-nums text-muted-foreground">{formatDateTime(j.createdAt, locale)}</div></div>), className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader title={t("bulk.title")} description={t("bulk.subtitle")} />
      <PageBody>
        <Section title={t("bulk.newJob")}>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="bn">{t("bulk.jobName")}</Label><Input id="bn" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("common.channel")}</Label>
              <Select value={channel} onValueChange={(v) => { setChannel(v as Channel); setFile(null); setAppId(""); setTemplateId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["sms", "whatsapp", "email"] as const).map((c) => <SelectItem key={c} value={c}>{t(`channel.${c}`)}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t("common.application")}</Label>
              <Select value={appId} onValueChange={setAppId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(apps.data ?? []).filter((a) => a.status === "active" && a.channels.includes(channel)).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>{t("common.template")}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(templates.data?.items ?? []).filter((x) => x.channel === channel).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
              </Select>
              {needsTemplate && !templateId && <p className="text-caption">{t("bulk.templateRequired")}</p>}</div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="bf">{t("bulk.file")}</Label>
              <label htmlFor="bf" className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-4 hover:bg-accent/40">
                <FileUp className="size-5 text-muted-foreground" />
                <div className="text-[0.8125rem]">
                  {file ? (<><div className="font-medium">{file.name}</div>
                    <div className="text-success">{t("bulk.valid", { count: formatNumber(file.valid, locale) })}</div>
                    {file.invalid > 0 && <div className="text-warning">{t("bulk.invalid", { count: formatNumber(file.invalid, locale) })}</div>}</>)
                    : <span className="text-muted-foreground">{t("bulk.fileHint")}</span>}
                </div>
              </label>
              <input id="bf" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t px-4 py-3">
            {!file?.valid && <span className="text-caption">{t("bulk.noFile")}</span>}
            <Button size="sm" disabled={!canSubmit} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{t("bulk.submit")}
            </Button>
          </div>
        </Section>
        <Section title={t("bulk.jobs")}>
          <DataTable columns={columns} rows={jobs.data} loading={jobs.isLoading} rowKey={(j) => j.id} />
        </Section>
      </PageBody>
    </>
  );
}
