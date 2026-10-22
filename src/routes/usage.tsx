import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockUsage } from "@/components/app/MockUsage";
import { UsageReportLive } from "@/components/app/UsageReportLive";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/usage")({
  validateSearch: (search: Record<string, unknown>) => ({
    tenantId: typeof search["tenantId"] === "string" ? search["tenantId"] : undefined,
  }),
  head: () => pageHead("Usage", "Message counts and monthly quota snapshots."),
  component: UsageRoute,
});
function UsageRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="usage.view">
      {apiMode === "mock" ? (
        <MockUsage requestedTenantId={tenantId} />
      ) : (
        <UsageReportLive
          key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`}
          view="usage"
        />
      )}
    </RequirePermission>
  );
}
