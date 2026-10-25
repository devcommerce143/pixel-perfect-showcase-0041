import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiError, LiveApiNotConnectedError } from "./http/errors.ts";
import { userErrorKey, supportReference, sendingRestriction } from "./user-message.ts";
import type { ResolvedTenantEntitlements, EntitlementBlocker } from "./types.ts";
import { en } from "../i18n/en.ts";
import { ar } from "../i18n/ar.ts";

const reference = "11111111-1111-4111-8111-111111111111";
const policy: ResolvedTenantEntitlements = {
  tenantId: reference,
  tenantStatus: "active",
  subscriptionId: null,
  planId: null,
  configured: false,
  operational: false,
  blockers: [],
  quotaPolicy: null,
  quotaPolicySource: null,
  tpsLimit: null,
  tpsSource: null,
  features: [],
  channels: [],
};

describe("safe user messages", () => {
  it("maps errors by stable type/status without showing exception text", () => {
    for (const [statusCode, key] of [
      [401, "notice.session"],
      [403, "notice.permission"],
      [404, "notice.missing"],
      [409, "notice.conflict"],
      [422, "notice.validation"],
      [429, "notice.limit"],
      [504, "notice.timeout"],
      [500, "common.errorBody"],
    ] as const) {
      const error = new ApiError({
        statusCode,
        message: "SELECT private-token stack trace",
        correlationId: reference,
      });
      assert.equal(userErrorKey(error), key);
      assert.equal(supportReference(error), reference);
      assert.doesNotMatch(en[userErrorKey(error)], /SELECT|stack trace|private-token/);
    }
    assert.equal(userErrorKey(new TypeError("fetch private-token")), "notice.connection");
    assert.equal(
      userErrorKey(new LiveApiNotConnectedError("internal operation")),
      "notice.unavailable",
    );
    assert.equal(userErrorKey(new Error("private-token")), "common.errorBody");
    assert.equal(
      supportReference(
        new ApiError({ statusCode: 500, message: "private", correlationId: "secret-token" }),
      ),
      null,
    );
  });
  it("distinguishes actual subscription blockers and never invents an expired subscription", () => {
    const cases: [EntitlementBlocker, string][] = [
      ["TENANT_SUSPENDED", "notice.tenantSuspended"],
      ["TENANT_INACTIVE", "notice.tenantInactive"],
      ["SUBSCRIPTION_MISSING", "notice.subscriptionMissing"],
      ["SUBSCRIPTION_PENDING", "notice.subscriptionPending"],
      ["SUBSCRIPTION_CANCELLED", "notice.subscriptionCancelled"],
      ["SUBSCRIPTION_NOT_STARTED", "notice.subscriptionFuture"],
      ["SUBSCRIPTION_ENDED", "notice.subscriptionEnded"],
    ];
    for (const [blocker, key] of cases)
      assert.equal(sendingRestriction({ ...policy, blockers: [blocker] }, "sms", false), key);
    assert.equal(sendingRestriction(policy, "sms", false), "humanSend.notOperational");
    assert.equal(
      sendingRestriction({ ...policy, operational: true }, "sms", false),
      "notice.channelUnavailable",
    );
    assert.equal(
      sendingRestriction({ ...policy, operational: true }, "sms", true),
      "notice.bulkUnavailable",
    );
    const allowed = {
      ...policy,
      operational: true,
      features: ["bulk_messaging" as const],
      channels: [
        {
          channel: "sms" as const,
          enabled: true,
          monthlyQuota: 100,
          tpsLimit: 10,
          quotaSource: "plan" as const,
          ignoredOverride: false,
          tpsSource: "plan" as const,
        },
      ],
    };
    assert.equal(sendingRestriction(allowed, "sms", true), null);
  });
  it("renders real shared alerts and safe read errors in English and Arabic", () => {
    const root = path.resolve("src"),
      require = createRequire(import.meta.url);
    for (const locale of ["en", "ar"] as const) {
      const dictionary = locale === "en" ? en : ar,
        cache = new Map<string, Record<string, unknown>>();
      const load = (name: string, from = root): Record<string, unknown> => {
        if (name === "@/lib/i18n/i18n")
          return { useI18n: () => ({ locale, t: (key: keyof typeof en) => dictionary[key] }) };
        if (name === "@/lib/api/user-message") return { userErrorKey, supportReference };
        if (!name.startsWith(".") && !name.startsWith("@/")) return require(name);
        const base = name.startsWith("@/")
          ? path.join(root, name.slice(2))
          : path.resolve(from, name);
        const filename = [base, base + ".tsx", base + ".ts"].find((p) => existsSync(p));
        assert.ok(filename);
        if (cache.has(filename)) return cache.get(filename)!;
        const exports: Record<string, unknown> = {};
        cache.set(filename, exports);
        const code = ts.transpileModule(readFileSync(filename, "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText;
        new Function("require", "exports", code)(
          (n: string) => load(n, path.dirname(filename)),
          exports,
        );
        return exports;
      };
      const { MessageAlert } = load("@/components/app/MessageAlert") as {
        MessageAlert: React.ComponentType<{ variant: string; children?: React.ReactNode }>;
      };
      for (const variant of ["error", "warning", "info", "success"] as const) {
        const html = renderToStaticMarkup(
          React.createElement(MessageAlert, { variant }, "Helpful next step"),
        );
        assert.ok(html.includes(dictionary[`notice.title.${variant}`]));
        assert.ok(html.includes(`role="${variant === "error" ? "alert" : "status"}"`));
        assert.ok(html.includes("text-start"));
      }
      const { ErrorState } = load("@/components/app/States") as {
        ErrorState: React.ComponentType<{ error: unknown; onRetry: () => void }>;
      };
      const html = renderToStaticMarkup(
        React.createElement(ErrorState, {
          error: new ApiError({
            statusCode: 403,
            message: "SELECT private-token",
            correlationId: reference,
          }),
          onRetry: () => undefined,
        }),
      );
      assert.ok(
        html.includes(
          renderToStaticMarkup(
            React.createElement(React.Fragment, null, dictionary["notice.permission"]),
          ),
        ),
      );
      assert.ok(html.includes(reference));
      assert.doesNotMatch(html, /SELECT|private-token/);
      assert.ok(html.includes(dictionary["common.retry"]));
    }
    const alertSource = readFileSync(
      new URL("../../components/ui/alert.tsx", import.meta.url),
      "utf8",
    );
    assert.match(alertSource, /start-4/);
    assert.match(alertSource, /ps-7/);
    assert.doesNotMatch(alertSource, /left-4|pl-7/);
  });
});
