import { createFileRoute } from "@tanstack/react-router";
import { ScheduledModule } from "@/components/app/ScheduledModule";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/users")({
  head: () => pageHead("Users", "Manage users and role assignments."),
  component: () => <ScheduledModule titleKey="nav.users" permission="users.view" />,
});
