import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockProviderRouting } from "@/components/app/MockProviderRouting";
import { ProviderRouting } from "@/components/app/ProviderRouting";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/platform/routing")({
  head: () => pageHead("Routing", "Provider route configuration and tenant/sender assignments."),
  component: RoutingRoute,
});
function RoutingRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="platform.routing">
      {apiMode === "mock" ? (
        <MockProviderRouting />
      ) : (
        <ProviderRouting key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`} />
      )}
    </RequirePermission>
  );
}
