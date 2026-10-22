import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockChannels } from "@/components/app/MockChannels";
import { TenantPolicyLive } from "@/components/app/TenantPolicyLive";
import { apiMode } from "@/lib/api/client";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/platform/channels")({
  head: () => pageHead("Channels", "Tenant policy and channel entitlements."),
  component: () => (
    <RequirePermission permission="platform.channels">
      {apiMode === "mock" ? <MockChannels /> : <TenantPolicyLive view="channels" />}
    </RequirePermission>
  ),
});
