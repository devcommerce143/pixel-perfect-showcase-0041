import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/plans")({
  head: () => pageHead("Subscriptions & Plans", "Plan catalogue and tenant subscriptions."),
  component: () => <ScheduledModule titleKey="nav.plans" permission="platform.plans" />,
});
