import { RecordReference } from "@/components/app/RecordReference";
import { useEffect, type ReactNode } from "react";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";

function isSafeReturnTo(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function navigateTo(router: ReturnType<typeof useRouter>, destination: string) {
  const url = new URL(destination, window.location.origin);
  if (url.origin !== window.location.origin) {
    void router.navigate({ to: "/" as never, replace: true });
    return;
  }
  void router.navigate({
    to: url.pathname as never,
    search: Object.fromEntries(url.searchParams) as never,
    hash: url.hash.slice(1) as never,
    replace: true,
  } as never);
}

export function AuthBoundary() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search });
  const { status, configurationIssues, correlationId, retryProfile, signOut } =
    useSession();
  const { t } = useI18n();
  const isLogin = pathname === "/login";
  const isCallback = pathname === "/auth/callback";

  useEffect(() => {
    if (status === "authenticated" && isLogin) {
      const requested = (search as { returnTo?: unknown }).returnTo;
      navigateTo(router, isSafeReturnTo(requested) ? requested : "/");
    } else if (status === "unauthenticated" && !isLogin) {
      if (isCallback) {
        void router.navigate({ to: "/login" as never, replace: true });
      } else {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        void router.navigate({
          to: "/login" as never,
          search: { returnTo } as never,
          replace: true,
        } as never);
      }
    }
  }, [isCallback, isLogin, pathname, router, search, status]);

  if (isLogin) return <Outlet />;
  if (
    isCallback &&
    (status === "loading" || status === "authenticated" || status === "unauthenticated")
  )
    return <Outlet />;
  if (status === "configuration") {
    return (
      <FoundationNotice title={t("auth.configurationTitle")} body={t("auth.configurationBody")}>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          {configurationIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </FoundationNotice>
    );
  }
  if (status === "forbidden") {
    return (
      <FoundationNotice
        title={t("common.forbiddenTitle")}
        body={t("auth.profileForbidden")}
        correlationId={correlationId}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void signOut()}
        >
          {t("header.signOut")}
        </Button>
      </FoundationNotice>
    );
  }
  if (status === "error") {
    return (
      <FoundationNotice
        title={t("common.errorTitle")}
        body={t("auth.profileError")}
        correlationId={correlationId}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void retryProfile()}
        >
          {t("common.retry")}
        </Button>
      </FoundationNotice>
    );
  }
  if (status !== "authenticated") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4" role="status">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {t("auth.restoring")}
        </div>
      </main>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function FoundationNotice({
  title,
  body,
  correlationId,
  children,
}: {
  title: string;
  body: string;
  correlationId?: string | null;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="panel w-full max-w-lg p-6" role="alert">
        <h1 className="text-card-title">{title}</h1>
        <p className="text-subtle mt-2">{body}</p>
        {correlationId && (
          <p className="mt-2 text-caption text-muted-foreground">
            <RecordReference value={correlationId} />
          </p>
        )}
        {children}
      </div>
    </main>
  );
}
