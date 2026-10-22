import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockCredentials } from "@/components/app/MockCredentials";
import { CredentialRegistry } from "@/components/app/CredentialRegistry";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/credentials")({
  head: () => pageHead("API Credentials", "Manage application machine credentials."),
  validateSearch: (search: Record<string, unknown>) => ({
    applicationId:
      typeof search["applicationId"] === "string" ? search["applicationId"] : undefined,
  }),
  component: CredentialsRoute,
});
function CredentialsRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  const { applicationId } = Route.useSearch();
  return (
    <RequirePermission permission="credentials.view">
      {apiMode === "mock" ? (
        <MockCredentials filterApplicationId={applicationId} />
      ) : (
        <CredentialRegistry
          key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}:${applicationId}`}
          initialApplicationId={applicationId}
        />
      )}
    </RequirePermission>
  );
}
