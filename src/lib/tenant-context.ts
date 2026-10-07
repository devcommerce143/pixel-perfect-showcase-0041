import { useCallback } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useSession } from "@/lib/auth/session";

export function useGlobalTenantContext() {
  const { user, isPlatform } = useSession();
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const tenantId = isPlatform && typeof location.search.tenantId === "string" ? location.search.tenantId : undefined;
  const scopedTenantId = isPlatform ? tenantId : user?.tenantId ?? undefined;
  const setTenantId = useCallback((nextTenantId?: string) => {
    if (!isPlatform) return;
    void router.navigate({
      to: location.pathname as never,
      search: (previous) => ({ ...previous, tenantId: nextTenantId }) as never,
      replace: true,
    });
  }, [isPlatform, location.pathname, router]);

  return { tenantId, scopedTenantId, isPlatform, setTenantId };
}