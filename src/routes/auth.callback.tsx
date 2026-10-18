import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { consumeReturnTo } from "@/lib/auth/oidc";
import { useI18n } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/auth/callback")({
  head: () => pageHead("Sign in", "Completing organization sign-in."),
  component: CallbackPage,
});

function CallbackPage() {
  const { status, completeOrganizationSignIn } = useSession();
  const { t } = useI18n();
  const started = useRef(false);
  const destination = useRef<string | null>(null);

  useEffect(() => {
    if (started.current || status === "configuration") return;
    started.current = true;
    void completeOrganizationSignIn();
  }, [completeOrganizationSignIn, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!destination.current) destination.current = consumeReturnTo();
    const target =
      destination.current.startsWith("/") && !destination.current.startsWith("//")
        ? destination.current
        : "/";
    window.location.replace(target);
  }, [status]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4" role="status">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {t("auth.callbackWorking")}
      </div>
    </main>
  );
}
