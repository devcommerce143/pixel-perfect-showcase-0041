import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockPlatformConfig } from "@/components/app/MockPlatformConfig";
import { PlatformConfigurationLive } from "@/components/app/PlatformConfigurationLive";
import { apiMode } from "@/lib/api/client";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/platform/config")({
  head: () =>
    pageHead("System Configuration", "Platform policy and persisted administrative settings."),
  component: () => (
    <RequirePermission permission="platform.config">
      {apiMode === "mock" ? <MockPlatformConfig /> : <PlatformConfigurationLive />}
    </RequirePermission>
  ),
});
