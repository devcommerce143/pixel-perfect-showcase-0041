import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platform/config")({
  head: () => pageHead("System Configuration", "Platform-wide configuration."),
  component: () => <ScheduledModule titleKey="nav.config" permission="platform.config" />,
});
