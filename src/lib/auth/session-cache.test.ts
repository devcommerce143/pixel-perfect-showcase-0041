import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QueryClient, isCancelledError } from "@tanstack/react-query";
import { sessionCacheScope } from "./session-cache.ts";
import type { SessionUser } from "./session-user.ts";

const user: SessionUser = {
  id: "actor-a",
  role: "client_admin",
  tenantId: "tenant-a",
  name: "Name",
  email: "a@example.test",
  tenantName: "Tenant",
};

describe("session cache boundary", () => {
  it("isolates identity, authorization role, tenant, mode and access status", () => {
    const base = sessionCacheScope("live", "authenticated", user);
    for (const changed of [
      { ...user, id: "actor-b" },
      { ...user, role: "viewer" as const },
      { ...user, tenantId: "tenant-b" },
      { ...user, role: "super_admin" as const, tenantId: null },
    ]) {
      assert.notEqual(sessionCacheScope("live", "authenticated", changed), base);
    }
    assert.notEqual(sessionCacheScope("mock", "authenticated", user), base);
    for (const status of [
      "loading",
      "unauthenticated",
      "forbidden",
      "error",
      "configuration",
    ] as const)
      assert.notEqual(sessionCacheScope("live", status, user), base);
    assert.equal(sessionCacheScope("live", "authenticated", { ...user, name: "Renamed" }), base);
    assert.equal(
      sessionCacheScope("live", "unauthenticated", user),
      sessionCacheScope("live", "unauthenticated", null),
    );
  });

  it("clears legacy data and mutations and prevents a late old request repopulating the cache", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    let resolveOld!: (value: string) => void;
    client.setQueryData(["settings"], { organizationName: "Old tenant" });
    client.getMutationCache().build(client, { mutationKey: ["old-actor"] });
    const oldRequest = client.fetchQuery({
      queryKey: ["users"],
      queryFn: () =>
        new Promise<string>((resolve) => {
          resolveOld = resolve;
        }),
    });
    const rejected = assert.rejects(oldRequest, (error: unknown) => isCancelledError(error));
    client.clear();
    assert.equal(client.getQueryCache().getAll().length, 0);
    assert.equal(client.getMutationCache().getAll().length, 0);
    client.setQueryData(["users"], "new actor data");
    resolveOld("old actor data");
    await rejected;
    await Promise.resolve();
    assert.equal(client.getQueryData(["users"]), "new actor data");
    assert.equal(client.getQueryData(["settings"]), undefined);
    client.clear();
  });

  it("gates consumers until clearing and remounts their local state beneath the session provider", () => {
    const boundary = readFileSync(
      new URL("../../components/auth/SessionDataBoundary.tsx", import.meta.url),
      "utf8",
    );
    assert.match(boundary, /queryClient\.clear\(\);\s*setReady\(/);
    assert.match(
      boundary,
      /if \(ready\?\.scope !== scope \|\| ready\.client !== queryClient\) return null/,
    );
    assert.match(boundary, /SessionDataScope key=\{scope\}/);
    const root = readFileSync(new URL("../../routes/__root.tsx", import.meta.url), "utf8");
    assert.match(root, /<SessionProvider>\s*<SessionDataBoundary>/);
    assert.match(
      root,
      /<SessionDataBoundary>[\s\S]*<AuthBoundary \/>[\s\S]*<\/SessionDataBoundary>/,
    );
  });
});
