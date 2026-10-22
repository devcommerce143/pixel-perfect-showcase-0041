import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockPlatformApiClients } from "@/components/app/MockPlatformApiClients";
import { CredentialMonitor } from "@/components/app/CredentialMonitor";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/platform/api-clients")({
  head: () => pageHead("API Clients", "Platform credential metadata monitoring."),
  component: ApiClientsRoute,
});
function ApiClientsRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const actor = {
    userId: user?.id ?? "",
    role: user?.role ?? "viewer",
    tenantId: user?.tenantId ?? null,
    name: user?.name ?? "",
  } as const;
  return (
    <RequirePermission permission="platform.apiClients">
      {apiMode === "mock" ? (
        <MockPlatformApiClients />
      ) : (
        <CredentialMonitor
          key={JSON.stringify([actor.userId, actor.role, actor.tenantId, tenantId])}
          actor={actor}
          tenantId={tenantId}
        />
      )}
    </RequirePermission>
  );
}
