import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockProviderHealth } from "@/components/app/MockProviderHealth";
import { ProviderMonitoring } from "@/components/app/ProviderMonitoring";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/platform/health")({
  head: () => pageHead("Provider Health", "Recorded platform provider health observations."),
  component: HealthRoute,
});
function HealthRoute() {
  const { user } = useSession();
  return (
    <RequirePermission permission="platform.health">
      {apiMode === "mock" ? (
        <MockProviderHealth />
      ) : (
        <ProviderMonitoring key={`${user?.id}:${user?.role}:${user?.tenantId}`} view="health" />
      )}
    </RequirePermission>
  );
}
