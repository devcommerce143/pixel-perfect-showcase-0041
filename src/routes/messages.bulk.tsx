import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkMutations, queries } from "@/lib/api/queries";
import type { BulkJob, BulkJobSortField, BulkRecipient, Channel, SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useI18n, type Locale, type MessageKey } from "@/lib/i18n/i18n";
import { renderTemplateVariables } from "@/lib/api/template-variables";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/bulk")({
  head: () => pageHead("Bulk Send", "Upload, validate and send bulk SMS, WhatsApp and Email jobs."),
  component: () => <RequirePermission permission="messages.bulk"><BulkSend /></RequirePermission>,
});

const PHONE = /^\+?[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskRecipient(value: string) {
  if (!value) return "";
  const separator = value.lastIndexOf("@");
  if (separator > 0) return `${value.slice(0, 1)}***${value.slice(separator)}`;
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const contents = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function JobProgress({ job, locale }: { job: BulkJob; locale: Locale }) {
  const completed = job.delivered + job.failed + (job.rejected ?? 0);
  const progressCount = job.status === "processing" ? job.sent ?? completed : completed;
  const pct = job.total ? Math.min(100, (progressCount / job.total) * 100) : 0;
  const tone = job.status === "completed" ? "bg-success" : job.status === "partial" ? "bg-warning" : job.status === "failed" ? "bg-danger" : job.status === "processing" ? "bg-info" : "bg-muted-foreground/40";
  return <div className="w-40"><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div><div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatNumber(progressCount, locale)} / {formatNumber(job.total, locale)}</div></div>;
}

function estimateSmsSegments(text: string) {
  const length = Array.from(text).length;
  const unicode = /\p{Script=Arabic}/u.test(text);
  const singleLimit = unicode ? 70 : 160;
  const multipartLimit = unicode ? 67 : 153;
  return length <= singleLimit ? 1 : Math.ceil(length / multipartLimit);
}

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
  const { user } = useSession();
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const { role: actorRole, tenantId: actorTenantId, userId: actorUserId, name: actorName } = actor;
  const isPlatform = actor.role === "super_admin";
  const qc = useQueryClient();
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatus, setJobStatus] = useState<BulkJob["status"] | "all">("all");
  const [jobChannel, setJobChannel] = useState<Channel | "all">("all");
  const [jobPage, setJobPage] = useState(1);
  const [jobPageSize, setJobPageSize] = useState<10 | 20 | 50>(10);
  const [jobSortBy, setJobSortBy] = useState<BulkJobSortField>("createdAt");
  const [jobSortDirection, setJobSortDirection] = useState<"asc" | "desc">("desc");
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const jobListQuery = {
    page: jobPage,
    pageSize: jobPageSize,
    search: jobSearch,
    filters: { ...(scopedTenantId ? { tenantId: scopedTenantId } : {}), channel: jobChannel, status: jobStatus },
    sortBy: jobSortBy,
    sortDirection: jobSortDirection,
  };
  const jobs = useQuery({
    ...queries.bulkJobs(actor, jobListQuery),
    refetchInterval: (query) => {
      const activeJob = query.state.data?.items?.find((job) => job.id === lastJobId);
      return activeJob && !["completed", "partial", "failed"].includes(activeJob.status) ? 1000 : false;
    },
  });
  const jobDetailQuery = useQuery({
    ...queries.bulkJob(actor, detailJobId ?? lastJobId ?? "", scopedTenantId),
    refetchInterval: (query) => {
      const currentJob = query.state.data;
      return currentJob && !["completed", "partial", "failed"].includes(currentJob.status) ? 1000 : false;
    },
  });
  const apps = useQuery(queries.applications(actor));
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [appId, setAppId] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: string[][]; firstRowNumber: number } | null>(null);
  const [recipientColumn, setRecipientColumn] = useState(0);
  const [variableColumns, setVariableColumns] = useState<Record<string, number>>({});
  const [suppressedRows, setSuppressedRows] = useState<number[]>([]);
  const [checkingSuppression, setCheckingSuppression] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const eligibleApplications = (apps.data ?? []).filter((app) => app.status === "active" && app.channels.includes(channel));
  const usageTenantId = isPlatform ? selectedTenantId ?? apps.data?.find((app) => app.id === appId)?.tenantId : undefined;
  const usage = useQuery(queries.usage(actor, usageTenantId));
  const senderIdentities = useQuery(queries.sendableSenderIdentities(actor, appId, channel));
  const templates = useQuery(queries.bulkTemplates(actor, appId, channel));

  useEffect(() => {
    if (!isPlatform) return;
    setJobPage(1);
    setDetailJobId(null);
    setLastJobId(null);
    setAppId("");
    setSenderIdentityId("");
    setTemplateId("");
    setFile(null);
  }, [isPlatform, selectedTenantId]);

  const onFile = async (f: File | undefined) => {
    if (!f) { setFile(null); setSuppressedRows([]); setCheckingSuppression(false); return; }
    setCheckingSuppression(!!appId);
    const rows = parseCsv(await f.text());
    const firstCell = rows[0]?.[0] ?? "";
    const firstLooksLikeAddress = channel === "email" ? EMAIL.test(firstCell) : PHONE.test(firstCell.replace(/\s/g, ""));
    const hasHeader = rows.length > 1 && !firstLooksLikeAddress;
    const headerRow = hasHeader ? rows[0]! : (rows[0] ?? []).map((_, index) => index === 0 ? "Recipient" : `Column ${index + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const target = headerRow.findIndex((header) => /recipient|phone|mobile|email|address/i.test(header));
    setFile({ name: f.name, headers: headerRow, rows: dataRows, firstRowNumber: hasHeader ? 2 : 1 });
    setRecipientColumn(target >= 0 ? target : 0);
    setVariableColumns({});
  };

  const selectedTemplate = (templates.data ?? []).find((template) => template.id === templateId);
  const variableNames = selectedTemplate?.variables ?? [];
  const sourceRows = file?.rows ?? [];
  const addressPattern = channel === "email" ? EMAIL : PHONE;
  const uniqueRecipients: BulkRecipient[] = [];
  const seen = new Set<string>();
  const validationIssues: { rowNumber: number; reasonKey: MessageKey; reason: string; recipient: string }[] = [];
  for (const [index, row] of sourceRows.entries()) {
    const recipient = row[recipientColumn]?.trim() ?? "";
    const rowNumber = (file?.firstRowNumber ?? 1) + index;
    if (!row.some(Boolean)) continue;
    if (!recipient) { validationIssues.push({ rowNumber, reasonKey: "bulk.issueMissingRecipient", reason: t("bulk.issueMissingRecipient"), recipient }); continue; }
    const normalized = recipient.replace(/\s/g, "").toLowerCase();
    if (!addressPattern.test(recipient.replace(/\s/g, ""))) { const reasonKey = channel === "email" ? "bulk.issueInvalidEmail" : "bulk.issueInvalidPhone"; validationIssues.push({ rowNumber, reasonKey, reason: t(reasonKey), recipient }); continue; }
    if (seen.has(normalized)) { validationIssues.push({ rowNumber, reasonKey: "bulk.issueDuplicate", reason: t("bulk.issueDuplicate"), recipient }); continue; }
    seen.add(normalized);
    const variables = Object.fromEntries(variableNames.map((key) => [key, row[variableColumns[key] ?? -1]?.trim() ?? ""]));
    const missingVariable = Object.entries(variables).find(([, value]) => !value)?.[0];
    if (missingVariable) { validationIssues.push({ rowNumber, reasonKey: "bulk.issueMissingVariable", reason: t("bulk.issueMissingVariable", { name: missingVariable }), recipient }); continue; }
    if (suppressedRows.includes(rowNumber)) { validationIssues.push({ rowNumber, reasonKey: "bulk.issueSuppressed", reason: t("bulk.issueSuppressed"), recipient }); continue; }
    uniqueRecipients.push({
      recipient,
      variables,
    });
  }
  const totalCount = sourceRows.filter((row) => row.some(Boolean)).length;
  const validCount = uniqueRecipients.length;
  const invalidCount = validationIssues.filter((issue) => issue.reasonKey !== "bulk.issueDuplicate" && issue.reasonKey !== "bulk.issueSuppressed").length;
  const duplicateCount = validationIssues.filter((issue) => issue.reasonKey === "bulk.issueDuplicate").length;
  const suppressedCount = validationIssues.filter((issue) => issue.reasonKey === "bulk.issueSuppressed").length;
  const smsSegments = channel === "sms" ? uniqueRecipients.reduce((sum, recipient) => {
    const rendered = selectedTemplate ? renderTemplateVariables(selectedTemplate.body, recipient.variables) : " ";
    return sum + estimateSmsSegments(rendered);
  }, 0) : 0;
  const fieldOptions = file?.headers.map((header, index) => ({ value: String(index), label: header || `Column ${index + 1}` })) ?? [];
  const allVariablesMapped = variableNames.every((key) => variableColumns[key] !== undefined && variableColumns[key] >= 0 && variableColumns[key] < (file?.headers.length ?? 0));
  const job = (jobDetailQuery.data?.id === lastJobId ? jobDetailQuery.data : undefined) ?? jobs.data?.items?.find((item) => item.id === lastJobId);
  const detailJob = detailJobId ? (jobDetailQuery.data?.id === detailJobId ? jobDetailQuery.data : jobs.data?.items?.find((item) => item.id === detailJobId) ?? null) : null;

  useEffect(() => {
    if (!file || !appId) { setSuppressedRows([]); setCheckingSuppression(false); return; }
    let current = true;
    setCheckingSuppression(true);
    const candidates = file.rows.flatMap((row, index) => {
      const recipient = row[recipientColumn]?.trim();
      return recipient ? [{ rowNumber: file.firstRowNumber + index, recipient }] : [];
    });
    void bulkMutations.checkSuppression({ role: actorRole, tenantId: actorTenantId, userId: actorUserId, name: actorName }, appId, candidates).then((rows) => { if (current) setSuppressedRows(rows); }).catch(() => { if (current) setSuppressedRows([]); }).finally(() => { if (current) setCheckingSuppression(false); });
    return () => { current = false; };
  }, [appId, file, recipientColumn, actorRole, actorTenantId, actorUserId, actorName]);

  const submit = useMutation({
    mutationFn: () => bulkMutations.createJob(actor, { name: name.trim(), channel, applicationId: appId, senderIdentityId, templateId: templateId || null, recipients: validCount, duplicates: duplicateCount, suppressed: suppressedCount, recipientRows: uniqueRecipients, estimatedUsage: channel === "sms" ? smsSegments : validCount, ...(channel === "sms" ? { estimatedSegments: smsSegments } : {}), idempotencyKey: crypto.randomUUID() }),
    onSuccess: async (created) => { toast.success(t("bulk.submitted", { id: created.id })); setLastJobId(created.id); setStep(5); await qc.invalidateQueries({ queryKey: ["bulkJobs"] }); },
    onError: () => setError(t("bulk.submitError")),
  });

  const needsTemplate = channel === "whatsapp";
  const setupValid = name.trim().length > 0 && appId.length > 0 && !!senderIdentityId && (!needsTemplate || templateId.length > 0);
  const recipientsValid = !!file && validCount > 0 && allVariablesMapped && !checkingSuppression;
  const terminalJob = job && ["completed", "partial", "failed"].includes(job.status);
  const downloadResults = (target: BulkJob | null | undefined = jobDetailQuery.data ?? job) => {
    if (!target?.results?.length) return;
    downloadCsv(`${target.id}-results.csv`, [["recipient", "status", "error"], ...target.results.map((result) => [result.recipient, result.status, result.errorMessage ?? ""])]);
  };
  const downloadValidationErrors = () => downloadCsv("bulk-validation-errors.csv", [["row", "reason"], ...validationIssues.map((issue) => [String(issue.rowNumber), issue.reason])]);
  const validationIssuePanel = validationIssues.length > 0 && <div className="space-y-3 rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{t("bulk.validationIssues")} ({validationIssues.length})</h4><Button variant="outline" size="sm" onClick={downloadValidationErrors}><Download className="size-4" />{t("bulk.downloadValidationErrors")}</Button></div><ul className="max-h-56 space-y-2 overflow-auto text-sm">{validationIssues.map((issue) => <li key={`${issue.rowNumber}-${issue.reasonKey}`} className="flex flex-wrap justify-between gap-x-4"><span>{t("bulk.validationRow", { row: issue.rowNumber })} â€” {issue.reason}</span>{issue.recipient && <span className="font-mono text-xs text-muted-foreground" dir="ltr">{maskRecipient(issue.recipient)}</span>}</li>)}</ul></div>;
  const downloadSample = () => {
    if (!selectedTemplate) return;
    const rows = [["recipient", ...variableNames], [channel === "email" ? "customer@example.test" : "+966500000001", ...variableNames.map((variable) => variable === "code" ? "123456" : `example_${variable}`)]];
    downloadCsv(`${selectedTemplate.name}-sample.csv`, rows);
  };

  const columns: Column<BulkJob>[] = [
    { id: "job", header: t("bulk.job"), cell: (j) => (<div><div className="font-medium">{j.name}</div><button type="button" className="font-mono text-xs text-primary underline underline-offset-2" aria-label={t("bulk.openJobDetails", { id: j.id })} onClick={(event) => { event.stopPropagation(); setDetailJobId(j.id); }}>{j.id}</button></div>) },
    { id: "ch", header: t("common.channel"), cell: (j) => <ChannelLabel channel={j.channel} /> },
    ...(isPlatform && !selectedTenantId ? [{ id: "tenant", header: t("common.tenant"), cell: (j: BulkJob) => j.tenantName ?? j.tenantId ?? t("common.notFound"), className: "hidden lg:table-cell" }] : []),
    { id: "app", header: t("common.application"), cell: (j) => j.applicationName, className: "hidden lg:table-cell" },
    { id: "status", header: <SortableHeader label={t("common.status")} field="status" sortBy={jobSortBy} sortDirection={jobSortDirection} onSort={() => { setJobSortDirection(jobSortBy === "status" ? (jobSortDirection === "asc" ? "desc" : "asc") : "asc"); setJobSortBy("status"); setJobPage(1); }} />, cell: (j) => <StatusBadge status={j.status} /> },
    { id: "prog", header: <SortableHeader label={t("bulk.progress")} field="progress" sortBy={jobSortBy} sortDirection={jobSortDirection} onSort={() => { setJobSortDirection(jobSortBy === "progress" ? (jobSortDirection === "asc" ? "desc" : "asc") : "desc"); setJobSortBy("progress"); setJobPage(1); }} />, cell: (j) => <JobProgress job={j} locale={locale} /> },
    { id: "by", header: <SortableHeader label={t("bulk.createdBy")} field="createdAt" sortBy={jobSortBy} sortDirection={jobSortDirection} onSort={() => { setJobSortDirection(jobSortBy === "createdAt" ? (jobSortDirection === "asc" ? "desc" : "asc") : "desc"); setJobSortBy("createdAt"); setJobPage(1); }} />, cell: (j) => (<div><div>{j.createdBy}</div><div className="text-xs tabular-nums text-muted-foreground">{formatDateTime(j.createdAt, locale)}</div></div>), className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader title={t(isPlatform ? "bulk.platformTitle" : "bulk.title")} description={t(isPlatform ? "bulk.platformSubtitle" : "bulk.subtitle")} />
      <PageBody>
        {!isPlatform && <Section title={t("bulk.newJob")}>
          <div className="flex flex-wrap gap-2 border-b px-4 py-3 text-xs">{["bulk.stepSetup", "bulk.stepRecipients", "bulk.stepValidation", "bulk.stepReview"].map((key, index) => <span key={key} className={step === index + 1 ? "font-semibold text-primary" : "text-muted-foreground"}>{index + 1}. {t(key as MessageKey)}</span>)}</div>
          {step === 1 && <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="bn">{t("bulk.jobName")}</Label><Input id="bn" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={channel} onValueChange={(value) => { setChannel(value as Channel); setFile(null); setAppId(""); setSenderIdentityId(""); setTemplateId(""); setVariableColumns({}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t("common.application")}</Label><Select value={appId} onValueChange={(value) => { setAppId(value); setSenderIdentityId(""); setTemplateId(""); setVariableColumns({}); setCheckingSuppression(!!file); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{eligibleApplications.filter((app) => app.scopes.includes("messages:send")).map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{t("bulk.senderIdentity")}</Label><Select value={senderIdentityId} onValueChange={setSenderIdentityId} disabled={!appId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(senderIdentities.data ?? []).map((identity) => <SelectItem key={identity.id} value={identity.id}>{identity.displayName || identity.identityValue}</SelectItem>)}</SelectContent></Select>{appId && !senderIdentities.isLoading && !senderIdentities.data?.length && <p className="text-caption text-warning">{t("bulk.noEligibleSender")}</p>}</div>
            <div className="space-y-1.5"><Label>{t("common.template")}</Label><Select value={templateId} onValueChange={(value) => { setTemplateId(value); setVariableColumns({}); }} disabled={!appId}><SelectTrigger><SelectValue placeholder={t("send.templateNone")} /></SelectTrigger><SelectContent>{(templates.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{needsTemplate && !templateId && <p className="text-caption">{t("bulk.templateRequired")}</p>}</div>
            <div className="flex justify-end md:col-span-2"><Button disabled={!setupValid || senderIdentities.isLoading || (needsTemplate && templates.isLoading)} onClick={() => setStep(2)}>{t("bulk.next")}</Button></div>
          </div>}
          {step === 2 && <div className="space-y-4 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="bf">{t("bulk.file")}</Label>
                <Button asChild variant="outline" size="sm">
                  <a href={selectedTemplate ? "#" : "/bulk-send-sample.csv"} onClick={selectedTemplate ? (event) => { event.preventDefault(); downloadSample(); } : undefined} download className="inline-flex items-center gap-2">
                    <Download className="size-4" />
                    {t("bulk.downloadSample")}
                  </a>
                </Button>
              </div>
              <label htmlFor="bf" className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-4 hover:bg-accent/40"><FileUp className="size-5 text-muted-foreground" /><div className="text-[0.8125rem]">{file ? <><div className="font-medium">{file.name}</div><div className="text-muted-foreground">{t("bulk.rowCount", { count: file.rows.length })}</div></> : <span className="text-muted-foreground">{t("bulk.fileHint")}</span>}</div></label>
              <input id="bf" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void onFile(event.target.files?.[0])} />
            </div>
            {file && <div className="space-y-4">
              <div className="space-y-1.5"><Label>{t("bulk.recipientColumn")}</Label><Select value={String(recipientColumn)} onValueChange={(value) => { setRecipientColumn(Number(value)); setCheckingSuppression(!!appId); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fieldOptions.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent></Select></div>
              {variableNames.length > 0 && <div className="space-y-3 border-t pt-3"><h3 className="text-sm font-semibold">{t("bulk.templateVariables")}</h3><div className="grid gap-4 md:grid-cols-2">{variableNames.map((variable) => <div key={variable} className="space-y-1.5"><Label>{t("bulk.mapVariable", { name: `{{${variable}}}` })}</Label><Select value={String(variableColumns[variable] ?? "")} onValueChange={(value) => setVariableColumns({ ...variableColumns, [variable]: Number(value) })}><SelectTrigger><SelectValue placeholder={t("bulk.selectColumn")} /></SelectTrigger><SelectContent>{fieldOptions.map((field) => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}</SelectContent></Select></div>)}</div></div>}
            </div>}
            {file && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div><div className="text-label">{t("common.total")}</div><div className="tabular-nums">{totalCount}</div></div><div><div className="text-label">{t("bulk.validCount")}</div><div className="tabular-nums text-success">{validCount}</div></div><div><div className="text-label">{t("bulk.invalidCount")}</div><div className="tabular-nums text-warning">{invalidCount}</div></div><div><div className="text-label">{t("bulk.duplicateCount")}</div><div className="tabular-nums">{duplicateCount}</div></div><div><div className="text-label">{t("bulk.suppressedCount")}</div><div className="tabular-nums">{suppressedCount}</div></div></div>}
            {validationIssuePanel}
            {checkingSuppression && <p className="text-caption">{t("bulk.checkingSuppression")}</p>}
            <div className="flex justify-between border-t pt-3"><Button variant="outline" onClick={() => setStep(1)}>{t("bulk.back")}</Button><Button disabled={!recipientsValid} onClick={() => setStep(3)}>{t("bulk.next")}</Button></div>
          </div>}
          {step === 3 && <div className="space-y-4 p-4"><h3 className="text-sm font-semibold">{t("bulk.validation")}</h3><dl className="grid gap-3 sm:grid-cols-3">{[["common.total", totalCount], ["bulk.validCount", validCount], ["bulk.invalidCount", invalidCount], ["bulk.duplicateCount", duplicateCount], ["bulk.suppressedCount", suppressedCount], ...(channel === "sms" ? [["bulk.estimatedSegments", smsSegments] as [string, number]] : [])].map(([label, value]) => <div key={String(label)} className="rounded-md border p-3"><dt className="text-label">{t(label as MessageKey)}</dt><dd className="mt-1 text-lg tabular-nums">{value}</dd></div>)}</dl>{validationIssuePanel}{checkingSuppression && <p className="text-caption">{t("bulk.checkingSuppression")}</p>}<div className="flex justify-between border-t pt-3"><Button variant="outline" onClick={() => setStep(2)}>{t("bulk.back")}</Button><Button disabled={!recipientsValid} onClick={() => setStep(4)}>{t("bulk.next")}</Button></div></div>}
          {step === 4 && <div className="space-y-4 p-4"><h3 className="text-sm font-semibold">{t("bulk.review")}</h3><dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-label">{t("bulk.jobName")}</dt><dd>{name}</dd></div><div><dt className="text-label">{t("common.channel")}</dt><dd>{t(`channel.${channel}`)}</dd></div><div><dt className="text-label">{t("common.application")}</dt><dd>{eligibleApplications.find((app) => app.id === appId)?.name}</dd></div><div><dt className="text-label">{t("bulk.senderIdentity")}</dt><dd>{senderIdentities.data?.find((identity) => identity.id === senderIdentityId)?.displayName || senderIdentities.data?.find((identity) => identity.id === senderIdentityId)?.identityValue}</dd></div><div><dt className="text-label">{t("common.template")}</dt><dd>{selectedTemplate?.name ?? t("send.templateNone")}</dd></div><div><dt className="text-label">{t("bulk.recipients")}</dt><dd className="tabular-nums">{formatNumber(validCount, locale)}</dd></div><div><dt className="text-label">{t("bulk.estimatedUsage")}</dt><dd className="tabular-nums">{formatNumber(channel === "sms" ? smsSegments : validCount, locale)} / {formatNumber(usage.data?.channels?.find((item) => item.channel === channel)?.limit ?? 0, locale)}</dd></div>{channel === "sms" && <div><dt className="text-label">{t("bulk.estimatedSegments")}</dt><dd className="tabular-nums">{formatNumber(smsSegments, locale)}</dd></div>}</dl>{selectedTemplate && <div className="rounded-md border bg-surface-subtle p-3 text-sm" dir={selectedTemplate.language === "ar" ? "rtl" : "ltr"}>{selectedTemplate.subject && <div className="mb-2 font-medium">{selectedTemplate.subject}</div>}{selectedTemplate.body}</div>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex justify-between border-t pt-3"><Button variant="outline" onClick={() => setStep(3)}>{t("bulk.back")}</Button><Button disabled={submit.isPending || !recipientsValid} onClick={() => { setError(""); submit.mutate(); }}>{submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{t("bulk.confirmSubmit")}</Button></div></div>}
        </Section>}
        <Section title={t("bulk.jobs")}>
          <TableToolbar search={jobSearch} onSearch={(value) => { setJobSearch(value); setJobPage(1); }} placeholder={t("bulk.searchJobs")}>
            <FilterSelect label={t("common.channel")} value={jobChannel} onChange={(value) => { setJobChannel(value as Channel | "all"); setJobPage(1); }} options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((item) => ({ value: item, label: t(`channel.${item}`) }))]} />
            <FilterSelect label={t("common.status")} value={jobStatus} onChange={(value) => { setJobStatus(value as BulkJob["status"] | "all"); setJobPage(1); }} options={[{ value: "all", label: t("common.allStatuses") }, ...(["scheduled", "queued", "processing", "completed", "partial", "failed"] as const).map((item) => ({ value: item, label: t(`status.${item}`) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={jobs.data?.items} loading={jobs.isFetching} rowKey={(j) => j.id} onRowClick={(selectedJob) => setDetailJobId(selectedJob.id)} />
          {jobs.data && <ListPagination page={jobs.data.page} pageSize={jobs.data.pageSize} total={jobs.data.total} onPage={setJobPage} onPageSizeChange={(size) => { setJobPageSize(size); setJobPage(1); }} />}
        </Section>
        {step === 5 && <Section title={terminalJob ? t("bulk.results") : t("bulk.processing")}>
          <div className="space-y-4 p-4"><div className="flex items-center gap-2"><StatusBadge status={job?.status ?? "processing"} />{!terminalJob && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>{job && <dl className="grid gap-3 sm:grid-cols-4"><div><dt className="text-label">{t("bulk.delivered")}</dt><dd className="tabular-nums">{formatNumber(job.delivered, locale)}</dd></div><div><dt className="text-label">{t("bulk.pendingCount")}</dt><dd className="tabular-nums">{formatNumber(job.pending ?? 0, locale)}</dd></div><div><dt className="text-label">{t("bulk.failedCount")}</dt><dd className="tabular-nums">{formatNumber(job.failed, locale)}</dd></div><div><dt className="text-label">{t("bulk.rejectedCount")}</dt><dd className="tabular-nums">{formatNumber(job.rejected ?? 0, locale)}</dd></div></dl>}{terminalJob && <Button variant="outline" onClick={() => downloadResults(job)} disabled={!job?.results?.length}><Download className="size-4" />{t("bulk.downloadResults")}</Button>}</div>
        </Section>}
        <Dialog open={!!detailJobId} onOpenChange={(open) => { if (!open) setDetailJobId(null); }}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>{t("bulk.jobDetails")}</DialogTitle><DialogDescription className="font-mono">{detailJob?.id}</DialogDescription></DialogHeader>
            {detailJob && <div className="space-y-5">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2"><div><dt className="text-label">{t("bulk.jobName")}</dt><dd>{detailJob.name}</dd></div>{isPlatform && !selectedTenantId && <div><dt className="text-label">{t("bulk.tenant")}</dt><dd>{detailJob.tenantName ?? detailJob.tenantId}</dd></div>}<div><dt className="text-label">{t("common.application")}</dt><dd>{detailJob.applicationName}</dd></div><div><dt className="text-label">{t("common.channel")}</dt><dd><ChannelLabel channel={detailJob.channel} /></dd></div><div><dt className="text-label">{t("bulk.senderIdentity")}</dt><dd>{detailJob.senderIdentityName ?? "â€”"}</dd></div><div><dt className="text-label">{t("common.template")}</dt><dd>{detailJob.templateName ?? t("send.templateNone")}</dd></div><div><dt className="text-label">{t("bulk.createdBy")}</dt><dd>{detailJob.createdBy}</dd></div><div><dt className="text-label">{t("bulk.createdAt")}</dt><dd>{formatDateTime(detailJob.createdAt, locale)}</dd></div><div><dt className="text-label">{t("bulk.currentStatus")}</dt><dd><StatusBadge status={detailJob.status} /></dd></div></dl>
              <div><div className="mb-2 text-label">{t("bulk.processingProgress")}</div><JobProgress job={detailJob} locale={locale} /></div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["bulk.totalRecipients", detailJob.total], ["bulk.validCount", detailJob.valid ?? detailJob.total], ["bulk.suppressedCount", detailJob.suppressed ?? 0], ["bulk.duplicateCount", detailJob.duplicates ?? 0], ["bulk.sent", detailJob.sent ?? detailJob.delivered + detailJob.failed + (detailJob.rejected ?? 0)], ["bulk.delivered", detailJob.delivered], ["bulk.failedCount", detailJob.failed], ["bulk.rejectedCount", detailJob.rejected ?? 0], ["bulk.estimatedUsage", detailJob.estimatedUsage ?? detailJob.total], ["bulk.actualUsage", detailJob.actualUsage], ...(detailJob.channel === "sms" ? [["bulk.estimatedSegments", detailJob.estimatedSegments ?? detailJob.total] as [string, number]] : [])].map(([key, value]) => <div key={String(key)} className="rounded-md border p-3"><dt className="text-label">{t(key as MessageKey)}</dt><dd className="mt-1 tabular-nums">{value === null || value === undefined ? "â€”" : formatNumber(Number(value), locale)}</dd></div>)}</dl>
              {detailJob.results?.length ? <Button variant="outline" onClick={() => downloadResults(detailJob)}><Download className="size-4" />{t("bulk.downloadResults")}</Button> : null}
            </div>}
          </DialogContent>
        </Dialog>
      </PageBody>
    </>
  );
}
