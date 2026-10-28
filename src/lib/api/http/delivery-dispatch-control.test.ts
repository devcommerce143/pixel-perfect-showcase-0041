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
  mapDeliveryDispatchControl,
  deliveryDispatchChangeBody,
  deliveryDispatchControlKey,
  deliveryDispatchControlPath,
} from "../delivery-dispatch-control.ts";
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
    channel?: "email" | "whatsapp";
    locale?: "en" | "ar";
    pending?: boolean;
    error?: boolean;
    enabled?: boolean;
    saving?: boolean;
    mutationError?: boolean;
    mutationSuccess?: boolean;
    confirm?: boolean;
    role?: string;
  } = {},
) {
  const source = readFileSync(
    new URL("../../../components/app/DeliveryDispatchControl.tsx", import.meta.url),
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
      useMutation: () => ({
        isPending: options.saving ?? false,
        isError: options.mutationError ?? false,
        isSuccess: options.mutationSuccess ?? false,
      }),
    },
    "@/lib/api/queries": {
      queries: { deliveryDispatchControl: () => ({}) },
      deliveryDispatchMutations: {},
    },
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
  const Component = module.exports["DeliveryDispatchControl"] as React.ComponentType<{
    actor: typeof actor;
    channel: "email" | "whatsapp";
  }>;
  return renderToStaticMarkup(
    React.createElement(Component, {
      actor: { ...actor, role: options.role ?? actor.role } as typeof actor,
      channel: options.channel ?? "email",
    }),
  );
}
describe("durable Email/WhatsApp dispatch controls", () => {
  it("renders server state, held-work guidance, loading and safe errors", () => {
    assert.ok(
      renderControl().includes(
        en["deliveryControl.disabledHint"].replace("{channel}", en["deliveryControl.email"]),
      ),
    );
    assert.ok(
      renderControl({ enabled: true }).includes(
        en["deliveryControl.enabled"].replace("{channel}", en["deliveryControl.email"]),
      ),
    );
    assert.ok(renderControl({ pending: true }).includes('aria-busy="true"'));
    assert.ok(renderControl({ error: true }).includes('role="alert"'));
    assert.equal(renderControl({ role: "viewer" }), "");
    assert.ok(renderControl({ mutationError: true }).includes('role="alert"'));
    assert.ok(
      renderControl({ mutationSuccess: true }).includes(
        en["deliveryControl.saved"].replace("{channel}", en["deliveryControl.email"]),
      ),
    );
  });
  it("renders Arabic confirmation and disables submission while saving", () => {
    const html = renderControl({ locale: "ar", confirm: true, saving: true });
    assert.ok(
      html.includes(
        ar["deliveryControl.enableWarning"].replace("{channel}", ar["deliveryControl.email"]),
      ),
    );
    assert.ok(html.includes(ar["deliveryControl.saving"]));
    assert.ok(html.includes('disabled=""'));
    assert.ok(html.includes("text-start"));
    assert.ok(html.includes('dir="rtl"'));
    assert.ok(
      renderControl({ channel: "whatsapp" }).includes(
        en["deliveryControl.title"].replace("{channel}", en["deliveryControl.whatsapp"]),
      ),
    );
  });
  it("validates and allowlists backend data without false success", () => {
    assert.deepEqual(mapDeliveryDispatchControl({ ...state, token: "must-not-return" }), state);
    for (const invalid of [
      null,
      {},
      { ...state, enabled: "false" },
      { ...state, enabled: true, revision: 0 },
      { ...state, revision: -1 },
      { ...state, updatedAt: "invalid" },
    ])
      assert.throws(() => mapDeliveryDispatchControl(invalid));
  });
  it("requires platform identity, stable identity-scoped keys and enable confirmation", () => {
    assert.equal(deliveryDispatchControlPath(actor, "email"), "/platform/delivery-dispatch/email");
    assert.equal(
      deliveryDispatchControlPath(actor, "whatsapp"),
      "/platform/delivery-dispatch/whatsapp",
    );
    assert.throws(() => deliveryDispatchControlPath(actor, "sms" as "email"));
    assert.notDeepEqual(
      deliveryDispatchControlKey(actor, "email"),
      deliveryDispatchControlKey(actor, "whatsapp"),
    );
    assert.throws(() => deliveryDispatchControlPath({ ...actor, role: "viewer" }, "email"));
    assert.notDeepEqual(
      deliveryDispatchControlKey(actor, "email"),
      deliveryDispatchControlKey({ ...actor, userId: "other" }, "email"),
    );
    assert.throws(() => deliveryDispatchChangeBody(true, 0, false));
    assert.deepEqual(deliveryDispatchChangeBody(true, 0, true), {
      enabled: true,
      expectedRevision: 0,
      confirmEnable: true,
    });
    assert.deepEqual(deliveryDispatchChangeBody(false, 1, false), {
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
    assert.deepEqual(await api.getDeliveryDispatchControl(actor, "email"), state);
    assert.deepEqual(await api.updateDeliveryDispatchControl(actor, "email", true, 0, true), {
      enabled: true,
      revision: 1,
    });
    assert.ok(requests.every((r) => r.path.endsWith("/api/v1/platform/delivery-dispatch/email")));
    assert.equal(requests[1]?.method, "PUT");
    assert.deepEqual(requests[1]?.body, {
      enabled: true,
      expectedRevision: 0,
      confirmEnable: true,
    });
  });
  it("keeps WhatsApp requests separate and propagates revision conflicts", async () => {
    const paths: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.invalid/api/v1",
      getAccessToken: () => "synthetic-test-token",
      fetchImpl: async (input, init) => {
        paths.push(String(input));
        return new Response(JSON.stringify(init?.method === "PUT" ? {} : state), {
          status: init?.method === "PUT" ? 409 : 200,
        });
      },
    });
    assert.deepEqual(await api.getDeliveryDispatchControl(actor, "whatsapp"), state);
    await assert.rejects(api.updateDeliveryDispatchControl(actor, "whatsapp", true, 0, true));
    assert.ok(paths.every((path) => path.endsWith("/platform/delivery-dispatch/whatsapp")));
  });
  it("keeps live failures as errors and never substitutes mock state", async () => {
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.invalid/api/v1",
      getAccessToken: () => "synthetic",
      fetchImpl: async () => new Response("{}", { status: 503 }),
    });
    await assert.rejects(api.getDeliveryDispatchControl(actor, "email"));
    await assert.rejects(api.updateDeliveryDispatchControl(actor, "email", false, 0, false));
  });
  it("UI source preserves confirmation, pending/error states and server refresh", () => {
    const source = readFileSync(
      new URL("../../../components/app/DeliveryDispatchControl.tsx", import.meta.url),
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
        assert.ok(strings.includes(`"deliveryControl.${key}"`));
    }
  });
});
