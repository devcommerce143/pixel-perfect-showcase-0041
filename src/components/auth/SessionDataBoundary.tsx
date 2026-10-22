import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { sessionCacheScope } from "@/lib/auth/session-cache";

/** Gate consumers before clearing so a new principal cannot render old cached data. */
export function SessionDataBoundary({ children }: { children: ReactNode }) {
  const { mode, status, user } = useSession();
  const queryClient = useQueryClient();
  const scope = sessionCacheScope(mode, status, user);
  const [ready, setReady] = useState<{ scope: string; client: typeof queryClient } | null>(null);

  useEffect(() => {
    // clear() cancels outstanding queries and removes both query and mutation caches.
    // It cannot undo server mutations; remounting below drops old local dialog state.
    queryClient.clear();
    setReady({ scope, client: queryClient });
  }, [queryClient, scope]);

  if (ready?.scope !== scope || ready.client !== queryClient) return null;
  return <SessionDataScope key={scope}>{children}</SessionDataScope>;
}

function SessionDataScope({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
