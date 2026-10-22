import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api/queries";
import type { SenderIdentityActor } from "@/lib/api/types";
import type { HistoryApplicationSelection } from "@/lib/api/history-application-options";
import { historyApplicationScope } from "@/lib/api/message-history-query-keys";
import { useI18n } from "@/lib/i18n/i18n";
import { ErrorState, TableSkeleton } from "./States";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function MessageHistoryApplicationFilter({
  actor,
  tenantId,
  allTenants,
  selected,
  onChange,
}: {
  actor: SenderIdentityActor;
  tenantId?: string | undefined;
  allTenants: boolean;
  selected: HistoryApplicationSelection | undefined;
  onChange: (value: HistoryApplicationSelection | undefined) => void;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const applications = useQuery(
    queries.historyApplicationOptions(actor, page, tenantId, allTenants),
  );
  return (
    <div className="grid min-w-64 gap-1.5">
      <Label>{t("historyApps.label")}</Label>
      {applications.isError ? (
        <ErrorState onRetry={() => void applications.refetch()} />
      ) : applications.isPending ? (
        <TableSkeleton rows={1} />
      ) : (
        <>
          <Select
            value={selected?.id ?? "all"}
            onValueChange={(id) => {
              if (id === "all") {
                onChange(undefined);
                return;
              }
              const row = applications.data.items.find((item) => item.id === id);
              if (!row) return;
              onChange({
                id: row.id,
                label: `${row.name}${allTenants && row.tenantName ? ` / ${row.tenantName}` : ""} (${row.id})`,
                scope: historyApplicationScope(actor, tenantId, allTenants),
              });
            }}
          >
            <SelectTrigger aria-label={t("historyApps.label")}>
              <SelectValue>{selected?.label ?? t("historyApps.all")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("historyApps.all")}</SelectItem>
              {applications.data.items.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name}
                  {allTenants && row.tenantName ? ` / ${row.tenantName}` : ""} ({row.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1 || applications.isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page * 20 >= applications.data.total || applications.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
