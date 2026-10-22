import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { PageBody, PageHeader, Section } from "./PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "./States";
import { FilterSelect } from "./FilterSelect";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { queries, registryMutations } from "@/lib/api/queries";
import {
  REGISTRY_STATUSES,
  TEMPLATE_APPROVAL_STATUSES,
  TEMPLATE_REGISTRY_KEY,
  TEMPLATE_REGISTRY_LANGUAGE,
  registryScopeKey,
  registryDetailKey,
  registryFailureKey,
} from "@/lib/api/template-registry";
import type {
  RegistryTemplate,
  RegistryQuery,
  TemplateEvidenceInput,
} from "@/lib/api/template-registry";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";

export function TemplateRegistry() {
  const { user, can, isPlatform } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t, locale } = useI18n();
  const actor: SenderIdentityActor = {
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    userId: user?.id ?? "",
    name: user?.name ?? "",
  };
  const canManage = can("templates.manage") || can("platform.templates.manage");
  const canRecordEvidence = can("platform.templates.manage");
  const scopeAvailable = !isPlatform || !!tenantId;
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [registryStatus, setRegistryStatus] = useState("all");
  const [approvalStatus, setApprovalStatus] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<"register" | "evidence" | null>(null);
  const [templateKey, setTemplateKey] = useState("");
  const [language, setLanguage] = useState("en");
  const [evidenceStatus, setEvidenceStatus] =
    useState<RegistryTemplate["providerApprovalStatus"]>("UNKNOWN");
  const [providerTemplateId, setProviderTemplateId] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [pendingAction, setPendingAction] = useState<"ready" | "retire" | null>(null);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const query: RegistryQuery = {
    page,
    pageSize,
    ...(registryStatus === "all"
      ? {}
      : { registryStatus: registryStatus as RegistryTemplate["registryStatus"] }),
    ...(approvalStatus === "all"
      ? {}
      : { providerApprovalStatus: approvalStatus as RegistryTemplate["providerApprovalStatus"] }),
  };
  const list = useQuery(queries.templateRegistry(actor, query, tenantId));
  const detail = useQuery(queries.templateRegistryDetail(actor, selectedId, tenantId));
  type Operation =
    | { kind: "register" }
    | { kind: "evidence"; id: string; input: TemplateEvidenceInput }
    | { kind: "ready" | "retire"; id: string };
  const mutation = useMutation({
    mutationFn: (operation: Operation) => {
      if (operation.kind === "register")
        return registryMutations.register(actor, { templateKey, language }, tenantId);
      if (operation.kind === "evidence")
        return registryMutations.evidence(actor, operation.id, operation.input, tenantId);
      return registryMutations.lifecycle(actor, operation.id, operation.kind, tenantId);
    },
    onSuccess: async (saved) => {
      qc.setQueryData(registryDetailKey(actor, saved.id, tenantId), saved);
      setSelectedId(saved.id);
      setForm(null);
      setPendingAction(null);
      setFailure(null);
      toast.success(t("registry.saved"));
      await qc.invalidateQueries({ queryKey: registryScopeKey(actor, tenantId) });
    },
    onError: (error) => {
      setFailure(registryFailureKey(error));
    },
  });
  const openRegister = () => {
    setFailure(null);
    setTemplateKey("");
    setLanguage(locale);
    setForm("register");
  };
  const openEvidence = () => {
    if (!detail.data) return;
    setFailure(null);
    setEvidenceStatus(detail.data.providerApprovalStatus);
    setProviderTemplateId(detail.data.providerTemplateId ?? "");
    setObservedAt(detail.data.approvalObservedAt?.slice(0, 16) ?? "");
    setForm("evidence");
  };
  const validRegister =
    TEMPLATE_REGISTRY_KEY.test(templateKey.trim()) &&
    TEMPLATE_REGISTRY_LANGUAGE.test(language.trim());
  const observedTimestamp = observedAt ? Date.parse(`${observedAt}:00.000Z`) : NaN;
  const validEvidence =
    evidenceStatus !== "APPROVED" ||
    (providerTemplateId.trim().length > 0 &&
      providerTemplateId.trim().length <= 128 &&
      Number.isFinite(observedTimestamp) &&
      observedTimestamp <= Date.now());
  const columns: Column<RegistryTemplate>[] = [
    {
      id: "key",
      header: t("registry.key"),
      cell: (row) => (
        <button
          className="font-mono text-primary underline"
          onClick={() => {
            setSelectedId(row.id);
            setFailure(null);
          }}
        >
          {row.templateKey}
        </button>
      ),
    },
    {
      id: "language",
      header: t("common.language"),
      cell: (row) => <span dir="ltr">{row.language}</span>,
    },
    {
      id: "registry",
      header: t("registry.localStatus"),
      cell: (row) => <StatusBadge status={row.registryStatus.toLowerCase()} />,
    },
    {
      id: "approval",
      header: t("registry.providerStatus"),
      cell: (row) => <StatusBadge status={row.providerApprovalStatus.toLowerCase()} />,
    },
    {
      id: "evidence",
      header: t("registry.evidenceSource"),
      cell: (row) => t(`registry.source.${row.evidenceSource ?? "NONE"}`),
    },
    {
      id: "updated",
      header: t("common.updatedAt"),
      cell: (row) => formatDateTime(row.updatedAt, locale),
    },
  ];
  if (!scopeAvailable)
    return (
      <>
        <PageHeader title={t("registry.title")} />
        <PageBody>
          <Section>
            <EmptyState title={t("registry.chooseTenant")} body={t("registry.chooseTenantHint")} />
          </Section>
        </PageBody>
      </>
    );
  return (
    <>
      <PageHeader
        title={t("registry.title")}
        description={t("registry.description")}
        actions={canManage && <Button onClick={openRegister}>{t("registry.register")}</Button>}
      />
      <PageBody>
        <Section>
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <FilterSelect
              label={t("registry.localStatus")}
              value={registryStatus}
              onChange={(value) => {
                setRegistryStatus(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("common.allStatuses") },
                ...REGISTRY_STATUSES.map((value) => ({
                  value,
                  label: t(`status.${value.toLowerCase()}` as MessageKey),
                })),
              ]}
            />
            <FilterSelect
              label={t("registry.providerStatus")}
              value={approvalStatus}
              onChange={(value) => {
                setApprovalStatus(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("common.allStatuses") },
                ...TEMPLATE_APPROVAL_STATUSES.map((value) => ({
                  value,
                  label: t(`status.${value.toLowerCase()}` as MessageKey),
                })),
              ]}
            />
            <Button
              variant="outline"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              {t("registry.refresh")}
            </Button>
          </div>
          {list.isError ? (
            <ErrorState onRetry={() => void list.refetch()} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={list.data?.items}
                loading={list.isPending}
                rowKey={(row) => row.id}
              />
              {list.data && (
                <ListPagination
                  page={page}
                  pageSize={pageSize}
                  total={list.data.total}
                  onPage={setPage}
                  onPageSizeChange={(value) => {
                    setPageSize(value);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </Section>
      </PageBody>
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setSelectedId("");
            setFailure(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("registry.details")}</DialogTitle>
            <DialogDescription className="font-mono">{selectedId}</DialogDescription>
          </DialogHeader>
          {detail.isError ? (
            <ErrorState onRetry={() => void detail.refetch()} />
          ) : !detail.data ? (
            <TableSkeleton />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-label">{t("registry.key")}</dt>
                  <dd className="font-mono">{detail.data.templateKey}</dd>
                </div>
                <div>
                  <dt className="text-label">{t("common.language")}</dt>
                  <dd dir="ltr">{detail.data.language}</dd>
                </div>
                <div>
                  <dt className="text-label">{t("registry.localStatus")}</dt>
                  <dd>
                    <StatusBadge status={detail.data.registryStatus.toLowerCase()} />
                  </dd>
                </div>
                <div>
                  <dt className="text-label">{t("registry.providerStatus")}</dt>
                  <dd>
                    <StatusBadge status={detail.data.providerApprovalStatus.toLowerCase()} />
                  </dd>
                </div>
                <div>
                  <dt className="text-label">{t("registry.evidenceSource")}</dt>
                  <dd>{t(`registry.source.${detail.data.evidenceSource ?? "NONE"}`)}</dd>
                </div>
                <div>
                  <dt className="text-label">{t("registry.providerId")}</dt>
                  <dd dir="ltr">{detail.data.providerTemplateId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-label">{t("registry.observedAt")}</dt>
                  <dd>
                    {detail.data.approvalObservedAt
                      ? formatDateTime(detail.data.approvalObservedAt, locale)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-label">{t("registry.updated")}</dt>
                  <dd>{formatDateTime(detail.data.updatedAt, locale)}</dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">{t("registry.evidenceHint")}</p>
              {failure && !form && !pendingAction && (
                <p role="alert" className="text-sm text-danger">
                  {t(failure)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {canManage && detail.data.registryStatus === "DRAFT" && (
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => {
                      setPendingAction("ready");
                      setFailure(null);
                    }}
                  >
                    {t("registry.ready")}
                  </Button>
                )}
                {canManage && detail.data.registryStatus !== "RETIRED" && (
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => {
                      setPendingAction("retire");
                      setFailure(null);
                    }}
                  >
                    {t("registry.retire")}
                  </Button>
                )}
                {canRecordEvidence && (
                  <Button
                    variant="outline"
                    disabled={mutation.isPending || detail.data.evidenceSource === "PROVIDER_SYNC"}
                    onClick={openEvidence}
                  >
                    {t("registry.recordEvidence")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={detail.isFetching}
                  onClick={() => void detail.refetch()}
                >
                  {t("registry.refresh")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setForm(null);
            setFailure(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(form === "register" ? "registry.register" : "registry.recordEvidence")}
            </DialogTitle>
            <DialogDescription>
              {t(form === "register" ? "registry.registerHint" : "registry.evidenceHint")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFailure(null);
              if (form === "register" && validRegister) mutation.mutate({ kind: "register" });
              if (form === "evidence" && validEvidence && selectedId)
                mutation.mutate({
                  kind: "evidence",
                  id: selectedId,
                  input: {
                    providerApprovalStatus: evidenceStatus,
                    ...(evidenceStatus === "APPROVED"
                      ? {
                          providerTemplateId: providerTemplateId.trim(),
                          approvalObservedAt: new Date(observedTimestamp).toISOString(),
                        }
                      : {}),
                  },
                });
            }}
          >
            {form === "register" ? (
              <>
                <label className="block text-sm">
                  {t("registry.key")}
                  <Input
                    required
                    dir="ltr"
                    maxLength={64}
                    value={templateKey}
                    onChange={(event) => setTemplateKey(event.target.value)}
                  />
                </label>
                <p className="text-caption">{t("registry.keyHint")}</p>
                <label className="block text-sm">
                  {t("common.language")}
                  <Input
                    required
                    dir="ltr"
                    maxLength={16}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  />
                </label>
                <p className="text-caption">{t("registry.languageHint")}</p>
              </>
            ) : (
              <>
                <FilterSelect
                  label={t("registry.providerStatus")}
                  value={evidenceStatus}
                  onChange={(value) =>
                    setEvidenceStatus(value as RegistryTemplate["providerApprovalStatus"])
                  }
                  options={TEMPLATE_APPROVAL_STATUSES.map((value) => ({
                    value,
                    label: t(`status.${value.toLowerCase()}` as MessageKey),
                  }))}
                />
                {evidenceStatus === "APPROVED" && (
                  <>
                    <label className="block text-sm">
                      {t("registry.providerId")}
                      <Input
                        required
                        dir="ltr"
                        maxLength={128}
                        value={providerTemplateId}
                        onChange={(event) => setProviderTemplateId(event.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      {t("registry.observedUtc")}
                      <Input
                        required
                        type="datetime-local"
                        value={observedAt}
                        onChange={(event) => setObservedAt(event.target.value)}
                      />
                    </label>
                  </>
                )}
                {evidenceStatus !== "APPROVED" && (
                  <p className="text-sm text-warning">{t("registry.clearsEvidence")}</p>
                )}
              </>
            )}
            {failure && (
              <p role="alert" className="text-sm text-danger">
                {t(failure)}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  setForm(null);
                  setFailure(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  mutation.isPending || (form === "register" ? !validRegister : !validEvidence)
                }
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) {
            setPendingAction(null);
            setFailure(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(pendingAction === "ready" ? "registry.ready" : "registry.retire")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(pendingAction === "ready" ? "registry.readyConfirm" : "registry.retireConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {failure && (
            <p role="alert" className="text-sm text-danger">
              {t(failure)}
            </p>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setPendingAction(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={mutation.isPending || !selectedId}
              onClick={() => {
                if (pendingAction) {
                  setFailure(null);
                  mutation.mutate({ kind: pendingAction, id: selectedId });
                }
              }}
            >
              {t("common.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
