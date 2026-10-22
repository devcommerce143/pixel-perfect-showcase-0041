import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "@/components/app/RequirePermission";
import { MockSendMessage } from "@/components/app/MockSendMessage";
import { LiveMessageSend } from "@/components/app/LiveMessageSend";
import { apiMode } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/messages/send")({
  head: () => pageHead("Submit Message", "Accept a message for asynchronous processing."),
  component: SendMessageRoute,
});
function SendMessageRoute() {
  const { isPlatform } = useSession();
  return (
    <RequirePermission
      permission={apiMode === "live" && isPlatform ? "platform.messages.submit" : "messages.send"}
    >
      {apiMode === "mock" ? <MockSendMessage /> : <LiveMessageSend />}
    </RequirePermission>
  );
}
