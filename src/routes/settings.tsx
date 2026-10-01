import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Tenant settings for Dolf Connect."),
  component: () => <ScheduledModule titleKey="nav.settings" permission="settings.view" />,
});
