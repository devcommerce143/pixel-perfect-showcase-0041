import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, ListPagination, SortableHeader, TableToolbar, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { queries, templateMutations } from "@/lib/api/queries";
import type { Channel, SenderIdentityActor, Template, TemplateSortField, TemplateStatus } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { extractTemplateVariables, hasMalformedTemplateVariables } from "@/lib/api/template-variables";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/templates")({
  head: () => pageHead("Templates", "Versioned, approval-controlled message templates for SMS, WhatsApp and Email."),
  component: () => <RequirePermission permission="templates.view"><Templates /></RequirePermission>,
});

function Templates() {
  const { t, locale, dir } = useI18n();
  const { user, can } = useSession();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const isPlatform = actor.role === "super_admin";
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const canManageTemplates = actor.role === "client_admin" && can("templates.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState<TemplateStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<TemplateSortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Template | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<TemplateStatus | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", channel: "sms" as Channel, category: "Transactional" as Template["category"], language: "en" as Template["language"], subject: "", body: "" });
  const tenants = useQuery({ ...queries.tenants({ pageSize: 100, filters: { status: "active" } }), enabled: isPlatform });
  const tenantNames = new Map((tenants.data?.items ?? []).map((tenant) => [tenant.id, tenant.name]));
  const listQuery = { page, pageSize, search, filters: { channel: channel as Channel | "all", status, ...(scopedTenantId ? { tenantId: scopedTenantId } : {}) }, sortBy, sortDirection };
  const q = useQuery(queries.templates(listQuery, actor));
  useEffect(() => { setPage(1); setSelected(null); }, [selectedTenantId]);
  const toggleSort = (field: TemplateSortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : field === "name" || field === "channel" ? "asc" : "desc");
    setSortBy(field);
    setPage(1);
  };
  const save = useMutation({
    mutationFn: () => {
      const input = { name: draft.name.trim(), channel: draft.channel, category: draft.category, language: draft.language, subject: draft.channel === "email" ? draft.subject.trim() : null, body: draft.body.trim() };
      return editingId ? templateMutations.update(actor, editingId, input) : templateMutations.create(actor, input);
    },
    onSuccess: async (template) => {
      toast.success(t(editingId ? "tpl.updated" : "tpl.created"));
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      setCreateOpen(false);
      setError("");
      setSelected(template);
    },
    onError: () => setError(t("tpl.nameExists")),
  });
  const submitApproval = useMutation({
    mutationFn: (id: string) => templateMutations.submitForApproval(actor, id),
    onSuccess: async (template) => {
      toast.success(t("tpl.submitted"));
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      setSelected(template);
    },
    onError: () => toast.error(t("tpl.submitError")),
  });
  const activate = useMutation({
    mutationFn: (id: string) => templateMutations.activate(actor, id),
    onSuccess: async (template) => { toast.success(t("tpl.activated")); await queryClient.invalidateQueries({ queryKey: ["templates"] }); setSelected(template); },
    onError: () => toast.error(t("tpl.lifecycleError")),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => templateMutations.deactivate(actor, id),
    onSuccess: async (template) => { toast.success(t("tpl.deactivated")); await queryClient.invalidateQueries({ queryKey: ["templates"] }); setSelected(template); },
    onError: () => toast.error(t("tpl.lifecycleError")),
  });
  const validName = /^[a-zA-Z0-9_-]{2,64}$/.test(draft.name.trim());
  const draftVariables = extractTemplateVariables(draft.subject, draft.body);
  const malformedVariables = hasMalformedTemplateVariables(draft.subject, draft.body);
  const valid = validName && draft.body.trim().length > 0 && (draft.channel !== "email" || draft.subject.trim().length > 0) && !malformedVariables;
  const unicodeSms = Array.from(draft.body).some((character) => character.charCodeAt(0) > 0x7f);
  const segmentLength = unicodeSms ? 70 : 160;
  const smsSegments = Math.max(1, Math.ceil(draft.body.length / segmentLength));
  const openCreate = () => { setEditingId(null); setEditingStatus(null); setDraft({ name: "", channel: "sms", category: "Transactional", language: locale, subject: "", body: "" }); setTouched(false); setError(""); setCreateOpen(true); };
  const openEdit = (template: Template) => { setSelected(null); setEditingId(template.id); setEditingStatus(template.status); setDraft({ name: template.name, channel: template.channel, category: template.category, language: template.language, subject: template.subject ?? "", body: template.body }); setTouched(false); setError(""); setCreateOpen(true); };
  const duplicate = (template: Template) => { setSelected(null); setEditingId(null); setEditingStatus(null); setDraft({ name: `${template.name}_copy`, channel: template.channel, category: template.category, language: template.language, subject: template.subject ?? "", body: template.body }); setTouched(false); setError(""); setCreateOpen(true); };

  const columns: Column<Template>[] = [
    { id: "name", header: <SortableHeader label={t("common.name")} field="name" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("name")} />, cell: (r) => <span className="font-mono text-xs font-medium">{r.name}</span> },
    ...(isPlatform && !selectedTenantId ? [{ id: "tenant", header: t("common.tenant"), cell: (r: Template) => tenantNames.get(r.tenantId ?? "") ?? r.tenantName ?? r.tenantId, className: "hidden lg:table-cell" }] : []),
    { id: "channel", header: <SortableHeader label={t("common.channel")} field="channel" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("channel")} />, cell: (r) => <ChannelLabel channel={r.channel} /> },
    { id: "category", header: t("common.category"), cell: (r) => r.category, className: "hidden md:table-cell" },
    { id: "lang", header: t("common.language"), cell: (r) => r.language.toUpperCase() },
    { id: "version", header: t("common.version"), cell: (r) => <span className="tabular-nums">v{r.version}</span> },
    { id: "status", header: <SortableHeader label={t("common.status")} field="status" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("status")} />, cell: (r) => <StatusBadge status={r.status} /> },
    { id: "updated", header: <SortableHeader label={t("common.updatedAt")} field="updatedAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("updatedAt")} />, cell: (r) => <span className="text-muted-foreground">{formatDate(r.updatedAt, locale)}</span> },
  ];

  return (
    <>
      <PageHeader title={t("tpl.title")} description={t("tpl.subtitle")}
        actions={canManageTemplates && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("tpl.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} placeholder={t("tpl.search")}>
            <FilterSelect label={t("common.channel")} value={channel} onChange={(value) => { setChannel(value); setPage(1); }}
              options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((c) => ({ value: c, label: t(`channel.${c}`) }))]} />
            <FilterSelect label={t("common.status")} value={status} onChange={(value) => { setStatus(value as TemplateStatus | "all"); setPage(1); }}
              options={[{ value: "all", label: t("common.allStatuses") }, ...["active", "inactive", "draft", "pending_approval", "approved", "rejected"].map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(r) => r.id} onRowClick={setSelected} />
          {q.data && <ListPagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </Section>
      </PageBody>
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-base">{selected.name}</SheetTitle>
                <SheetDescription>{selected.id} · v{selected.version} · {selected.category}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {isPlatform && !selectedTenantId && <div><dt className="text-label">{t("tpl.tenant")}</dt><dd>{tenantNames.get(selected.tenantId ?? "") ?? selected.tenantName ?? selected.tenantId}</dd></div>}
                  <div><dt className="text-label">{t("common.channel")}</dt><dd><ChannelLabel channel={selected.channel} /></dd></div>
                  <div><dt className="text-label">{t("common.category")}</dt><dd>{t(`tpl.category.${selected.category}` as MessageKey)}</dd></div>
                  <div><dt className="text-label">{t("common.language")}</dt><dd>{selected.language.toUpperCase()}</dd></div>
                  <div><dt className="text-label">{t("common.version")}</dt><dd>v{selected.version}</dd></div>
                  <div><dt className="text-label">{t("common.status")}</dt><dd><StatusBadge status={selected.status} /></dd></div>
                  {selected.createdAt && <div><dt className="text-label">{t("tpl.createdAt")}</dt><dd>{formatDate(selected.createdAt, locale)}</dd></div>}
                  <div><dt className="text-label">{t("common.updatedAt")}</dt><dd>{formatDate(selected.updatedAt, locale)}</dd></div>
                  {selected.updatedBy && <div><dt className="text-label">{t("tpl.updatedBy")}</dt><dd>{selected.updatedBy}</dd></div>}
                </dl>
                <div>
                  <div className="text-label mb-1.5">{t("tpl.preview")}</div>
                  <div className="rounded-md border bg-surface-subtle p-3 text-body" dir={selected.language === "ar" ? "rtl" : "ltr"}>
                    {selected.channel === "email" && selected.subject && <div className="mb-2 font-medium">{selected.subject}</div>}
                    <div>{selected.body}</div>
                  </div>
                </div>
                <div><div className="text-label mb-1.5">{t("tpl.variables")}</div>{(selected.variables ?? []).length ? <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs" dir="ltr">{selected.variables?.map((variable) => <li key={variable}>{`{{${variable}}}`}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("tpl.noVariables")}</p>}</div>
                {selected.channel === "whatsapp" && <div className="space-y-2 border-t pt-3"><h3 className="text-label">{t("tpl.approval")}</h3><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-label">{t("tpl.approvalProvider")}</dt><dd>{selected.approval?.provider ?? "Meta Cloud API"}</dd></div><div><dt className="text-label">{t("common.status")}</dt><dd>{selected.status === "pending_approval" ? t("status.pending_approval") : t(`status.${selected.approval?.status ?? selected.status}` as MessageKey)}</dd></div></dl>{selected.status === "pending_approval" && <p className="text-sm text-warning">{t("tpl.approvalPending")}</p>}{selected.approval?.rejectionReason && <p className="text-sm"><span className="text-label">{t("tpl.rejectionReason")}: </span>{selected.approval.rejectionReason}</p>}</div>}
                <div className="space-y-2 border-t pt-3"><h3 className="text-label">{t("tpl.versionHistory")}</h3>{selected.versionHistory?.length ? <ol className="space-y-3">{[...selected.versionHistory].reverse().map((version) => <li key={version.version} className="border-s-2 ps-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">v{version.version}</span><StatusBadge status={version.status} /><span className="text-xs text-muted-foreground">{formatDate(version.updatedAt, locale)}</span></div><div className="mt-1 text-xs" dir={selected.language === "ar" ? "rtl" : "ltr"}>{version.subject && <div className="font-medium">{version.subject}</div>}{version.body}</div>{version.approval?.rejectionReason && <p className="mt-1 text-xs text-warning">{version.approval.rejectionReason}</p>}</li>)}</ol> : <p className="text-sm text-muted-foreground">{t("tpl.noHistory")}</p>}</div>
                {canManageTemplates && <div className="flex flex-wrap gap-2 border-t pt-4">{selected.status !== "pending_approval" && <Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button>}{selected.channel === "whatsapp" && selected.status === "draft" && <Button disabled={submitApproval.isPending} onClick={() => submitApproval.mutate(selected.id)}>{t("tpl.submitApproval")}</Button>}{selected.channel !== "whatsapp" && selected.status === "active" && <Button variant="outline" disabled={deactivate.isPending} onClick={() => deactivate.mutate(selected.id)}>{t("tpl.deactivate")}</Button>}{selected.channel !== "whatsapp" && (selected.status === "draft" || selected.status === "inactive") && <Button disabled={activate.isPending} onClick={() => activate.mutate(selected.id)}>{t("tpl.activate")}</Button>}<Button variant="outline" onClick={() => duplicate(selected)}>{t("tpl.duplicate")}</Button></div>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={createOpen} onOpenChange={(value) => !save.isPending && setCreateOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{t(editingId ? "tpl.edit" : "tpl.new")}</SheetTitle><SheetDescription>{t(editingId ? "tpl.editDescription" : "tpl.createDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid) save.mutate(); }} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="template-name">{t("tpl.name")} *</Label><Input id="template-name" dir="ltr" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={touched && !validName} />{touched && !validName && <p className="text-xs text-danger">{t("tpl.invalidName")}</p>}</div>
              <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={draft.channel} onValueChange={(value) => setDraft({ ...draft, channel: value as Channel, subject: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("common.category")}</Label><Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value as Template["category"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["Authentication", "Transactional", "Notification", "Marketing"] as const).map((item) => <SelectItem key={item} value={item}>{t(`tpl.category.${item}` as MessageKey)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("common.language")}</Label><Select value={draft.language} onValueChange={(value) => setDraft({ ...draft, language: value as Template["language"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
            </div>
            {draft.channel === "email" && <div className="space-y-1.5"><Label htmlFor="template-subject">{t("send.subject")} *</Label><Input id="template-subject" dir="auto" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} aria-invalid={touched && !draft.subject.trim()} /></div>}
            <div className="space-y-1.5"><Label htmlFor="template-body">{t("send.body")} *</Label><Textarea id="template-body" dir="auto" rows={7} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} aria-invalid={touched && (!draft.body.trim() || malformedVariables)} />{touched && !draft.body.trim() && <p className="text-xs text-danger">{t("tpl.bodyRequired")}</p>}{touched && malformedVariables && <p className="text-xs text-danger">{t("tpl.malformedVariables")}</p>}</div>
            <div><div className="mb-1.5 text-label">{t("tpl.variables")}</div>{draftVariables.length ? <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs" dir="ltr">{draftVariables.map((variable) => <li key={variable}>{`{{${variable}}}`}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("tpl.noVariables")}</p>}</div>
            {draft.channel === "sms" && <p className="text-xs text-muted-foreground">{t("tpl.smsEstimate", { count: smsSegments, encoding: t(unicodeSms ? "tpl.unicode" : "tpl.gsm") })}</p>}
            {draft.channel === "whatsapp" && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">{t("tpl.whatsappPending")}</p>}
            {editingStatus === "active" && <p className="rounded-md border bg-surface-subtle p-3 text-sm">{t("tpl.versionUpdateNotice")}</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "common.create")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
