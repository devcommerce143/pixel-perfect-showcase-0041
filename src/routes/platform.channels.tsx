import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/channels")({
  head: () => pageHead("Channels", "Platform channel configuration."),
  component: () => <ScheduledModule titleKey="nav.channels" permission="platform.channels" />,
});
