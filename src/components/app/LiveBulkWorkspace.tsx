import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { BulkJobMonitoring } from "./BulkJobMonitoring";
import { LiveMessageSend } from "./LiveMessageSend";
import { RequirePermission } from "./RequirePermission";

export function LiveBulkWorkspace() {
  const { can } = useSession();
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  return (
    <>
      {can("messages.bulk.create") && (
        <div className="px-6 pt-4">
          <Button variant="outline" onClick={() => setCreating(!creating)}>
            {t(creating ? "humanBulk.monitor" : "humanBulk.title")}
          </Button>
        </div>
      )}
      {creating ? (
        <RequirePermission permission="messages.bulk.create">
          <LiveMessageSend bulk />
        </RequirePermission>
      ) : (
        <BulkJobMonitoring />
      )}
    </>
  );
}
