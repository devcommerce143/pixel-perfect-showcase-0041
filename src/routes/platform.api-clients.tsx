import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/api-clients")({
  head: () => pageHead("API Clients", "Machine identities across tenants."),
  component: () => <ScheduledModule titleKey="nav.apiClients" permission="platform.apiClients" />,
});
