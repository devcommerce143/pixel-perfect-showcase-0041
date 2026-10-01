import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/bulk")({
  head: () => pageHead("Bulk Send", "Upload, validate and send bulk SMS, WhatsApp and Email jobs."),
  component: () => <ScheduledModule titleKey="nav.bulk" permission="messages.bulk" />,
});
