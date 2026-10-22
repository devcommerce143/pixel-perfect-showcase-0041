import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monitoringExports } from "@/lib/api/queries";
import { monitoringExportKey, monitoringExportFailureKey } from "@/lib/api/monitoring-export";
import type { MonitoringExport } from "@/lib/api/monitoring-export";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
type Props = {
  actor: SenderIdentityActor;
  request: MonitoringExport | null;
  tenantId?: string | undefined;
  disabled?: boolean | undefined;
};
export function MonitoringCsvButton(props: Props) {
  return (
    <ScopedDownload
      key={JSON.stringify(monitoringExportKey(props.actor, props.request, props.tenantId))}
      {...props}
    />
  );
}
function ScopedDownload({ actor, request, tenantId, disabled }: Props) {
  const { t } = useI18n();
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const download = useMutation({
    mutationKey: monitoringExportKey(actor, request, tenantId),
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      if (!request) return;
      const csv = await monitoringExports.download(actor, request, tenantId);
      if (!active.current) return;
      const url = URL.createObjectURL(
        new Blob([csv.startsWith("\uFEFF") ? csv : `\uFEFF${csv}`], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dolf-${request.kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      // The response stays out of mutation/query caches and persistent storage.
    },
  });
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !request || download.isPending}
        onClick={() => download.mutate()}
      >
        <Download className="size-4" />
        {t(download.isPending ? "monitoringExport.loading" : "monitoringExport.download")}
      </Button>
      {download.isError && (
        <p className="max-w-sm text-sm text-danger" role="alert">
          {t(monitoringExportFailureKey(download.error))}
        </p>
      )}
    </div>
  );
}
