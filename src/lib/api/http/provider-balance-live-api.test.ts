import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { mapProviderBalance, mapProviderHealth } from "./provider-monitoring-mapper.ts";
import { providerBalanceIsStale } from "../provider-monitoring.ts";
import { en } from "../../i18n/en.ts";
import { ar } from "../../i18n/ar.ts";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatDateTime } from "../../format.ts";
import type { ProviderBalanceObservation } from "../provider-monitoring.ts";

const id = "11111111-1111-4111-8111-111111111111";
const actor = { userId: id, role: "super_admin", tenantId: null, name: "Platform" } as const;
const observed = {
  status: "SUCCESS",
  amount: "0.000",
  unit: "credits",
  lastAttemptAt: "2026-10-25T00:00:00.000Z",
  lastSuccessAt: "2026-10-25T00:00:00.000Z",
  failureClass: null,
  staleAfterMs: 300_000,
};
const row = {
  providerAccountId: id,
  code: "sms",
  transport: "TAQNYAT_SMS",
  channel: "SMS",
  accountStatus: "ACTIVE",
  state: "UNKNOWN",
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,
  lastCheckedAt: null,
  lastTransitionAt: null,
  lastHttpStatus: null,
  lastLatencyMs: null,
  lastFailureClass: null,
};

describe("live balance observations", () => {
  it("rejects final line terminators without altering valid exact strings", () => {
    const maximum = "12345678901234567890.12345678";
    for (const ending of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
      for (const patch of [
        { amount: `1${ending}` },
        { unit: `SAR${ending}` },
        { amount: `${maximum}${ending}` },
      ]) {
        assert.throws(() => mapProviderBalance({ ...observed, ...patch }, "TAQNYAT_SMS"));
      }
    }
    for (const amount of ["0", "0.000", "12.3400", maximum]) {
      assert.equal(mapProviderBalance({ ...observed, amount }, "TAQNYAT_SMS").amount, amount);
    }
  });
  it("renders the real panel's zero, missing, unsupported, stale and failed states in EN/AR", () => {
    const source = readFileSync(
      new URL("../../../components/app/ProviderBalanceObservation.tsx", import.meta.url),
      "utf8",
    );
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const require = createRequire(import.meta.url);
    for (const locale of ["en", "ar"] as const) {
      const dictionary = locale === "en" ? en : ar;
      const exports: {
        ProviderBalanceObservation?: React.ComponentType<{
          observation: ProviderBalanceObservation | null;
          readFailed: boolean;
        }>;
      } = {};
      const load = (name: string) => {
        if (name === "@/lib/i18n/i18n")
          return { useI18n: () => ({ locale, t: (key: keyof typeof en) => dictionary[key] }) };
        if (name === "@/lib/format") return { formatDateTime };
        if (name === "@/lib/api/provider-monitoring") return { providerBalanceIsStale };
        return require(name);
      };
      new Function("require", "exports", compiled)(load, exports);
      const render = (observation: ProviderBalanceObservation | null, readFailed = false) =>
        renderToStaticMarkup(
          React.createElement(exports.ProviderBalanceObservation!, { observation, readFailed }),
        );
      const value = mapProviderBalance(observed, "TAQNYAT_SMS");
      const now = new Date().toISOString();
      const zero = render({ ...value, lastSuccessAt: now, lastAttemptAt: now });
      assert.ok(zero.includes('<bdi dir="ltr">0.000 credits</bdi>'));
      assert.ok(zero.includes(dictionary["providerBalance.lastSuccess"]));
      assert.ok(!zero.includes(dictionary["providerBalance.stale"]));
      const empty = render(null);
      assert.ok(empty.includes(dictionary["providerBalance.status.NOT_RETRIEVED"]));
      assert.ok(!empty.includes("<bdi"));
      const unsupported = render({
        ...value,
        status: "UNSUPPORTED",
        amount: null,
        unit: null,
        lastSuccessAt: null,
        lastAttemptAt: null,
      });
      assert.ok(unsupported.includes(dictionary["providerBalance.status.UNSUPPORTED"]));
      const stale = render({ ...value, lastSuccessAt: "2000-01-01T00:00:00.000Z" });
      assert.ok(stale.includes(dictionary["providerBalance.stale"]));
      const failed = render({ ...value, status: "FAILED", failureClass: "TIMEOUT" }, true);
      assert.ok(failed.includes(dictionary["providerBalance.previous"]));
      assert.ok(failed.includes(dictionary["providerBalance.readFailed"]));
      assert.ok(failed.includes("0.000 credits"));
    }
  });
  it("preserves exact zero and provider unit while redacting arbitrary fields", () => {
    const result = mapProviderBalance(
      { ...observed, token: "private", raw: "private" },
      "TAQNYAT_SMS",
    );
    assert.deepEqual(result, observed);
    assert.equal(
      mapProviderHealth({ ...row, balanceObservation: observed }).balanceObservation?.amount,
      "0.000",
    );
    assert.equal(mapProviderHealth(row).balanceObservation, null);
    assert.equal(mapProviderHealth({ ...row, balanceObservation: null }).balanceObservation, null);
  });
  it("separates unavailable, unsupported and failed refresh with previous success", () => {
    const empty = {
      amount: null,
      unit: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      failureClass: null,
      staleAfterMs: 300_000,
    };
    assert.equal(
      mapProviderBalance({ ...empty, status: "NOT_RETRIEVED" }, "TAQNYAT_SMS").amount,
      null,
    );
    assert.equal(
      mapProviderBalance({ ...empty, status: "UNSUPPORTED" }, "TURBO_SMTP").status,
      "UNSUPPORTED",
    );
    const failed = {
      ...observed,
      status: "FAILED",
      failureClass: "TIMEOUT",
      lastAttemptAt: "2026-10-25T00:01:00.000Z",
    };
    assert.equal(mapProviderBalance(failed, "TAQNYAT_SMS").lastSuccessAt, observed.lastSuccessAt);
    assert.equal(
      mapProviderBalance(
        { ...empty, ...failed, amount: null, unit: null, lastSuccessAt: null },
        "TAQNYAT_SMS",
      ).amount,
      null,
    );
  });
  it("rejects malformed or internally inconsistent balance contracts", () => {
    for (const patch of [
      { amount: 0 },
      { amount: "NaN" },
      { amount: "1e3" },
      { unit: "" },
      { unit: "<SAR>" },
      { lastSuccessAt: null },
      { failureClass: "TIMEOUT" },
      { status: "HEALTHY" },
      { staleAfterMs: 0 },
      { lastSuccessAt: "2026-10-26T00:00:00.000Z" },
    ]) {
      assert.throws(() => mapProviderBalance({ ...observed, ...patch }, "TAQNYAT_SMS"));
    }
    assert.throws(() => mapProviderBalance(observed, "META_GRAPH"));
    assert.throws(() =>
      mapProviderBalance({ ...observed, status: "FAILED", failureClass: "private" }, "TAQNYAT_SMS"),
    );
  });
  it("bases stale warnings on successful retrieval, independent of the latest attempt or portal read", () => {
    const value = mapProviderBalance(observed, "TAQNYAT_SMS"),
      start = Date.parse(observed.lastSuccessAt);
    assert.equal(providerBalanceIsStale(value, start + 299_999), false);
    assert.equal(providerBalanceIsStale(value, start + 300_000), true);
    assert.equal(providerBalanceIsStale(value, start - 1), true);
    assert.equal(
      providerBalanceIsStale(
        { ...value, status: "FAILED", lastAttemptAt: "2026-10-25T01:00:00.000Z" },
        start + 3_600_000,
      ),
      true,
    );
  });
  it("uses the existing authenticated stored read without mock fallback or extra refresh requests", async () => {
    const calls: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "synthetic",
      fetchImpl: async (url, init) => {
        calls.push(String(url));
        assert.equal(init?.method, "GET");
        assert.equal(
          (init?.headers as Record<string, string>)["Authorization"],
          "Bearer synthetic",
        );
        return new Response(JSON.stringify({ ...row, balanceObservation: observed }));
      },
    });
    assert.equal(
      (await api.getProviderObservedHealth(actor, id)).balanceObservation?.amount,
      "0.000",
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0]!, new RegExp(`/provider-accounts/${id}/health$`));
    for (const status of [401, 403, 500]) {
      const failed = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "synthetic",
        fetchImpl: async () => new Response("{}", { status }),
      });
      await assert.rejects(failed.getProviderObservedHealth(actor, id));
    }
  });
  it("provides EN/AR labels and keeps the live panel independent of mock billing", () => {
    for (const key of Object.keys(en).filter((key) => key.startsWith("providerBalance."))) {
      assert.ok(en[key as keyof typeof en]);
      assert.match(ar[key as keyof typeof ar], /[\u0600-\u06ff]/);
    }
    const source = readFileSync(
      new URL("../../../components/app/ProviderBalanceObservation.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /providerBalanceIsStale/);
    assert.match(source, /bdi dir="ltr"/);
    assert.doesNotMatch(source, /mock|billing|Intl.NumberFormat|fetch\(/i);
  });
});
