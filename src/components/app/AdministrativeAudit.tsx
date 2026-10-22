import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { PageBody, PageHeader, Section } from "./PageHeader";
import { ErrorState } from "./States";
import { StatusBadge } from "./StatusBadge";
import { FilterSelect } from "./FilterSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { queries, auditMutations } from "@/lib/api/queries";
import type {
  AdministrativeAuditEvent,
  AdministrativeAuditQuery,
} from "@/lib/api/administrative-audit";
import { auditQueryString, AUDIT_ACTIONS } from "@/lib/api/http/administrative-audit-mapper";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { useI18n } from "@/lib/i18n/i18n";
import { formatDateTime } from "@/lib/format";

const emptyFilters = { action: "all", actorUserId: "", actorCredentialId: "", resourceId: "" };
function filterFields(filters: typeof emptyFilters) {
  return {
    ...(filters.action !== "all" ? { action: filters.action } : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.actorCredentialId ? { actorCredentialId: filters.actorCredentialId } : {}),
    ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
  };
}

export function AdministrativeAudit() {
  const { user, isPlatform } = useSession(),
    { tenantId } = useGlobalTenantContext(),
    { t, locale } = useI18n();
  const actor: SenderIdentityActor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  };
  const [dates, setDates] = useState(() => {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      from: new Date(end.getTime() - 31 * 86400000).toISOString().slice(0, 10),
      through: new Date(end.getTime() - 86400000).toISOString().slice(0, 10),
    };
  });
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [outcome, setOutcome] = useState("all");
  const [filters, setFilters] = useState(emptyFilters),
    [draftFilters, setDraftFilters] = useState(emptyFilters),
    [filterError, setFilterError] = useState(false);
  const [selected, setSelected] = useState<AdministrativeAuditEvent | null>(null);
  let query: AdministrativeAuditQuery | null = null;
  try {
    const candidate: AdministrativeAuditQuery = {
      acceptedFrom: `${dates.from}T00:00:00.000Z`,
      acceptedTo: new Date(Date.parse(`${dates.through}T00:00:00.000Z`) + 86400000).toISOString(),
      page,
      pageSize,
      ...filterFields(filters),
      ...(outcome !== "all" ? { outcome: outcome as "SUCCESS" | "DENIED" | "FAILURE" } : {}),
    };
    auditQueryString(candidate);
    query = candidate;
  } catch {
    /* Invalid filters disable network requests. */
  }
  const events = useQuery(queries.administrativeAudit(actor, query, tenantId));
  const applyFilters = () => {
    if (!query) return;
    const clean = {
      ...draftFilters,
      actorUserId: draftFilters.actorUserId.trim(),
      actorCredentialId: draftFilters.actorCredentialId.trim(),
      resourceId: draftFilters.resourceId.trim(),
    };
    try {
      if (clean.actorUserId && clean.actorCredentialId)
        throw new Error("Choose one actor identifier");
      auditQueryString({
        acceptedFrom: query.acceptedFrom,
        acceptedTo: query.acceptedTo,
        page: 1,
        pageSize,
        ...filterFields(clean),
      });
      setFilters(clean);
      setDraftFilters(clean);
      setPage(1);
      setFilterError(false);
    } catch {
      setFilterError(true);
    }
  };
  const columns: Column<AdministrativeAuditEvent>[] = [
    {
      id: "createdAt",
      header: t("audit.time"),
      cell: (row) => formatDateTime(row.createdAt, locale),
    },
    ...(isPlatform && !tenantId
      ? [
          {
            id: "tenant",
            header: t("common.tenant"),
            cell: (row: AdministrativeAuditEvent) => row.tenantId ?? t("liveAudit.platform"),
          },
        ]
      : []),
    {
      id: "actor",
      header: t("audit.actor"),
      cell: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {t(
            row.actorKind === "HUMAN"
              ? "liveAudit.human"
              : row.actorKind === "MACHINE"
                ? "liveAudit.machine"
                : "liveAudit.system",
          )}{" "}
          {row.actorUserId ?? row.actorCredentialId ?? "—"}
        </span>
      ),
    },
    {
      id: "action",
      header: t("audit.action"),
      cell: (row) => (
        <Button variant="link" onClick={() => setSelected(row)}>
          {row.action}
        </Button>
      ),
    },
    {
      id: "resource",
      header: t("audit.resource"),
      cell: (row) => (
        <span dir="ltr" className="font-mono text-xs">
          {row.resourceType} {row.resourceId ?? "—"}
        </span>
      ),
    },
    {
      id: "outcome",
      header: t("audit.result"),
      cell: (row) => <StatusBadge status={row.outcome.toLowerCase()} />,
    },
  ];
  return (
    <>
      <PageHeader title={t("audit.title")} description={t("liveAudit.description")} />
      <PageBody>
        <Section>
          <div className="flex flex-wrap gap-3 p-4">
            <label>
              {t("liveAudit.from")}
              <Input
                type="date"
                value={dates.from}
                onChange={(e) => {
                  setDates({ ...dates, from: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <label>
              {t("liveAudit.through")}
              <Input
                type="date"
                value={dates.through}
                onChange={(e) => {
                  setDates({ ...dates, through: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <FilterSelect
              label={t("audit.result")}
              value={outcome}
              onChange={(value) => {
                setOutcome(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("common.allStatuses") },
                { value: "SUCCESS", label: t("status.success") },
                { value: "DENIED", label: t("liveAudit.denied") },
                { value: "FAILURE", label: t("status.failure") },
              ]}
            />
          </div>
          <form
            className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <p className="text-sm font-medium sm:col-span-2 lg:col-span-4">
              {t("liveAudit.advancedFilters")}
            </p>
            <FilterSelect
              label={t("audit.action")}
              value={draftFilters.action}
              onChange={(action) => {
                setDraftFilters({ ...draftFilters, action });
                setFilterError(false);
              }}
              options={[
                { value: "all", label: t("liveAudit.allActions") },
                ...[...AUDIT_ACTIONS].sort().map((action) => ({ value: action, label: action })),
              ]}
            />
            <label className="space-y-2 text-sm">
              {t("liveAudit.userId")}
              <Input
                dir="ltr"
                value={draftFilters.actorUserId}
                placeholder={t("liveAudit.uuidHint")}
                onChange={(event) => {
                  setDraftFilters({ ...draftFilters, actorUserId: event.target.value });
                  setFilterError(false);
                }}
              />
            </label>
            <label className="space-y-2 text-sm">
              {t("liveAudit.credentialId")}
              <Input
                dir="ltr"
                value={draftFilters.actorCredentialId}
                placeholder={t("liveAudit.uuidHint")}
                onChange={(event) => {
                  setDraftFilters({ ...draftFilters, actorCredentialId: event.target.value });
                  setFilterError(false);
                }}
              />
            </label>
            <label className="space-y-2 text-sm">
              {t("liveAudit.resourceId")}
              <Input
                dir="ltr"
                value={draftFilters.resourceId}
                placeholder={t("liveAudit.uuidHint")}
                onChange={(event) => {
                  setDraftFilters({ ...draftFilters, resourceId: event.target.value });
                  setFilterError(false);
                }}
              />
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={!query}>
                {t("liveAudit.applyFilters")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraftFilters(emptyFilters);
                  setFilters(emptyFilters);
                  setOutcome("all");
                  setPage(1);
                  setFilterError(false);
                }}
              >
                {t("liveAudit.clearFilters")}
              </Button>
            </div>
            {filterError && (
              <p role="alert" className="text-sm sm:col-span-2 lg:col-span-4">
                {t("liveAudit.invalidFilters")}
              </p>
            )}
          </form>
          {!query ? (
            <p role="alert" className="p-4">
              {t("liveUsage.invalidRange")}
            </p>
          ) : events.isError ? (
            <ErrorState onRetry={() => void events.refetch()} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={events.data?.items}
                loading={events.isFetching}
                rowKey={(row) => row.id}
              />
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={events.data?.total ?? 0}
                onPage={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </Section>
        {isPlatform && <AuditRetention actor={actor} />}
        {selected && (
          <AuditDetail actor={actor} event={selected} onClose={() => setSelected(null)} />
        )}
      </PageBody>
    </>
  );
}

function AuditDetail({
  actor,
  event,
  onClose,
}: {
  actor: SenderIdentityActor;
  event: AdministrativeAuditEvent;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const detail = useQuery({
    ...queries.administrativeAuditDetail(actor, event.id, event.tenantId ?? undefined),
    enabled: event.tenantId !== null && !!actor.userId,
  });
  // Platform configuration events have no named tenant; the list already contains the full safe projection.
  const data = event.tenantId === null ? event : detail.data;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("liveAudit.detail")}</DialogTitle>
          <DialogDescription>{t("liveAudit.description")}</DialogDescription>
        </DialogHeader>
        {event.tenantId !== null && detail.isError ? (
          <ErrorState onRetry={() => void detail.refetch()} />
        ) : data ? (
          <dl className="grid grid-cols-2 gap-3 break-all text-sm">
            <dt>{t("audit.time")}</dt>
            <dd>{formatDateTime(data.createdAt, locale)}</dd>
            <dt>{t("audit.action")}</dt>
            <dd>{data.action}</dd>
            <dt>{t("audit.result")}</dt>
            <dd>{data.outcome}</dd>
            <dt>{t("liveAudit.correlation")}</dt>
            <dd dir="ltr">{data.correlationId}</dd>
            <dt>{t("liveAudit.changes")}</dt>
            <dd dir="ltr">
              <pre className="whitespace-pre-wrap">{JSON.stringify(data.details, null, 2)}</pre>
            </dd>
          </dl>
        ) : (
          <p role="status">{t("liveAudit.loading")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AuditRetention({ actor }: { actor: SenderIdentityActor }) {
  const { t } = useI18n(),
    client = useQueryClient();
  const policy = useQuery(queries.auditRetention(actor));
  const [days, setDays] = useState(""),
    [confirm, setConfirm] = useState(false);
  const mutation = useMutation({
    mutationFn: () => auditMutations.updateRetention(actor, Number(days)),
    onSuccess: async () => {
      setConfirm(false);
      setDays("");
      await Promise.all([
        client.invalidateQueries({ queryKey: queries.auditRetention(actor).queryKey }),
        client.invalidateQueries({ queryKey: ["administrativeAudit"] }),
      ]);
    },
  });
  return (
    <Section>
      <div className="space-y-3 p-4">
        <h2 className="font-semibold">{t("liveAudit.retention")}</h2>
        <p className="text-sm text-muted-foreground">{t("liveAudit.retentionHint")}</p>
        {policy.isError ? (
          <ErrorState onRetry={() => void policy.refetch()} />
        ) : (
          <p>
            {policy.data?.retentionDays ?? "—"} {t("liveAudit.days")}
          </p>
        )}
        <label className="block">
          {t("liveAudit.days")}
          <Input
            type="number"
            min={1}
            max={2147483647}
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              mutation.reset();
            }}
          />
        </label>
        <Button
          disabled={
            !policy.data ||
            !Number.isInteger(Number(days)) ||
            Number(days) < 1 ||
            Number(days) > 2147483647 ||
            mutation.isPending
          }
          onClick={() => setConfirm(true)}
        >
          {t("common.save")}
        </Button>
        {mutation.isSuccess && <p role="status">{t("liveAudit.saved")}</p>}
        {mutation.isError && <p role="alert">{t("common.errorBody")}</p>}
        <AlertDialog
          open={confirm}
          onOpenChange={(open) => {
            if (!mutation.isPending) setConfirm(open);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("liveAudit.retention")}</AlertDialogTitle>
              <AlertDialogDescription>{t("liveAudit.retentionHint")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={mutation.isPending}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={mutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  mutation.mutate();
                }}
              >
                {t("common.save")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Section>
  );
}
