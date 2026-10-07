import { useEffect } from "react";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
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
  const { status } = useSession();
  const { t } = useI18n();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (status === "authenticated" && isLogin) {
      const requested = (search as { returnTo?: unknown }).returnTo;
      navigateTo(router, isSafeReturnTo(requested) ? requested : "/");
    } else if (status === "unauthenticated" && !isLogin) {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      void router.navigate({ to: "/login" as never, search: { returnTo } as never, replace: true } as never);
    }
  }, [isLogin, pathname, router, search, status]);

  if (isLogin) return <Outlet />;
  if (status !== "authenticated") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4" role="status">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{t("auth.restoring")}</div>
      </main>
    );
  }
  return <AppShell><Outlet /></AppShell>;
}