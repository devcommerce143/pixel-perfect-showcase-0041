import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockProviders } from "@/components/app/MockProviders";
import { ProviderMonitoring } from "@/components/app/ProviderMonitoring";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/platform/providers")({
  head: () =>
    pageHead("Gateways & Providers", "Platform provider account metadata and recorded health."),
  validateSearch: (search: Record<string, unknown>) => ({
    providerId: typeof search["providerId"] === "string" ? search["providerId"] : undefined,
  }),
  component: ProvidersRoute,
});
function ProvidersRoute() {
  const { user } = useSession();
  const { providerId } = Route.useSearch();
  return (
    <RequirePermission permission="platform.providers">
      {apiMode === "mock" ? (
        <MockProviders providerId={providerId} />
      ) : (
        <ProviderMonitoring
          key={`${user?.id}:${user?.role}:${user?.tenantId}:${providerId}`}
          view="accounts"
          initialId={providerId}
        />
      )}
    </RequirePermission>
  );
}
