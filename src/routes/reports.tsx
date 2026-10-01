import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/reports")({
  head: () => pageHead("Reports", "Delivery and usage reporting across channels and applications."),
  component: () => <ScheduledModule titleKey="nav.reports" permission="reports.view" />,
});
