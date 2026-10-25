import assert from "node:assert/strict";
import { test } from "node:test";
import { canResolveEntity, entityNameKey, humanName } from "./entity-names.ts";
import type { SenderIdentityActor } from "./types.ts";

const viewer: SenderIdentityActor = {
  userId: "user-a",
  tenantId: "tenant-a",
  role: "viewer",
  name: "Sara",
};
test("names preserve real labels and reject blank or UUID fallbacks", () => {
  assert.equal(humanName("  Dolftech  "), "Dolftech");
  assert.equal(humanName("NAAHEL"), "NAAHEL");
  assert.equal(humanName(""), null);
  assert.equal(humanName("593d3b12-613e-49c9-90ac-45941a827edf"), null);
  assert.equal(humanName(null), null);
});
test("name lookups enforce tenant scope and platform-only catalog access", () => {
  assert.equal(canResolveEntity(viewer, "application", "app-a", "tenant-a"), true);
  assert.equal(canResolveEntity(viewer, "application", "app-b", "tenant-b"), false);
  assert.equal(canResolveEntity(viewer, "tenant", "tenant-a"), false);
  assert.equal(canResolveEntity(viewer, "provider", "provider-a"), false);
  const platform = { ...viewer, role: "super_admin" as const, tenantId: null };
  assert.equal(canResolveEntity(platform, "application", "app-a"), false);
  assert.equal(canResolveEntity(platform, "application", "app-a", "tenant-a"), true);
  assert.equal(canResolveEntity({ ...viewer, userId: "" }, "sender", "sender-a"), false);
});
test("cached names isolate identity, role, tenant, target scope and entity", () => {
  const key = entityNameKey(viewer, "application", "same-id", "tenant-a");
  for (const other of [
    entityNameKey({ ...viewer, userId: "user-b" }, "application", "same-id", "tenant-a"),
    entityNameKey({ ...viewer, role: "operator" }, "application", "same-id", "tenant-a"),
    entityNameKey({ ...viewer, tenantId: "tenant-b" }, "application", "same-id", "tenant-a"),
    entityNameKey(viewer, "application", "same-id", "tenant-b"),
    entityNameKey(viewer, "sender", "same-id", "tenant-a"),
    entityNameKey(viewer, "application", "other-id", "tenant-a"),
  ])
    assert.notDeepEqual(key, other);
});
