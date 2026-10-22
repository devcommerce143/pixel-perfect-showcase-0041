import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockWebhooks } from "@/components/app/MockWebhooks";
import { WebhookRegistry } from "@/components/app/WebhookRegistry";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/webhooks")({
  head: () => pageHead("Webhooks", "Configure delivery status callbacks to your systems."),
  component: WebhooksRoute,
});
function WebhooksRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="webhooks.view">
      {apiMode === "mock" ? (
        <MockWebhooks />
      ) : (
        <WebhookRegistry key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`} />
      )}
    </RequirePermission>
  );
}
