import type { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n";

type TenantOptionsQueryState = Pick<
  UseQueryResult<unknown, Error>,
  "isPending" | "isError" | "isFetching" | "refetch"
>;

export function TenantOptionsStatus({ query }: { query: TenantOptionsQueryState }) {
  const { t } = useI18n();

  if (query.isPending) {
    return <p className="text-xs text-muted-foreground">{t("ten.optionsLoading")}</p>;
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-danger">
        <span>{t("ten.optionsError")}</span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  return null;
}
