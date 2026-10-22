import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockReports } from "@/components/app/MockReports";
import { UsageReportLive } from "@/components/app/UsageReportLive";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/reports")({
  head: () => pageHead("Reports", "Message counts and monthly quota snapshots."),
  component: ReportsRoute,
});
function ReportsRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="reports.view">
      {apiMode === "mock" ? (
        <MockReports />
      ) : (
        <UsageReportLive
          key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`}
          view="reports"
        />
      )}
    </RequirePermission>
  );
}
