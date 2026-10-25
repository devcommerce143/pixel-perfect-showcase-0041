import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { BulkJobMonitoring } from "./BulkJobMonitoring";
import { LiveMessageSend } from "./LiveMessageSend";
import { RequirePermission } from "./RequirePermission";
import { BulkCsvSamples } from "./BulkCsvSamples";
import { Plus } from "lucide-react";

export function LiveBulkWorkspace() {
  const { can } = useSession();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const actions = (
    <>
      <BulkCsvSamples />
      {can("messages.bulk.create") && (
        <Button variant={creating ? "outline" : "default"} onClick={() => setCreating(!creating)}>
          {!creating && <Plus className="size-4" aria-hidden="true" />}
          {t(creating ? "humanBulk.monitor" : "humanBulk.title")}
        </Button>
      )}
    </>
  );
  return (
    <>
      {creating ? (
        <RequirePermission permission="messages.bulk.create">
          <LiveMessageSend bulk headerActions={actions} />
        </RequirePermission>
      ) : (
        <BulkJobMonitoring headerActions={actions} />
      )}
    </>
  );
}
