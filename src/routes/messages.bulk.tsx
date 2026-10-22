import { createFileRoute } from "@tanstack/react-router";
import { MockBulkSend } from "@/components/app/MockBulkSend";
import { LiveBulkWorkspace } from "@/components/app/LiveBulkWorkspace";
import { RequirePermission } from "@/components/app/RequirePermission";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/bulk")({
  head: () => pageHead("Bulk Jobs", "Monitor bulk job processing and item outcomes."),
  component: BulkRoute,
});
function BulkRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  if (apiMode === "mock")
    return (
      <RequirePermission permission="messages.bulk">
        <MockBulkSend />
      </RequirePermission>
    );
  return (
    <RequirePermission permission="messages.bulk.monitor">
      <LiveBulkWorkspace key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId ?? "all"}`} />
    </RequirePermission>
  );
}
