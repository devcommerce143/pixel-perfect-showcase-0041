import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockSettings } from "@/components/app/MockSettings";
import { TenantPolicyLive } from "@/components/app/TenantPolicyLive";
import { apiMode } from "@/lib/api/client";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Tenant policy and channel entitlements."),
  component: () => (
    <RequirePermission permission="settings.view">
      {apiMode === "mock" ? <MockSettings /> : <TenantPolicyLive view="settings" />}
    </RequirePermission>
  ),
});
