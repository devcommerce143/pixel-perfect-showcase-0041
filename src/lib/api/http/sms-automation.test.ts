import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createLiveApi } from "./live-api.ts";
import {
  mapSmsAutomation,
  smsAutomationBody,
  smsAutomationKey,
  smsAutomationPath,
} from "../sms-automation.ts";
import { en } from "../../i18n/en.ts";
import { ar } from "../../i18n/ar.ts";
const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "super_admin",
  tenantId: null,
  name: "Admin",
} as const;
const tenant = "22222222-2222-4222-8222-222222222222";
const routine = {
  state: "ENABLED",
  bulkEnabled: false,
  maxSubmissions: null,
  validUntil: null,
  revision: 1,
} as const;
const input = { ...routine, expectedRevision: 0, confirmPendingWork: true };
function render(
  options: {
    ar?: boolean;
    missing?: boolean;
    loading?: boolean;
    error?: boolean;
    confirm?: boolean;
  } = {},
) {
  const strings = options.ar ? ar : en;
  const primitive = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children);
  const ui = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === "Button"
          ? (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
              React.createElement("button", { disabled: props.disabled }, props.children)
          : primitive,
    },
  );
  let index = 0;
  const source = readFileSync(
    new URL("../../../components/app/TenantSmsAutomation.tsx", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const require = createRequire(import.meta.url);
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name: string) => {
      if (name === "react")
        return {
          ...React,
          useState: (initial: unknown) => [
            options.confirm ? [input, "", "", true][index++] : initial,
            () => {},
          ],
        };
      if (name === "@tanstack/react-query")
        return {
          useQuery: () => ({
            data: options.missing ? null : routine,
            isPending: options.loading,
            isError: options.error,
          }),
          useQueryClient: () => ({}),
          useMutation: () => ({}),
        };
      if (name === "@/lib/api/queries") return { queries: { smsAutomation: () => ({}) } };
      if (name === "@/lib/api/http/errors") return { ApiError: class extends Error {} };
      if (name === "@/lib/auth/session")
        return {
          useSession: () => ({ user: { id: actor.userId, role: actor.role, tenantId: null } }),
        };
      if (name === "@/lib/i18n/i18n")
        return {
          useI18n: () => ({
            locale: options.ar ? "ar" : "en",
            t: (key: keyof typeof en) => strings[key],
          }),
        };
      if (name.endsWith("/States"))
        return {
          ErrorState: () => React.createElement("p", null, "safe-error"),
          TableSkeleton: () => React.createElement("p", null, "loading"),
        };
      if (name.endsWith("/MessageAlert"))
        return {
          MessageAlert: ({ title, children }: { title: string; children: React.ReactNode }) =>
            React.createElement("div", { role: "status" }, title, children),
        };
      if (name.startsWith("@/components/ui/")) return ui;
      return require(name);
    },
  });
  return renderToStaticMarkup(
    React.createElement(
      module.exports["TenantSmsAutomation"] as React.ComponentType<{ tenantId: string }>,
      { tenantId: tenant },
    ),
  ).replaceAll("&#x27;", "'");
}
describe("tenant SMS automation", () => {
  it("maps missing and routine states without inventing limits or exposing extras", () => {
    assert.equal(mapSmsAutomation(null), null);
    assert.deepEqual(mapSmsAutomation({ ...routine, secret: "omit" }), routine);
    for (const patch of [
      { state: "unknown" },
      { validUntil: undefined },
      { maxSubmissions: 0 },
      { maxSubmissions: 21 },
      { revision: 0 },
    ])
      assert.throws(() => mapSmsAutomation({ ...routine, ...patch }));
    assert.equal(
      mapSmsAutomation({ ...routine, maxSubmissions: 3, validUntil: "2027-01-01T00:00:00.000Z" })
        ?.maxSubmissions,
      3,
    );
  });
  it("requires platform authority, isolates tenant/identity keys, and requires backlog confirmation", () => {
    assert.equal(smsAutomationPath(actor, tenant), `/tenants/${tenant}/sms-automation`);
    assert.throws(() => smsAutomationPath({ ...actor, role: "viewer" }, tenant));
    assert.throws(() => smsAutomationPath(actor, tenant + "\n"));
    assert.notDeepEqual(smsAutomationKey(actor, tenant), smsAutomationKey(actor, actor.userId));
    assert.notDeepEqual(
      smsAutomationKey(actor, tenant),
      smsAutomationKey({ ...actor, userId: tenant }, tenant),
    );
    assert.throws(() => smsAutomationBody({ ...input, confirmPendingWork: false }));
    assert.equal(
      smsAutomationBody({ ...input, state: "PAUSED", confirmPendingWork: false }).state,
      "PAUSED",
    );
    assert.equal(smsAutomationBody(input).bulkEnabled, false);
  });
  it("uses named-tenant live GET/PUT, confirms pending work and preserves null restrictions", async () => {
    const calls: unknown[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.invalid/api/v1",
      getAccessToken: () => "synthetic",
      fetchImpl: async (url, init) => {
        assert.ok(String(url).endsWith(`/tenants/${tenant}/sms-automation`));
        assert.equal(
          (init?.headers as Record<string, string>)["Authorization"],
          "Bearer synthetic",
        );
        calls.push(init?.body ? JSON.parse(String(init.body)) : null);
        return new Response(JSON.stringify(init?.method === "PUT" ? { revision: 1 } : null), {
          status: 200,
        });
      },
    });
    assert.equal(await api.getSmsAutomation(actor, tenant), null);
    assert.deepEqual(await api.updateSmsAutomation(actor, tenant, input), { revision: 1 });
    assert.deepEqual(calls[1], {
      state: "ENABLED",
      bulkEnabled: false,
      maxSubmissions: null,
      validUntil: null,
      expectedRevision: 0,
      confirmPendingWork: true,
    });
  });
  it("does not hide conflicts/failures behind mock success", async () => {
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.invalid",
      getAccessToken: () => "synthetic",
      fetchImpl: async () => new Response("{}", { status: 409 }),
    });
    await assert.rejects(api.updateSmsAutomation(actor, tenant, input));
    await assert.rejects(api.getSmsAutomation(actor, tenant));
  });
  it("renders routine, missing, loading, errors and EN/AR confirmation with logical alignment", () => {
    assert.ok(render().includes(en["smsAuto.continuous"]));
    assert.ok(render({ missing: true }).includes(en["smsAuto.missingHint"]));
    assert.ok(render({ loading: true }).includes("loading"));
    assert.ok(render({ error: true }).includes("safe-error"));
    assert.ok(render({ confirm: true }).includes(en["smsAuto.confirm"]));
    assert.ok(render({ ar: true, confirm: true }).includes(ar["smsAuto.confirm"]));
    assert.ok(render({ ar: true }).includes("text-start"));
  });
});
