import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockTemplates } from "@/components/app/MockTemplates";
import { LiveTemplateWorkspace } from "@/components/app/LiveTemplateWorkspace";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useGlobalTenantContext } from "@/lib/tenant-context";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/templates")({
  head: () => pageHead("Templates", "Manage template registry and approval evidence."),
  component: TemplatesRoute,
});
function TemplatesRoute() {
  const { user } = useSession();
  const { tenantId } = useGlobalTenantContext();
  return (
    <RequirePermission permission="templates.view">
      {apiMode === "mock" ? (
        <MockTemplates />
      ) : (
        <LiveTemplateWorkspace key={`${user?.id}:${user?.role}:${user?.tenantId}:${tenantId}`} />
      )}
    </RequirePermission>
  );
}
