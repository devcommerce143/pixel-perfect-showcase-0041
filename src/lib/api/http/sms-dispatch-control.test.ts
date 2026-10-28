import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { en } from "../../i18n/en.ts";
import { ar } from "../../i18n/ar.ts";
import { createLiveApi } from "./live-api.ts";
import {
  mapSmsDispatchControl,
  smsDispatchChangeBody,
  smsDispatchControlKey,
  smsDispatchControlPath,
} from "../sms-dispatch-control.ts";
const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "super_admin",
  tenantId: null,
  name: "Admin",
} as const;
const state = {
  enabled: false,
  revision: 0,
  updatedAt: "2026-10-26T00:00:00.000Z",
  updatedByName: null,
};
// Render the actual component with controlled query/state hooks and simple UI
// primitives. No app/session/API initialization, DOM, backend or provider calls.
function renderControl(
  options: {
    locale?: "en" | "ar";
    pending?: boolean;
    error?: boolean;
    enabled?: boolean;
    saving?: boolean;
    confirm?: boolean;
    role?: string;
  } = {},
) {
  const source = readFileSync(
    new URL("../../../components/app/SmsDispatchControl.tsx", import.meta.url),
    "utf8",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const require = createRequire(import.meta.url);
  const module = { exports: {} as Record<string, unknown> };
  const dictionary = options.locale === "ar" ? ar : en;
  const t = (key: keyof typeof en, params?: Record<string, string>) =>
    Object.entries(params ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, value),
      dictionary[key],
    );
  const element =
    (tag: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(tag, props, children as React.ReactNode);
  let hook = 0;
  const primitives = Object.fromEntries(
    [
      "AlertDialogContent",
      "AlertDialogHeader",
      "AlertDialogTitle",
      "AlertDialogDescription",
      "AlertDialogFooter",
    ].map((name) => [name, element("div")]),
  );
  const imports: Record<string, unknown> = {
    react: {
      useState: () => [
        hook++ === 0 ? (options.confirm ?? false) : { enabled: true, revision: 0 },
        () => {},
      ],
    },
    "@tanstack/react-query": {
      useQuery: () => ({
        data:
          options.pending || options.error
            ? undefined
            : { ...state, enabled: options.enabled ?? false },
        isError: options.error ?? false,
        isPending: options.pending ?? false,
        isFetching: false,
      }),
      useQueryClient: () => ({}),
      useMutation: () => ({ isPending: options.saving ?? false }),
    },
    "@/lib/api/queries": { queries: { smsDispatchControl: () => ({}) }, smsDispatchMutations: {} },
    "@/lib/i18n/i18n": { useI18n: () => ({ t, locale: options.locale ?? "en" }) },
    "@/components/ui/button": { Button: element("button") },
    "@/components/ui/alert-dialog": {
      ...primitives,
      AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? children : null,
      AlertDialogCancel: element("button"),
      AlertDialogAction: element("button"),
    },
    "./PageHeader": {
      Section: ({ title, children }: { title: string; children: React.ReactNode }) =>
        React.createElement("section", null, React.createElement("h2", null, title), children),
    },
    "./MessageAlert": {
      MessageAlert: ({ children, title }: { children: React.ReactNode; title: string }) =>
        React.createElement("div", { role: "status" }, title, children),
    },
    "./States": {
      ErrorState: () => React.createElement("div", { role: "alert" }, "safe-error"),
      TableSkeleton: () => React.createElement("div", { "aria-busy": true }, "loading"),
    },
  };
  runInNewContext(javascript, {
    exports: module.exports,
    module,
    require: (name: string) => imports[name] ?? require(name),
  });
  const Component = module.exports["SmsDispatchControl"] as React.ComponentType<{
    actor: typeof actor;
  }>;
  return renderToStaticMarkup(
    React.createElement(Component, {
      actor: { ...actor, role: options.role ?? actor.role } as typeof actor,
    }),
  );
}
describe("durable SMS dispatch control", () => {
  it("renders server state, held-work guidance, loading and safe errors", () => {
    assert.ok(renderControl().includes(en["smsControl.disabledHint"]));
    assert.ok(renderControl({ enabled: true }).includes(en["smsControl.enabled"]));
    assert.ok(renderControl({ pending: true }).includes('aria-busy="true"'));
    assert.ok(renderControl({ error: true }).includes('role="alert"'));
    assert.equal(renderControl({ role: "viewer" }), "");
  });
  it("renders Arabic confirmation and disables submission while saving", () => {
    const html = renderControl({ locale: "ar", confirm: true, saving: true });
    assert.ok(html.includes(ar["smsControl.enableWarning"]));
    assert.ok(html.includes(ar["smsControl.saving"]));
    assert.ok(html.includes('disabled=""'));
    assert.ok(html.includes("text-start"));
  });
  it("validates and allowlists backend data without false success", () => {
    assert.deepEqual(mapSmsDispatchControl({ ...state, token: "must-not-return" }), state);
    for (const invalid of [
      null,
      {},
      { ...state, enabled: "false" },
      { ...state, enabled: true, revision: 0 },
      { ...state, revision: -1 },
      { ...state, updatedAt: "invalid" },
    ])
      assert.throws(() => mapSmsDispatchControl(invalid));
  });
  it("requires platform identity, stable identity-scoped keys and enable confirmation", () => {
    assert.equal(smsDispatchControlPath(actor), "/platform/sms-dispatch");
    assert.throws(() => smsDispatchControlPath({ ...actor, role: "viewer" }));
    assert.notDeepEqual(
      smsDispatchControlKey(actor),
      smsDispatchControlKey({ ...actor, userId: "other" }),
    );
    assert.throws(() => smsDispatchChangeBody(true, 0, false));
    assert.deepEqual(smsDispatchChangeBody(true, 0, true), {
      enabled: true,
      expectedRevision: 0,
      confirmEnable: true,
    });
    assert.deepEqual(smsDispatchChangeBody(false, 1, false), {
      enabled: false,
      expectedRevision: 1,
      confirmEnable: false,
    });
  });
  it("uses authenticated GET and PUT and validates their server responses", async () => {
    const requests: { path: string; method: string | undefined; body: unknown }[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.invalid/api/v1",
      getAccessToken: () => "synthetic-test-token",
      fetchImpl: async (input, init) => {
        requests.push({
          path: String(input),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        assert.equal(
          (init?.headers as Record<string, string>)["Authorization"],
          "Bearer synthetic-test-token",
        );
        return new Response(
          JSON.stringify(init?.method === "PUT" ? { enabled: true, revision: 1 } : state),
          { status: 200 },
        );
      },
    });
    assert.deepEqual(await api.getSmsDispatchControl(actor), state);
    assert.deepEqual(await api.updateSmsDispatchControl(actor, true, 0, true), {
      enabled: true,
      revision: 1,
    });
    assert.ok(requests.every((r) => r.path.endsWith("/api/v1/platform/sms-dispatch")));
    assert.equal(requests[1]?.method, "PUT");
    assert.deepEqual(requests[1]?.body, {
      enabled: true,
      expectedRevision: 0,
      confirmEnable: true,
    });
  });
  it("keeps live failures as errors and never substitutes mock state", async () => {
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.invalid/api/v1",
      getAccessToken: () => "synthetic",
      fetchImpl: async () => new Response("{}", { status: 503 }),
    });
    await assert.rejects(api.getSmsDispatchControl(actor));
    await assert.rejects(api.updateSmsDispatchControl(actor, false, 0, false));
  });
  it("UI source preserves confirmation, pending/error states and server refresh", () => {
    const source = readFileSync(
      new URL("../../../components/app/SmsDispatchControl.tsx", import.meta.url),
      "utf8",
    );
    for (const expected of [
      "AlertDialog",
      "change.isPending",
      "state.isError",
      "invalidateQueries",
      "ErrorState",
      "TableSkeleton",
      "text-start",
      'role !== "super_admin"',
    ])
      assert.ok(source.includes(expected));
    assert.ok(!source.includes("localStorage"));
    for (const locale of ["en", "ar"]) {
      const strings = readFileSync(new URL(`../../i18n/${locale}.ts`, import.meta.url), "utf8");
      for (const key of ["enableWarning", "disableWarning", "disabledHint", "saved", "saving"])
        assert.ok(strings.includes(`"smsControl.${key}"`));
    }
  });
});
