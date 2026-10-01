import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/routing")({
  head: () => pageHead("Routing", "Provider routing and failover rules."),
  component: () => <ScheduledModule titleKey="nav.routing" permission="platform.routing" />,
});
