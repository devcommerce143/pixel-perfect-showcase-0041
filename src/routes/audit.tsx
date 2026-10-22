import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockAudit } from "@/components/app/MockAudit";
import { AdministrativeAudit } from "@/components/app/AdministrativeAudit";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/audit")({
  head: () => pageHead("Audit Logs", "Administrative audit events."),
  component: AuditRoute,
});
function AuditRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="audit.view">
      {apiMode === "mock" ? (
        <MockAudit />
      ) : (
        <AdministrativeAudit key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`} />
      )}
    </RequirePermission>
  );
}
