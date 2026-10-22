import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queries, credentialRegistryMutations } from "@/lib/api/queries";
import { credentialScopeKey, credentialFailureKey } from "@/lib/api/credential-registry";
import type {
  CredentialMetadata,
  CredentialScope,
  CredentialIssueInput,
  IssuedRegistryCredential,
} from "@/lib/api/credential-registry";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { PageHeader, PageBody, Section } from "./PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "./States";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const scopesByApplication: Record<string, CredentialScope> = {
  "messages:send": "MESSAGES_SEND",
  "messages:read": "MESSAGES_READ",
  "templates:read": "TEMPLATES_READ",
  "webhooks:manage": "WEBHOOKS_MANAGE",
};

export function CredentialRegistry({
  initialApplicationId,
}: {
  initialApplicationId?: string | undefined;
}) {
  const { user, can, isPlatform } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { t, locale } = useI18n();
  const actor: SenderIdentityActor = {
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    userId: user?.id ?? "",
    name: user?.name ?? "",
  };
  const canManage = can("credentials.manage") || can("platform.credentials.manage");
  const scopeAvailable = !isPlatform || !!tenantId;
  const [applicationId, setApplicationId] = useState(initialApplicationId ?? "");
  const [appPage, setAppPage] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<"issue" | "rotate" | "revoke" | null>(null);
  const [scopes, setScopes] = useState<CredentialScope[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const [secret, setSecret] = useState<IssuedRegistryCredential | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const qc = useQueryClient();
  const apps = useQuery(queries.credentialApplications(actor, appPage, tenantId));
  const application = useQuery(queries.credentialApplication(actor, applicationId, tenantId));
  const list = useQuery(
    queries.credentialRegistry(actor, applicationId, { page, pageSize }, tenantId),
  );
  const detail = useQuery(
    queries.credentialRegistryDetail(actor, applicationId, selectedId, tenantId),
  );
  const availableScopes = (application.data?.scopes ?? []).flatMap((scope) =>
    scopesByApplication[scope] ? [scopesByApplication[scope]] : [],
  );
  type Operation =
    | { kind: "issue" | "rotate"; input: CredentialIssueInput; id?: string }
    | { kind: "revoke"; id: string; reason: string };
  const mutation = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (operation: Operation): Promise<CredentialMetadata> => {
      if (operation.kind === "revoke")
        return credentialRegistryMutations.revoke(
          actor,
          applicationId,
          operation.id,
          operation.reason,
          tenantId,
        );
      const issued =
        operation.kind === "issue"
          ? await credentialRegistryMutations.issue(actor, applicationId, operation.input, tenantId)
          : await credentialRegistryMutations.rotate(
              actor,
              applicationId,
              operation.id!,
              operation.input,
              tenantId,
            );
      // Only component memory receives the secret; mutation/query caches receive metadata.
      if (active.current) {
        setSecret(issued);
        setAcknowledged(false);
      }
      return issued.credential;
    },
    onSuccess: async (saved) => {
      if (!active.current) return;
      setForm(null);
      setFailure(null);
      setSelectedId(saved.id);
      toast.success(t("liveCredentials.saved"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: credentialScopeKey(actor, applicationId, tenantId) }),
        qc.invalidateQueries({ queryKey: ["applications"] }),
        qc.invalidateQueries({ queryKey: ["administrativeAudit"] }),
      ]);
    },
    onError: (error) => {
      if (active.current) setFailure(credentialFailureKey(error));
    },
  });
  const begin = (kind: "issue" | "rotate" | "revoke") => {
    setFailure(null);
    setForm(kind);
    setReason("");
    setScopes(
      kind === "rotate"
        ? (detail.data?.scopes ?? []).filter((scope) => availableScopes.includes(scope))
        : [],
    );
    setExpiresAt("");
    setRate("");
  };
  const switchApplication = (id: string) => {
    setApplicationId(id);
    setPage(1);
    setSelectedId("");
    setForm(null);
    setSecret(null);
    setFailure(null);
  };
  const columns: Column<CredentialMetadata>[] = [
    {
      id: "clientId",
      header: t("liveCredentials.clientId"),
      cell: (row) => (
        <Button
          variant="link"
          className="h-auto p-0 font-mono"
          onClick={() => {
            setSelectedId(row.id);
            setFailure(null);
          }}
        >
          {row.clientId}
        </Button>
      ),
    },
    {
      id: "prefix",
      header: t("liveCredentials.prefix"),
      cell: (row) => <code>{row.secretPrefix}</code>,
    },
    {
      id: "status",
      header: t("common.status"),
      cell: (row) => <StatusBadge status={row.effectiveStatus.toLowerCase()} />,
    },
    {
      id: "createdAt",
      header: t("liveCredentials.createdAt"),
      cell: (row) => formatDateTime(row.createdAt, locale),
    },
    {
      id: "expiresAt",
      header: t("liveCredentials.expiresAt"),
      cell: (row) => (row.expiresAt ? formatDateTime(row.expiresAt, locale) : "—"),
    },
  ];
  const submit = () => {
    if (!form || !canManage) return;
    setFailure(null);
    const input: CredentialIssueInput = {
      scopes,
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      ...(rate ? { rateLimitPerSecondOverride: Number(rate) } : {}),
    };
    if (form === "revoke") mutation.mutate({ kind: "revoke", id: selectedId, reason });
    else mutation.mutate({ kind: form, input, ...(form === "rotate" ? { id: selectedId } : {}) });
  };
  const valid =
    form === "revoke"
      ? reason.trim().length > 0 && reason.trim().length <= 500
      : scopes.length > 0 &&
        scopes.every((scope) => availableScopes.includes(scope)) &&
        (!expiresAt ||
          (Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now())) &&
        (!rate ||
          (Number.isSafeInteger(Number(rate)) && Number(rate) > 0 && Number(rate) <= 2147483647));
  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(`${secret.credential.clientId}\n${secret.secret}`);
      toast.success(t("cred.copiedBoth"));
    } catch {
      toast.error(t("cred.copyFailed"));
    }
  };
  const record = detail.data;
  return (
    <>
      <PageHeader
        title={t("liveCredentials.title")}
        description={t("liveCredentials.description")}
        actions={
          canManage &&
          application.data && (
            <Button disabled={mutation.isPending || !!secret} onClick={() => begin("issue")}>
              {t("liveCredentials.issue")}
            </Button>
          )
        }
      />
      <PageBody>
        <Section>
          {!scopeAvailable ? (
            <EmptyState title={t("liveCredentials.chooseTenant")} />
          ) : (
            <>
              <div className="space-y-3 border-b p-4">
                <Label>{t("liveCredentials.application")}</Label>
                {apps.isPending ? (
                  <TableSkeleton rows={2} />
                ) : apps.isError ? (
                  <ErrorState onRetry={() => void apps.refetch()} />
                ) : (
                  <>
                    <Select
                      value={applicationId}
                      onValueChange={switchApplication}
                      disabled={mutation.isPending || !!secret}
                    >
                      <SelectTrigger aria-label={t("liveCredentials.application")}>
                        <SelectValue placeholder={t("liveCredentials.chooseApplication")} />
                      </SelectTrigger>
                      <SelectContent>
                        {apps.data.items.map((app) => (
                          <SelectItem key={app.id} value={app.id}>
                            {app.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {apps.data.total === 0 ? (
                      <EmptyState title={t("liveCredentials.noApplications")} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={appPage <= 1 || mutation.isPending || !!secret}
                          onClick={() => setAppPage((value) => value - 1)}
                        >
                          {t("common.previous")}
                        </Button>
                        <span>
                          {appPage} / {Math.max(1, Math.ceil(apps.data.total / 20))}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            appPage * 20 >= apps.data.total || mutation.isPending || !!secret
                          }
                          onClick={() => setAppPage((value) => value + 1)}
                        >
                          {t("common.next")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
              {!applicationId ? (
                <EmptyState title={t("liveCredentials.chooseApplication")} />
              ) : (
                <>
                  {application.isError && <ErrorState onRetry={() => void application.refetch()} />}
                  {application.data && (
                    <div className="border-b p-4">
                      {application.data.name}{" "}
                      <code className="ms-2 text-muted-foreground">{applicationId}</code>
                    </div>
                  )}
                  {list.isError ? (
                    <ErrorState onRetry={() => void list.refetch()} />
                  ) : (
                    <DataTable
                      columns={columns}
                      rows={list.data?.items}
                      loading={list.isPending}
                      rowKey={(row) => row.id}
                    />
                  )}
                  {list.data && (
                    <ListPagination
                      page={page}
                      pageSize={pageSize}
                      total={list.data.total}
                      onPage={setPage}
                      onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}
        </Section>
      </PageBody>
      <Dialog
        open={!!selectedId && !form && !secret}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSelectedId("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("liveCredentials.detail")}</DialogTitle>
            <DialogDescription>{selectedId}</DialogDescription>
          </DialogHeader>
          {detail.isPending ? (
            <TableSkeleton rows={3} />
          ) : detail.isError ? (
            <ErrorState onRetry={() => void detail.refetch()} />
          ) : (
            record && (
              <div className="space-y-3">
                <StatusBadge status={record.effectiveStatus.toLowerCase()} />
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    [t("liveCredentials.clientId"), record.clientId],
                    [t("liveCredentials.prefix"), record.secretPrefix],
                    [t("liveCredentials.createdBy"), record.createdByUserId ?? "—"],
                    [
                      t("liveCredentials.lastUsed"),
                      record.lastUsedAt ? formatDateTime(record.lastUsedAt, locale) : "—",
                    ],
                    [
                      t("liveCredentials.rate"),
                      record.rateLimitPerSecondOverride?.toString() ?? "—",
                    ],
                    [t("liveCredentials.rotatedFrom"), record.rotatedFromCredentialId ?? "—"],
                    [t("liveCredentials.revokedBy"), record.revokedByUserId ?? "—"],
                    [t("liveCredentials.revokeReason"), record.revokeReason ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm">{record.scopes.join(", ")}</p>
                {canManage && record.effectiveStatus === "ACTIVE" && (
                  <DialogFooter>
                    <Button variant="outline" onClick={() => begin("rotate")}>
                      {t("liveCredentials.rotate")}
                    </Button>
                    <Button variant="destructive" onClick={() => begin("revoke")}>
                      {t("liveCredentials.revoke")}
                    </Button>
                  </DialogFooter>
                )}
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setForm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(
                form === "rotate"
                  ? "liveCredentials.rotate"
                  : form === "revoke"
                    ? "liveCredentials.revoke"
                    : "liveCredentials.issue",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                form === "rotate"
                  ? "liveCredentials.rotateWarning"
                  : form === "revoke"
                    ? "liveCredentials.revokeWarning"
                    : "liveCredentials.issueHint",
              )}
            </DialogDescription>
          </DialogHeader>
          {form === "revoke" ? (
            <div className="space-y-2">
              <Label htmlFor="credential-reason">{t("liveCredentials.revokeReason")}</Label>
              <Input
                id="credential-reason"
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                disabled={mutation.isPending}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Label>{t("liveCredentials.scopes")}</Label>
              {application.isError ? (
                <ErrorState onRetry={() => void application.refetch()} />
              ) : (
                availableScopes.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      disabled={mutation.isPending}
                      checked={scopes.includes(scope)}
                      onCheckedChange={(checked) =>
                        setScopes((current) =>
                          checked === true
                            ? [...current, scope]
                            : current.filter((item) => item !== scope),
                        )
                      }
                    />
                    {scope}
                  </label>
                ))
              )}
              <Label htmlFor="credential-expiry">{t("liveCredentials.expiresAt")}</Label>
              <Input
                id="credential-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                disabled={mutation.isPending}
              />
              <Label htmlFor="credential-rate">{t("liveCredentials.rate")}</Label>
              <Input
                id="credential-rate"
                type="number"
                min={1}
                step={1}
                value={rate}
                onChange={(event) => setRate(event.target.value)}
                disabled={mutation.isPending}
              />
              <p className="text-xs text-muted-foreground">{t("liveCredentials.rateHint")}</p>
            </div>
          )}
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {t(failure)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setForm(null)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!valid || mutation.isPending || !canManage} onClick={submit}>
              {t("liveCredentials.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!secret}
        onOpenChange={(open) => {
          if (!open && acknowledged) {
            setSecret(null);
            mutation.reset();
          }
        }}
      >
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (!acknowledged) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("cred.secretTitle")}</DialogTitle>
            <DialogDescription>{t("cred.secretWarning")}</DialogDescription>
          </DialogHeader>
          {secret && (
            <div className="space-y-3">
              <p className="break-all font-mono text-sm">{secret.credential.clientId}</p>
              <pre className="whitespace-pre-wrap break-all rounded border p-3 text-sm" dir="ltr">
                {secret.secret}
              </pre>
              <Button variant="outline" onClick={() => void copySecret()}>
                {t("cred.copyBoth")}
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                {t("cred.confirmSecretWarning")}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={!acknowledged}
              onClick={() => {
                setSecret(null);
                mutation.reset();
              }}
            >
              {t("cred.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
