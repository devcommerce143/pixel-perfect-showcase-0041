import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/webhooks")({
  head: () => pageHead("Webhooks", "Configure delivery status callbacks to your systems."),
  component: () => <ScheduledModule titleKey="nav.webhooks" permission="webhooks.view" />,
});
