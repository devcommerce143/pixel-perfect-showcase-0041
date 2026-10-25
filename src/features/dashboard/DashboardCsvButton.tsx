import { MessageAlert } from "@/components/app/MessageAlert";
import { useState } from "react";
import { Download } from "lucide-react";
import { dashboardSummaryCsv } from "@/lib/api/dashboard-completion";
import type { DashboardSummary } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";

export function DashboardCsvButton({
  summary,
  tenantId,
  disabled,
}: {
  summary: DashboardSummary;
  tenantId?: string | undefined;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  function download() {
    setFailed(false);
    try {
      const csv = dashboardSummaryCsv(summary, tenantId);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dolf-dashboard-${summary.scope ?? "mock"}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setFailed(true);
    }
  }
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={download}
        title={t("dashOps.exportHint")}
      >
        <Download className="size-4" />
        {t("dashOps.export")}
      </Button>
      {failed && (
        <MessageAlert className="text-danger text-sm">{t("common.errorBody")}</MessageAlert>
      )}
    </div>
  );
}
