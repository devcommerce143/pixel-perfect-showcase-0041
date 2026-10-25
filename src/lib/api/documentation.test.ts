import assert from "node:assert/strict";
import { test } from "node:test";
import { API_ROUTES, documentationRoutes } from "./documentation.ts";

test("client documentation excludes platform administration and provider callbacks", () => {
  const routes = documentationRoutes(false, "");
  assert.ok(routes.some((route) => route.path === "/api/v1/messages"));
  assert.ok(routes.some((route) => route.path === "/api/v1/applications"));
  assert.ok(routes.every((route) => ["human", "machine"].includes(route.audience)));
  assert.ok(!routes.some((route) => route.path.startsWith("/api/v1/tenants")));
  assert.ok(!routes.some((route) => route.path.startsWith("/api/v1/plans")));
});

test("full reference includes platform and gated provider routes without duplicate operations", () => {
  const routes = documentationRoutes(true, "");
  assert.equal(routes.length, API_ROUTES.length);
  assert.ok(routes.some((route) => route.audience === "platform"));
  assert.ok(routes.some((route) => route.audience === "callback"));
  assert.equal(new Set(routes.map((route) => `${route.method} ${route.path}`)).size, routes.length);
});

test("search is case insensitive and cannot reveal excluded platform routes", () => {
  assert.equal(documentationRoutes(false, " platform ").length, 0);
  assert.ok(documentationRoutes(true, " platform ").length > 0);
  assert.ok(documentationRoutes(false, " BULK-JOBS ").length > 0);
  assert.equal(documentationRoutes(true, "not-a-real-route").length, 0);
});
