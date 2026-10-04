import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
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
import type { BulkJob, BulkRecipient, Channel } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/bulk")({
  head: () => pageHead("Bulk Send", "Upload, validate and send bulk SMS, WhatsApp and Email jobs."),
  component: () => <RequirePermission permission="messages.bulk"><BulkSend /></RequirePermission>,
});

const PHONE = /^\+?[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function BulkSend() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const jobs = useQuery({
    ...queries.bulkJobs(),
    refetchInterval: (query) => {
      const activeJob = query.state.data?.find((job) => job.id === lastJobId);
      return activeJob && !["completed", "partial", "failed"].includes(activeJob.status) ? 1000 : false;
    },
  });
  const apps = useQuery(queries.applications());
  const templates = useQuery(queries.templates({ status: "approved" }));
  const usage = useQuery(queries.usage());
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [appId, setAppId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: string[][] } | null>(null);
  const [recipientColumn, setRecipientColumn] = useState(0);
  const [variableColumns, setVariableColumns] = useState<Record<string, number>>({});
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const onFile = async (f: File | undefined) => {
    if (!f) { setFile(null); return; }
    const rows = parseCsv(await f.text());
    const firstCell = rows[0]?.[0] ?? "";
    const firstLooksLikeAddress = channel === "email" ? EMAIL.test(firstCell) : PHONE.test(firstCell.replace(/\s/g, ""));
    const hasHeader = rows.length > 1 && !firstLooksLikeAddress;
    const headerRow = hasHeader ? rows[0]! : (rows[0] ?? []).map((_, index) => index === 0 ? "Recipient" : `Column ${index + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const target = headerRow.findIndex((header) => /recipient|phone|mobile|email|address/i.test(header));
    setFile({ name: f.name, headers: headerRow, rows: dataRows });
    setRecipientColumn(target >= 0 ? target : 0);
    setVariableColumns({});
  };

  const selectedTemplate = (templates.data?.items ?? []).find((template) => template.id === templateId);
  const variableNames = Array.from(new Set(selectedTemplate?.body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)?.map((match) => match.replace(/[{}\s]/g, "")) ?? []));
  const sourceRows = file?.rows ?? [];
  const addressPattern = channel === "email" ? EMAIL : PHONE;
  const uniqueRecipients: BulkRecipient[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;
  for (const row of sourceRows) {
    const recipient = row[recipientColumn]?.trim() ?? "";
    if (!recipient) { if (row.some(Boolean)) invalidCount++; continue; }
    const normalized = recipient.replace(/\s/g, "").toLowerCase();
    if (!addressPattern.test(recipient.replace(/\s/g, ""))) { invalidCount++; continue; }
    if (seen.has(normalized)) { duplicateCount++; continue; }
    seen.add(normalized);
    const variables = Object.fromEntries(variableNames.map((key) => [key, row[variableColumns[key] ?? -1]?.trim() ?? ""]));
    if (Object.values(variables).some((value) => !value)) { invalidCount++; continue; }
    uniqueRecipients.push({
      recipient,
      variables,
    });
  }
  const totalCount = sourceRows.filter((row) => row.some(Boolean)).length;
  const validCount = uniqueRecipients.length;
  const suppressedCount = 0;
  const smsSegments = channel === "sms" ? validCount * Math.max(1, Math.ceil((selectedTemplate?.body.length ?? 1) / 160)) : 0;
  const fieldOptions = file?.headers.map((header, index) => ({ value: String(index), label: header || `Column ${index + 1}` })) ?? [];
  const allVariablesMapped = variableNames.every((key) => variableColumns[key] !== undefined);
  const job = jobs.data?.find((item) => item.id === lastJobId);

  const submit = useMutation({
    mutationFn: () => api.createBulkJob({ name: name.trim(), channel, applicationId: appId, templateId: templateId || null, recipients: validCount, recipientRows: uniqueRecipients, idempotencyKey: crypto.randomUUID() }),
    onSuccess: async (created) => { toast.success(t("bulk.submitted", { id: created.id })); setLastJobId(created.id); setStep(5); await qc.invalidateQueries({ queryKey: ["bulkJobs"] }); },
    onError: () => setError(t("bulk.submitError")),
  });

  const needsTemplate = channel === "whatsapp";
  const setupValid = name.trim().length > 0 && appId.length > 0 && (!needsTemplate || templateId.length > 0);
  const recipientsValid = !!file && validCount > 0 && allVariablesMapped;
  const terminalJob = job && ["completed", "partial", "failed"].includes(job.status);
  const downloadResults = () => {
    if (!job?.results?.length) return;
    const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const contents = ["recipient,status,error", ...job.results.map((result) => [result.recipient, result.status, result.errorMessage ?? ""].map(csvCell).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${job.id}-results.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<BulkJob>[] = [
    { id: "job", header: t("bulk.job"), cell: (j) => (<div><div className="font-medium">{j.name}</div><div className="font-mono text-xs text-muted-foreground">{j.id}</div></div>) },
    { id: "ch", header: t("common.channel"), cell: (j) => <ChannelLabel channel={j.channel} /> },
    { id: "app", header: t("common.application"), cell: (j) => j.applicationName, className: "hidden lg:table-cell" },
    { id: "status", header: t("common.status"), cell: (j) => <StatusBadge status={j.status} /> },
    { id: "prog", header: t("bulk.progress"), cell: (j) => {
      const pct = j.total ? ((j.delivered + j.failed + (j.rejected ?? 0)) / j.total) * 100 : 0;
      return <div className="w-40"><QuotaBar pct={pct} /><div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatNumber(j.delivered + j.failed, locale)} / {formatNumber(j.total, locale)}</div></div>;
    } },
    { id: "by", header: t("bulk.createdBy"), cell: (j) => (<div><div>{j.createdBy}</div><div className="text-xs tabular-nums text-muted-foreground">{formatDateTime(j.createdAt, locale)}</div></div>), className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader title={t("bulk.title")} description={t("bulk.subtitle")} />
      <PageBody>
        <Section title={t("bulk.newJob")}>
          <div className="flex flex-wrap gap-2 border-b px-4 py-3 text-xs">{["bulk.stepSetup", "bulk.stepRecipients", "bulk.stepValidation", "bulk.stepReview"].map((key, index) => <span key={key} className={step === index + 1 ? "font-semibold text-primary" : "text-muted-foreground"}>{index + 1}. {t(key as MessageKey)}</span>)}</div>
          {step === 1 && <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="bn">{t("bulk.jobName")}</Label><Input id="bn" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={channel} onValueChange={(value) => { setChannel(value as Channel); setFile(null); setAppId(""); setTemplateId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t("common.application")}</Label><Select value={appId} onValueChange={setAppId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(apps.data ?? []).filter((app) => app.status === "active" && app.channels.includes(channel)).map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t("common.template")}</Label><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(templates.data?.items ?? []).filter((item) => item.channel === channel).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{needsTemplate && !templateId && <p className="text-caption">{t("bulk.templateRequired")}</p>}</div>
            <div className="flex justify-end md:col-span-2"><Button disabled={!setupValid} onClick={() => setStep(2)}>{t("bulk.next")}</Button></div>
          </div>}
          {step === 2 && <div className="space-y-4 p-4">
            <div className="space-y-1.5"><Label htmlFor="bf">{t("bulk.file")}</Label><label htmlFor="bf" className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-4 hover:bg-accent/40"><FileUp className="size-5 text-muted-foreground" /><div className="text-[0.8125rem]">{file ? <><div className="font-medium">{file.name}</div><div className="text-muted-foreground">{t("bulk.rowCount", { count: file.rows.length })}</div></> : <span className="text-muted-foreground">{t("bulk.fileHint")}</span>}</div></label><input id="bf" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void onFile(event.target.files?.[0])} /></div>
            {file && <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>{t("bulk.recipientColumn")}</Label><Select value={String(recipientColumn)} onValueChange={(value) => setRecipientColumn(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fieldOptions.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent></Select></div>
              {variableNames.map((variable) => <div key={variable} className="space-y-1.5"><Label>{t("bulk.mapVariable", { name: variable })}</Label><Select value={String(variableColumns[variable] ?? "")} onValueChange={(value) => setVariableColumns({ ...variableColumns, [variable]: Number(value) })}><SelectTrigger><SelectValue placeholder={t("bulk.selectColumn")} /></SelectTrigger><SelectContent>{fieldOptions.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent></Select></div>)}</div>}
            {file && <div className="grid gap-3 sm:grid-cols-4"><div><div className="text-label">{t("common.total")}</div><div className="tabular-nums">{totalCount}</div></div><div><div className="text-label">{t("bulk.validCount")}</div><div className="tabular-nums text-success">{validCount}</div></div><div><div className="text-label">{t("bulk.invalidCount")}</div><div className="tabular-nums text-warning">{invalidCount}</div></div><div><div className="text-label">{t("bulk.duplicateCount")}</div><div className="tabular-nums">{duplicateCount}</div></div></div>}
            <div className="flex justify-between border-t pt-3"><Button variant="outline" onClick={() => setStep(1)}>{t("bulk.back")}</Button><Button disabled={!recipientsValid} onClick={() => setStep(3)}>{t("bulk.next")}</Button></div>
          </div>}
          {step === 3 && <div className="space-y-4 p-4"><h3 className="text-sm font-semibold">{t("bulk.validation")}</h3><dl className="grid gap-3 sm:grid-cols-3">{[["common.total", totalCount], ["bulk.validCount", validCount], ["bulk.invalidCount", invalidCount], ["bulk.duplicateCount", duplicateCount], ["bulk.suppressedCount", suppressedCount], ["bulk.estimatedSegments", smsSegments]].map(([label, value]) => <div key={String(label)} className="rounded-md border p-3"><dt className="text-label">{t(label as MessageKey)}</dt><dd className="mt-1 text-lg tabular-nums">{value}</dd></div>)}</dl><div className="flex justify-between border-t pt-3"><Button variant="outline" onClick={() => setStep(2)}>{t("bulk.back")}</Button><Button onClick={() => setStep(4)}>{t("bulk.next")}</Button></div></div>}
          {step === 4 && <div className="space-y-4 p-4"><h3 className="text-sm font-semibold">{t("bulk.review")}</h3><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-label">{t("bulk.jobName")}</dt><dd>{name}</dd></div><div><dt className="text-label">{t("common.channel")}</dt><dd>{t(`channel.${channel}`)}</dd></div><div><dt className="text-label">{t("common.application")}</dt><dd>{apps.data?.find((app) => app.id === appId)?.name}</dd></div><div><dt className="text-label">{t("common.template")}</dt><dd>{selectedTemplate?.name ?? t("send.templateNone")}</dd></div><div><dt className="text-label">{t("bulk.recipients")}</dt><dd className="tabular-nums">{formatNumber(validCount, locale)}</dd></div><div><dt className="text-label">{t("bulk.estimatedUsage")}</dt><dd className="tabular-nums">{formatNumber(channel === "sms" ? smsSegments : validCount, locale)} / {formatNumber(usage.data?.channels.find((item) => item.channel === channel)?.limit ?? 0, locale)}</dd></div></dl>{selectedTemplate && <div className="rounded-md border bg-surface-subtle p-3 text-sm" dir={selectedTemplate.language === "ar" ? "rtl" : "ltr"}>{selectedTemplate.body}</div>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex justify-between border-t pt-3"><Button variant="outline" onClick={() => setStep(3)}>{t("bulk.back")}</Button><Button disabled={submit.isPending} onClick={() => { setError(""); submit.mutate(); }}>{submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{t("bulk.confirmSubmit")}</Button></div></div>}
        </Section>
        <Section title={t("bulk.jobs")}>
          <DataTable columns={columns} rows={jobs.data} loading={jobs.isLoading} rowKey={(j) => j.id} />
        </Section>
        {step === 5 && <Section title={terminalJob ? t("bulk.results") : t("bulk.processing")}>
          <div className="space-y-4 p-4"><div className="flex items-center gap-2"><StatusBadge status={job?.status ?? "processing"} />{!terminalJob && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>{job && <dl className="grid gap-3 sm:grid-cols-4"><div><dt className="text-label">{t("bulk.delivered")}</dt><dd className="tabular-nums">{formatNumber(job.delivered, locale)}</dd></div><div><dt className="text-label">{t("bulk.pendingCount")}</dt><dd className="tabular-nums">{formatNumber(job.pending ?? 0, locale)}</dd></div><div><dt className="text-label">{t("bulk.failedCount")}</dt><dd className="tabular-nums">{formatNumber(job.failed, locale)}</dd></div><div><dt className="text-label">{t("bulk.rejectedCount")}</dt><dd className="tabular-nums">{formatNumber(job.rejected ?? 0, locale)}</dd></div></dl>}{terminalJob && <Button variant="outline" onClick={downloadResults} disabled={!job?.results?.length}><Download className="size-4" />{t("bulk.downloadResults")}</Button>}</div>
        </Section>}
      </PageBody>
    </>
  );
}
