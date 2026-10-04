import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, TableToolbar, type Column } from "@/components/app/DataTable";
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
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, Template } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/templates")({
  head: () => pageHead("Templates", "Versioned, approval-controlled message templates for SMS, WhatsApp and Email."),
  component: () => <RequirePermission permission="templates.view"><Templates /></RequirePermission>,
});

function Templates() {
  const { t, locale, dir } = useI18n();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Template | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", channel: "sms" as Channel, category: "Transactional" as Template["category"], language: "en" as Template["language"], subject: "", body: "" });
  const q = useQuery(queries.templates({ search, channel: channel as Channel | "all", status }));
  const save = useMutation({
    mutationFn: () => {
      const input = { name: draft.name.trim(), channel: draft.channel, category: draft.category, language: draft.language, subject: draft.channel === "email" ? draft.subject.trim() : null, body: draft.body.trim() };
      return editingId ? api.updateTemplate(editingId, input) : api.createTemplate(input);
    },
    onSuccess: async (template) => {
      toast.success(t(editingId ? "tpl.updated" : template.channel === "whatsapp" ? "tpl.submitted" : "tpl.created"));
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      setCreateOpen(false);
      setError("");
      setSelected(template);
    },
    onError: () => setError(t("tpl.nameExists")),
  });
  const validName = /^[a-zA-Z0-9_-]{2,64}$/.test(draft.name.trim());
  const valid = validName && draft.body.trim().length > 0 && (draft.channel !== "email" || draft.subject.trim().length > 0);
  const unicodeSms = Array.from(draft.body).some((character) => character.charCodeAt(0) > 0x7f);
  const segmentLength = unicodeSms ? 70 : 160;
  const smsSegments = Math.max(1, Math.ceil(draft.body.length / segmentLength));
  const openCreate = () => { setEditingId(null); setDraft({ name: "", channel: "sms", category: "Transactional", language: locale, subject: "", body: "" }); setTouched(false); setError(""); setCreateOpen(true); };
  const openEdit = (template: Template) => { setSelected(null); setEditingId(template.id); setDraft({ name: template.name, channel: template.channel, category: template.category, language: template.language, subject: template.subject ?? "", body: template.body }); setTouched(false); setError(""); setCreateOpen(true); };
  const duplicate = (template: Template) => { setSelected(null); setEditingId(null); setDraft({ name: `${template.name}_copy`, channel: template.channel, category: template.category, language: template.language, subject: template.subject ?? "", body: template.body }); setTouched(false); setError(""); setCreateOpen(true); };

  const columns: Column<Template>[] = [
    { id: "name", header: t("common.name"), cell: (r) => <span className="font-mono text-xs font-medium">{r.name}</span> },
    { id: "channel", header: t("common.channel"), cell: (r) => <ChannelLabel channel={r.channel} /> },
    { id: "category", header: t("common.category"), cell: (r) => r.category, className: "hidden md:table-cell" },
    { id: "lang", header: t("common.language"), cell: (r) => r.language.toUpperCase() },
    { id: "version", header: t("common.version"), cell: (r) => <span className="tabular-nums">v{r.version}</span> },
    { id: "status", header: t("common.status"), cell: (r) => <StatusBadge status={r.status} /> },
    { id: "updated", header: t("common.updatedAt"), cell: (r) => <span className="text-muted-foreground">{formatDate(r.updatedAt, locale)}</span> },
  ];

  return (
    <>
      <PageHeader title={t("tpl.title")} description={t("tpl.subtitle")}
        actions={can("templates.manage") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("tpl.new")}</Button>} />
      <PageBody>
        <Section>
          <TableToolbar search={search} onSearch={setSearch} placeholder={t("tpl.search")}>
            <FilterSelect label={t("common.channel")} value={channel} onChange={setChannel}
              options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((c) => ({ value: c, label: t(`channel.${c}`) }))]} />
            <FilterSelect label={t("common.status")} value={status} onChange={setStatus}
              options={[{ value: "all", label: t("common.allStatuses") }, ...["approved", "pending", "rejected", "draft"].map((s) => ({ value: s, label: t(`status.${s}` as MessageKey) }))]} />
          </TableToolbar>
          <DataTable columns={columns} rows={q.data?.items} loading={q.isFetching} rowKey={(r) => r.id} onRowClick={setSelected} />
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
                <div className="flex items-center gap-3"><ChannelLabel channel={selected.channel} /><StatusBadge status={selected.status} /></div>
                <div>
                  <div className="text-label mb-1.5">{t("tpl.preview")}</div>
                  <div className="rounded-md border bg-surface-subtle p-3 text-body" dir={selected.language === "ar" ? "rtl" : "ltr"}>{selected.body}</div>
                </div>
                {selected.subject && <div><div className="text-label mb-1">{t("send.subject")}</div><p className="text-sm">{selected.subject}</p></div>}
                {can("templates.manage") && <div className="flex gap-2 border-t pt-4"><Button variant="outline" onClick={() => openEdit(selected)}>{t("common.edit")}</Button><Button variant="outline" onClick={() => duplicate(selected)}>{t("tpl.duplicate")}</Button></div>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={createOpen} onOpenChange={(value) => !save.isPending && setCreateOpen(value)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{t(editingId ? "tpl.edit" : "tpl.new")}</SheetTitle><SheetDescription>{t("tpl.createDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid) save.mutate(); }} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="template-name">{t("tpl.name")} *</Label><Input id="template-name" dir="ltr" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={touched && !validName} />{touched && !validName && <p className="text-xs text-danger">{t("tpl.invalidName")}</p>}</div>
              <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={draft.channel} onValueChange={(value) => setDraft({ ...draft, channel: value as Channel, subject: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("common.category")}</Label><Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value as Template["category"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["Authentication", "Transactional", "Notification", "Marketing"] as const).map((item) => <SelectItem key={item} value={item}>{t(`tpl.category.${item}` as MessageKey)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>{t("common.language")}</Label><Select value={draft.language} onValueChange={(value) => setDraft({ ...draft, language: value as Template["language"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div>
            </div>
            {draft.channel === "email" && <div className="space-y-1.5"><Label htmlFor="template-subject">{t("send.subject")} *</Label><Input id="template-subject" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} aria-invalid={touched && !draft.subject.trim()} /></div>}
            <div className="space-y-1.5"><Label htmlFor="template-body">{t("send.body")} *</Label><Textarea id="template-body" dir="auto" rows={7} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} aria-invalid={touched && !draft.body.trim()} />{touched && !draft.body.trim() && <p className="text-xs text-danger">{t("tpl.bodyRequired")}</p>}</div>
            {draft.channel === "sms" && <p className="text-xs text-muted-foreground">{t("tpl.smsEstimate", { count: smsSegments, encoding: t(unicodeSms ? "tpl.unicode" : "tpl.gsm") })}</p>}
            {draft.channel === "whatsapp" && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">{t("tpl.whatsappPending")}</p>}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t(editingId ? "common.saving" : "common.creating") : t(editingId ? "common.save" : "common.create")}</Button></div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
