import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Fingerprint, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChannelLabel } from "@/components/app/ChannelLabel";
import { DataTable, ListPagination, SortableHeader, type Column } from "@/components/app/DataTable";
import { FilterSelect } from "@/components/app/FilterSelect";
import { PageBody, PageHeader, Section } from "@/components/app/PageHeader";
import { RequirePermission } from "@/components/app/RequirePermission";
import { StatusBadge } from "@/components/app/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { queries } from "@/lib/api/queries";
import type { Channel, SenderIdentity, SenderIdentityActor, SenderIdentityHistoryAction, SenderIdentityInput, SenderIdentityOperationalStatus, SenderIdentitySortField, SenderIdentityVerificationStatus } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/sender-identities")({
  head: () => pageHead("Sender Identities", "Tenant sender identities and verification lifecycle."),
  component: () => <RequirePermission permission="senderIdentities.view"><SenderIdentities /></RequirePermission>,
});

type LifecycleAction = "submit" | "startVerification" | "verify" | "reject" | "activate" | "suspend" | "reactivate";

function SenderIdentities() {
  const { t, locale, dir } = useI18n();
  const { user, can } = useSession();
  const actor: SenderIdentityActor = { role: user?.role ?? "viewer", tenantId: user?.tenantId ?? null, userId: user?.id ?? "", name: user?.name ?? "" };
  const isPlatform = actor.role === "super_admin";
  const { tenantId: selectedTenantId, scopedTenantId } = useGlobalTenantContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState<SenderIdentityVerificationStatus | "all">("all");
  const [operationalFilter, setOperationalFilter] = useState<SenderIdentityOperationalStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<SenderIdentitySortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<SenderIdentity | null>(null);
  const [activeSheet, setActiveSheet] = useState<"detail" | "form" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ action: LifecycleAction; identity: SenderIdentity } | null>(null);
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [tenantId, setTenantId] = useState(user?.tenantId ?? "");
  const [identityValue, setIdentityValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryMarket, setCountryMarket] = useState("");
  const [businessDisplayName, setBusinessDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+966");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [domain, setDomain] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [touched, setTouched] = useState(false);

  const identityQuery = useQuery(queries.senderIdentities(actor, {
    page, pageSize, search,
    filters: {
      ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
      channel: channelFilter,
      verificationStatus: verificationFilter,
      operationalStatus: operationalFilter,
    },
    sortBy,
    sortDirection,
  }));
  const tenantQuery = useQuery({ ...queries.tenants({ pageSize: 100, filters: { status: "active" } }), enabled: isPlatform });
  const tenants = tenantQuery.data?.items ?? [];
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));

  const clearForm = () => {
    setChannel("sms"); setTenantId(selectedTenantId ?? user?.tenantId ?? ""); setIdentityValue(""); setDisplayName(""); setCountryMarket("");
    setBusinessDisplayName(""); setPhoneNumber(""); setCountryCode("+966"); setWabaId(""); setPhoneNumberId("");
    setEmailAddress(""); setDomain(""); setProviderReference(""); setTouched(false);
  };
  useEffect(() => {
    setPage(1);
    setSelected(null);
    setPendingAction(null);
    setActiveSheet(null);
    if (isPlatform) setTenantId(selectedTenantId ?? "");
  }, [isPlatform, selectedTenantId]);
  const buildInput = (): SenderIdentityInput => {
    const ownership = isPlatform ? { tenantId: selectedTenantId ?? tenantId } : user?.tenantId ? { tenantId: user.tenantId } : {};
    const reference = isPlatform ? providerReference.trim() || null : null;
    if (channel === "sms") return { ...ownership, channel, identityValue, displayName: displayName.trim() || null, countryMarket, providerReference: reference };
    if (channel === "whatsapp") return { ...ownership, channel, identityValue: phoneNumber, displayName: businessDisplayName.trim() || null, businessDisplayName, phoneNumber, countryCode, wabaId: wabaId.trim() || null, phoneNumberId: phoneNumberId.trim() || null, providerReference: reference };
    return { ...ownership, channel, identityValue: emailAddress.trim().toLowerCase(), displayName: displayName.trim() || null, emailAddress, domain, providerReference: reference };
  };
  const valid = (isPlatform ? !!(selectedTenantId || tenantId) : !!user?.tenantId) && (channel === "sms"
    ? /^[a-zA-Z0-9]{2,11}$/.test(identityValue.trim()) && !!countryMarket.trim()
    : channel === "whatsapp"
      ? /^\+[1-9]\d{7,14}$/.test(phoneNumber.replace(/\s/g, "")) && phoneNumber.replace(/\s/g, "").startsWith(countryCode.replace(/\s/g, "")) && !!businessDisplayName.trim() && !!countryCode.trim()
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim()) && domain.trim().toLowerCase() === emailAddress.trim().toLowerCase().split("@")[1]);

  const save = useMutation({
    mutationFn: () => editingId ? api.updateSenderIdentity(actor, editingId, buildInput()) : api.createSenderIdentity(actor, buildInput()),
    onSuccess: async (identity) => {
      toast.success(t(editingId ? "si.updatedToast" : "si.createdToast"));
      await queryClient.invalidateQueries({ queryKey: ["senderIdentities"] });
      setSelected(identity); setActiveSheet("detail"); setEditingId(null);
    },
    onError: () => toast.error(t("si.error")),
  });

  const lifecycle = useMutation({
    mutationFn: ({ identity, action, reason: actionReason }: { identity: SenderIdentity; action: LifecycleAction; reason?: string }) => {
      if (action === "submit") return api.submitSenderIdentity(actor, identity.id);
      if (action === "startVerification") return api.startSenderIdentityVerification(actor, identity.id);
      if (action === "verify") return api.setSenderIdentityVerification(actor, identity.id, { status: "verified" });
      if (action === "reject") return api.setSenderIdentityVerification(actor, identity.id, { status: "rejected", reason: actionReason ?? "" });
      return api.setSenderIdentityOperationalStatus(actor, identity.id, action, actionReason);
    },
    onSuccess: async (identity, variables) => {
      const toastKey: Record<LifecycleAction, MessageKey> = { submit: "si.submittedToast", startVerification: "si.verificationStartedToast", verify: "si.verifiedToast", reject: "si.rejectedToast", activate: "si.activatedToast", suspend: "si.suspendedToast", reactivate: "si.reactivatedToast" };
      toast.success(t(toastKey[variables.action]));
      await queryClient.invalidateQueries({ queryKey: ["senderIdentities"] });
      setSelected(identity); setPendingAction(null); setReason("");
    },
    onError: () => toast.error(t("si.error")),
  });

  const openCreate = () => { clearForm(); setSelected(null); setEditingId(null); setActiveSheet("form"); };
  const openEdit = (identity: SenderIdentity) => {
    setSelected(null); setEditingId(identity.id); setChannel(identity.channel); setTenantId(identity.tenantId); setIdentityValue(identity.identityValue);
    setDisplayName(identity.displayName ?? ""); setProviderReference(identity.providerReference ?? "");
    if (identity.channel === "sms") setCountryMarket(identity.countryMarket);
    if (identity.channel === "whatsapp") { setBusinessDisplayName(identity.businessDisplayName); setPhoneNumber(identity.phoneNumber); setCountryCode(identity.countryCode); setWabaId(identity.wabaId ?? ""); setPhoneNumberId(identity.phoneNumberId ?? ""); }
    if (identity.channel === "email") { setEmailAddress(identity.emailAddress); setDomain(identity.domain); }
    setTouched(false); setActiveSheet("form");
  };
  const confirmAction = (identity: SenderIdentity, action: LifecycleAction) => { setPendingAction({ identity, action }); setReason(""); };
  const runLifecycle = () => {
    if (!pendingAction) return;
    lifecycle.mutate({ ...pendingAction, reason });
  };
  const requiredReason = pendingAction?.action === "reject" || pendingAction?.action === "suspend";
  const actionCopy: Record<LifecycleAction, MessageKey> = { submit: "si.confirmSubmit", startVerification: "si.confirmStartVerification", verify: "si.confirmVerify", reject: "si.confirmReject", activate: "si.confirmActivate", suspend: "si.confirmSuspend", reactivate: "si.confirmReactivate" };
  const actionLabel: Record<SenderIdentityHistoryAction, MessageKey> = { created: "si.action.created", metadata_updated: "si.action.metadata_updated", submitted: "si.action.submitted", verification_started: "si.action.verification_started", verified: "si.action.verified", rejected: "si.action.rejected", activated: "si.action.activated", suspended: "si.action.suspended", reactivated: "si.action.reactivated" };
  const toggleSort = (field: SenderIdentitySortField) => {
    setSortDirection(sortBy === field ? (sortDirection === "asc" ? "desc" : "asc") : "desc");
    setSortBy(field);
    setPage(1);
  };

  const columns: Column<SenderIdentity>[] = [
    { id: "id", header: t("si.identityId"), cell: (identity) => <span className="font-mono text-xs">{identity.id}</span> },
    ...(isPlatform && !selectedTenantId ? [{ id: "tenant", header: <SortableHeader label={t("si.tenant")} field="tenantName" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("tenantName")} />, cell: (identity: SenderIdentity) => tenantNames.get(identity.tenantId) ?? identity.tenantId, className: "hidden lg:table-cell" }] : []),
    { id: "channel", header: <SortableHeader label={t("common.channel")} field="channel" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("channel")} />, cell: (identity) => <ChannelLabel channel={identity.channel} /> },
    { id: "identity", header: t("si.identity"), cell: (identity) => <div><div className="font-medium">{identity.identityValue}</div>{identity.displayName && <div className="text-caption text-muted-foreground">{identity.displayName}</div>}</div> },
    { id: "verification", header: <SortableHeader label={t("si.verification")} field="verificationStatus" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("verificationStatus")} />, cell: (identity) => <StatusBadge status={identity.verificationStatus} /> },
    { id: "operational", header: t("si.operational"), cell: (identity) => <StatusBadge status={identity.operationalStatus} /> },
    { id: "reference", header: t("si.reference"), cell: (identity) => identity.providerReference ?? "—", className: "hidden xl:table-cell" },
    { id: "created", header: <SortableHeader label={t("si.created")} field="createdAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("createdAt")} />, cell: (identity) => formatDateTime(identity.createdAt, locale), className: "hidden xl:table-cell" },
    { id: "updated", header: <SortableHeader label={t("si.updated")} field="updatedAt" sortBy={sortBy} sortDirection={sortDirection} onSort={() => toggleSort("updatedAt")} />, cell: (identity) => formatDateTime(identity.updatedAt, locale), className: "hidden xl:table-cell" },
  ];

  return <>
    <PageHeader title={t("si.title")} description={t(isPlatform ? "si.platformSubtitle" : "si.clientSubtitle")} actions={can(isPlatform ? "platform.senderIdentities.manage" : "senderIdentities.request") && <Button size="sm" onClick={openCreate}><Plus className="size-4" />{t("si.add")}</Button>} />
    <PageBody>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("si.search")} aria-label={t("si.search")} className="h-8 sm:max-w-xs" />
        <FilterSelect label={t("common.channel")} value={channelFilter} onChange={(value) => { setChannelFilter(value as Channel | "all"); setPage(1); }} options={[{ value: "all", label: t("common.allChannels") }, ...(["sms", "whatsapp", "email"] as const).map((item) => ({ value: item, label: t(`channel.${item}`) }))]} />
        <FilterSelect label={t("si.verification")} value={verificationFilter} onChange={(value) => { setVerificationFilter(value as SenderIdentityVerificationStatus | "all"); setPage(1); }} options={[{ value: "all", label: t("si.filterVerification") }, ...(["draft", "submitted", "pending_verification", "verified", "rejected"] as const).map((item) => ({ value: item, label: t(`status.${item}` as MessageKey) }))]} />
        <FilterSelect label={t("si.operational")} value={operationalFilter} onChange={(value) => { setOperationalFilter(value as SenderIdentityOperationalStatus | "all"); setPage(1); }} options={[{ value: "all", label: t("si.filterOperational") }, ...(["inactive", "active", "suspended"] as const).map((item) => ({ value: item, label: t(`status.${item}` as MessageKey) }))]} />
      </div>
      <Section><DataTable columns={columns} rows={identityQuery.data?.items} loading={identityQuery.isFetching} rowKey={(identity) => identity.id} onRowClick={(identity) => { setSelected(identity); setActiveSheet("detail"); }} />
        {identityQuery.data && <ListPagination page={identityQuery.data.page} pageSize={identityQuery.data.pageSize} total={identityQuery.data.total} onPage={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
      </Section>
    </PageBody>

    <Sheet open={activeSheet !== null} onOpenChange={(open) => { if (!open && !save.isPending) { setActiveSheet(null); setSelected(null); } }}>
      <SheetContent side={dir === "rtl" ? "left" : "right"} className={`w-full overflow-y-auto ${activeSheet === "form" ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        {activeSheet === "form" && <>
          <SheetHeader><SheetTitle>{t(editingId ? "si.edit" : "si.add")}</SheetTitle><SheetDescription>{t("si.formDescription")}</SheetDescription></SheetHeader>
          <form className="space-y-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid) save.mutate(); }} noValidate>
            {isPlatform && !selectedTenantId && <div className="space-y-1.5"><Label>{t("si.tenant")}</Label><Select value={tenantId} onValueChange={setTenantId} disabled={!!editingId}><SelectTrigger><SelectValue placeholder={t("si.selectTenant")} /></SelectTrigger><SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.id}</SelectItem>)}</SelectContent></Select></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>{t("common.channel")}</Label><Select value={channel} onValueChange={(value) => { setChannel(value as Channel); setIdentityValue(""); setPhoneNumber(""); setEmailAddress(""); setDomain(""); }} disabled={!!editingId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["sms", "whatsapp", "email"] as const).map((item) => <SelectItem key={item} value={item}>{t(`channel.${item}`)}</SelectItem>)}</SelectContent></Select></div>
              {channel !== "whatsapp" && <div className="space-y-1.5"><Label htmlFor="sender-display-name">{t("si.displayName")}</Label><Input id="sender-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div>}
            </div>
            {channel === "sms" && <>
              <div className="space-y-1.5"><Label htmlFor="sender-sms-value">{t("si.identity")}</Label><Input id="sender-sms-value" value={identityValue} onChange={(event) => setIdentityValue(event.target.value)} aria-invalid={touched && !/^[a-zA-Z0-9]{2,11}$/.test(identityValue.trim())} dir="ltr" /></div>
              <div className="space-y-1.5"><Label htmlFor="sender-market">{t("si.countryMarket")}</Label><Input id="sender-market" placeholder={t("si.countryMarketPlaceholder")} value={countryMarket} onChange={(event) => setCountryMarket(event.target.value)} /></div>
            </>}
            {channel === "whatsapp" && <>
              <div className="space-y-1.5"><Label htmlFor="sender-business">{t("si.businessDisplayName")}</Label><Input id="sender-business" value={businessDisplayName} onChange={(event) => setBusinessDisplayName(event.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="sender-phone">{t("si.phoneNumber")}</Label><Input id="sender-phone" dir="ltr" value={phoneNumber} onChange={(event) => { setPhoneNumber(event.target.value); setIdentityValue(event.target.value); }} /></div><div className="space-y-1.5"><Label htmlFor="sender-country-code">{t("si.countryCode")}</Label><Input id="sender-country-code" dir="ltr" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} /></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="sender-waba">{t("si.wabaId")}</Label><Input id="sender-waba" value={wabaId} onChange={(event) => setWabaId(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="sender-phone-id">{t("si.phoneNumberId")}</Label><Input id="sender-phone-id" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} /></div></div>
            </>}
            {channel === "email" && <>
              <div className="space-y-1.5"><Label htmlFor="sender-email">{t("si.emailAddress")}</Label><Input id="sender-email" type="email" dir="ltr" value={emailAddress} onChange={(event) => { setEmailAddress(event.target.value); setIdentityValue(event.target.value); }} /></div>
              <div className="space-y-1.5"><Label htmlFor="sender-domain">{t("si.domain")}</Label><Input id="sender-domain" dir="ltr" value={domain} onChange={(event) => setDomain(event.target.value)} /></div>
            </>}
            {isPlatform && <div className="space-y-1.5"><Label htmlFor="sender-reference">{t("si.reference")}</Label><Input id="sender-reference" value={providerReference} onChange={(event) => setProviderReference(event.target.value)} /></div>}
            {touched && !valid && <p role="alert" className="text-xs text-danger">{t("send.required")}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setActiveSheet(null)}>{t("common.cancel")}</Button><Button type="submit" disabled={!valid || save.isPending}>{t(editingId ? "common.save" : "common.create")}</Button></div>
          </form>
        </>}

        {activeSheet === "detail" && selected && <>
          <SheetHeader><SheetTitle>{selected.displayName ?? selected.identityValue}</SheetTitle><SheetDescription>{selected.id} · {t(`channel.${selected.channel}`)}</SheetDescription></SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="flex flex-wrap gap-2"><StatusBadge status={selected.verificationStatus} /><StatusBadge status={selected.operationalStatus} /></div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-label">{t("si.tenant")}</dt><dd>{tenantNames.get(selected.tenantId) ?? user?.tenantName ?? selected.tenantId}</dd></div>
              <div><dt className="text-label">{t("si.identity")}</dt><dd dir="ltr" className="break-all">{selected.identityValue}</dd></div>
              {selected.displayName && selected.channel !== "whatsapp" && <div><dt className="text-label">{t("si.displayName")}</dt><dd>{selected.displayName}</dd></div>}
              <div><dt className="text-label">{t("si.reference")}</dt><dd>{selected.providerReference ?? "—"}</dd></div>
              {selected.channel === "sms" && <div><dt className="text-label">{t("si.countryMarket")}</dt><dd>{selected.countryMarket}</dd></div>}
              {selected.channel === "whatsapp" && <><div><dt className="text-label">{t("si.businessDisplayName")}</dt><dd>{selected.businessDisplayName}</dd></div><div><dt className="text-label">{t("si.phoneNumber")}</dt><dd dir="ltr">{selected.phoneNumber}</dd></div><div><dt className="text-label">{t("si.countryCode")}</dt><dd dir="ltr">{selected.countryCode}</dd></div><div><dt className="text-label">{t("si.wabaId")}</dt><dd>{selected.wabaId ?? "—"}</dd></div><div><dt className="text-label">{t("si.phoneNumberId")}</dt><dd>{selected.phoneNumberId ?? "—"}</dd></div></>}
              {selected.channel === "email" && <><div><dt className="text-label">{t("si.domain")}</dt><dd dir="ltr">{selected.domain}</dd></div><div><dt className="text-label">{t("si.domainVerification")}</dt><dd><StatusBadge status={selected.domainVerificationStatus} /></dd></div><div><dt className="text-label">{t("si.spf")}</dt><dd><StatusBadge status={selected.spfStatus} /></dd></div><div><dt className="text-label">{t("si.dkim")}</dt><dd><StatusBadge status={selected.dkimStatus} /></dd></div></>}
              <div><dt className="text-label">{t("si.created")}</dt><dd>{formatDateTime(selected.createdAt, locale)}</dd></div><div><dt className="text-label">{t("si.createdBy")}</dt><dd>{selected.createdBy}</dd></div><div><dt className="text-label">{t("si.updated")}</dt><dd>{formatDateTime(selected.updatedAt, locale)}</dd></div>
              {selected.submittedAt && <div><dt className="text-label">{t("si.submittedAt")}</dt><dd>{formatDateTime(selected.submittedAt, locale)}</dd></div>}
              {selected.verificationStartedAt && <div><dt className="text-label">{t("si.verificationStartedAt")}</dt><dd>{formatDateTime(selected.verificationStartedAt, locale)}</dd></div>}
              {selected.verifiedAt && <div><dt className="text-label">{t("si.verifiedAt")}</dt><dd>{formatDateTime(selected.verifiedAt, locale)}</dd></div>}
              {selected.rejectedAt && <div><dt className="text-label">{t("si.rejectedAt")}</dt><dd>{formatDateTime(selected.rejectedAt, locale)}</dd></div>}
              {selected.activatedAt && <div><dt className="text-label">{t("si.activatedAt")}</dt><dd>{formatDateTime(selected.activatedAt, locale)}</dd></div>}
              {selected.suspendedAt && <div><dt className="text-label">{t("si.suspendedAt")}</dt><dd>{formatDateTime(selected.suspendedAt, locale)}</dd></div>}
              {selected.rejectionReason && <div className="col-span-2"><dt className="text-label">{t("si.rejectionReason")}</dt><dd>{selected.rejectionReason}</dd></div>}
              {selected.suspensionReason && <div className="col-span-2"><dt className="text-label">{t("si.suspensionReason")}</dt><dd>{selected.suspensionReason}</dd></div>}
            </dl>
            <section className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">{t("si.history")}</h3><ol className="space-y-2">{selected.history.map((entry, index) => <li key={`${entry.action}-${entry.at}-${index}`} className="border-s-2 ps-3"><div className="text-sm font-medium">{t(actionLabel[entry.action])}</div><div className="text-caption text-muted-foreground">{formatDateTime(entry.at, locale)} · {entry.actor}</div>{entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}</li>)}</ol>{!selected.history.length && <p className="text-sm text-muted-foreground">{t("si.noHistory")}</p>}</section>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {(selected.verificationStatus === "draft" || selected.verificationStatus === "rejected") && <Button variant="outline" onClick={() => openEdit(selected)}>{t("si.edit")}</Button>}
              {selected.verificationStatus === "draft" && (isPlatform ? can("platform.senderIdentities.manage") : can("senderIdentities.request")) && <Button onClick={() => lifecycle.mutate({ identity: selected, action: "submit" })} disabled={lifecycle.isPending}>{t("si.submit")}</Button>}
              {isPlatform && selected.verificationStatus === "submitted" && <Button onClick={() => confirmAction(selected, "startVerification")}>{t("si.startVerification")}</Button>}
              {isPlatform && selected.verificationStatus === "pending_verification" && <><Button onClick={() => confirmAction(selected, "verify")}>{t("si.verify")}</Button><Button variant="destructive" onClick={() => confirmAction(selected, "reject")}>{t("si.reject")}</Button></>}
              {isPlatform && selected.verificationStatus === "verified" && selected.operationalStatus === "inactive" && <Button onClick={() => confirmAction(selected, "activate")}>{t("si.activate")}</Button>}
              {isPlatform && selected.operationalStatus === "active" && <Button variant="destructive" onClick={() => confirmAction(selected, "suspend")}>{t("si.suspend")}</Button>}
              {isPlatform && selected.operationalStatus === "suspended" && selected.verificationStatus === "verified" && <Button onClick={() => confirmAction(selected, "reactivate")}>{t("si.reactivate")}</Button>}
            </div>
          </div>
        </>}
      </SheetContent>
    </Sheet>

    <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) { setPendingAction(null); setReason(""); } }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("si.confirmTitle")}</AlertDialogTitle><AlertDialogDescription>{pendingAction ? t(actionCopy[pendingAction.action], { identity: pendingAction.identity.identityValue }) : ""}</AlertDialogDescription></AlertDialogHeader>
        {requiredReason && <div className="space-y-1.5"><Label htmlFor="sender-action-reason">{t(pendingAction?.action === "reject" ? "si.rejectionReason" : "si.suspensionReason")}</Label><Textarea id="sender-action-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></div>}
        <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); runLifecycle(); }} disabled={lifecycle.isPending || (requiredReason && !reason.trim())}>{t("common.confirm")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}