import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  providerAccountMutationRequest,
  mapProviderAccountMutation,
} from "./provider-account-mutation-mapper.ts";
import type { ProviderAccountMutation } from "../provider-account-mutations.ts";
import { roleHas } from "../../auth/permissions.ts";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const actor = { userId: other, role: "super_admin", tenantId: null, name: "Platform" } as const;
const operations: Array<{ operation: ProviderAccountMutation; path: string; body: unknown }> = [
  {
    operation: {
      kind: "create",
      channel: "EMAIL",
      transport: "TAQNYAT_EMAIL",
      code: "taqnyat-email",
      token: "taqnyat-token",
    },
    path: "/provider-accounts/taqnyat/email",
    body: { code: "taqnyat-email", token: "taqnyat-token" },
  },
  {
    operation: {
      kind: "create",
      channel: "WHATSAPP",
      transport: "TAQNYAT_WHATSAPP",
      code: "taqnyat-wa",
      token: "taqnyat-token",
    },
    path: "/provider-accounts/taqnyat/whatsapp",
    body: { code: "taqnyat-wa", token: "taqnyat-token" },
  },
  {
    operation: {
      kind: "replace",
      channel: "EMAIL",
      transport: "TAQNYAT_EMAIL",
      id,
      token: "taqnyat-next",
    },
    path: `/provider-accounts/${id}/taqnyat-token`,
    body: { token: "taqnyat-next" },
  },
  {
    operation: {
      kind: "replace",
      channel: "WHATSAPP",
      transport: "TAQNYAT_WHATSAPP",
      id,
      token: "taqnyat-next",
    },
    path: `/provider-accounts/${id}/taqnyat-token`,
    body: { token: "taqnyat-next" },
  },
  {
    operation: {
      kind: "callbackConfigure",
      id,
      appSecret: "callback-app-secret",
      verifyToken: "callback-verify-token",
    },
    path: `/provider-accounts/${id}/meta-callback-secrets`,
    body: { appSecret: "callback-app-secret", verifyToken: "callback-verify-token" },
  },
  {
    operation: { kind: "callbackAppSecret", id, appSecret: "callback-app-secret" },
    path: `/provider-accounts/${id}/meta-callback-app-secret`,
    body: { appSecret: "callback-app-secret" },
  },
  {
    operation: { kind: "callbackVerifyToken", id, verifyToken: "callback-verify-token" },
    path: `/provider-accounts/${id}/meta-callback-verify-token`,
    body: { verifyToken: "callback-verify-token" },
  },
  {
    operation: { kind: "create", channel: "SMS", code: "sms-account", token: "sms-token" },
    path: "/provider-accounts",
    body: { code: "sms-account", token: "sms-token" },
  },
  {
    operation: {
      kind: "create",
      channel: "EMAIL",
      code: "email-account",
      username: "smtp-user",
      secret: "smtp-secret",
    },
    path: "/provider-accounts/email",
    body: { code: "email-account", username: "smtp-user", secret: "smtp-secret" },
  },
  {
    operation: {
      kind: "create",
      channel: "WHATSAPP",
      code: "meta-account",
      token: "meta-system-user-token",
    },
    path: "/provider-accounts/whatsapp",
    body: { code: "meta-account", token: "meta-system-user-token" },
  },
  {
    operation: { kind: "replace", channel: "SMS", id, token: "sms-next" },
    path: `/provider-accounts/${id}/token`,
    body: { token: "sms-next" },
  },
  {
    operation: {
      kind: "replace",
      channel: "EMAIL",
      id,
      username: "smtp-user",
      secret: "next-secret",
    },
    path: `/provider-accounts/${id}/email-credentials`,
    body: { username: "smtp-user", secret: "next-secret" },
  },
  {
    operation: { kind: "replace", channel: "WHATSAPP", id, token: "next-meta-system-token" },
    path: `/provider-accounts/${id}/whatsapp-token`,
    body: { token: "next-meta-system-token" },
  },
  {
    operation: { kind: "reencrypt", id, keyVersion: 2 },
    path: `/provider-accounts/${id}/reencrypt`,
    body: { keyVersion: 2 },
  },
];
describe("provider account configuration without external verification", () => {
  it("rejects channel/transport mismatches and invalid Taqnyat tokens", () => {
    const base = {
      kind: "create",
      channel: "EMAIL",
      transport: "TAQNYAT_EMAIL",
      code: "taqnyat-email",
      token: "taqnyat-token",
    } as const;
    for (const patch of [
      { transport: "META_GRAPH" },
      { channel: "SMS" },
      { token: "token\r\nheader" },
      { token: "" },
    ])
      assert.throws(() =>
        providerAccountMutationRequest(actor, { ...base, ...patch } as ProviderAccountMutation),
      );
  });
  it("uses exact separate channel/credential contracts and preserves opaque secret bytes", () => {
    for (const { operation, path, body } of operations)
      assert.deepEqual(providerAccountMutationRequest(actor, operation), { path, body });
    assert.equal(
      (
        providerAccountMutationRequest(actor, {
          kind: "create",
          channel: "SMS",
          code: "sms-account",
          token: " opaque token ",
        }).body as { token: string }
      ).token,
      " opaque token ",
    );
  });
  it("restricts presentation to existing platform-management permission and rejects tenant request construction", () => {
    assert.equal(roleHas("super_admin", "platform.providers.manage"), true);
    for (const role of ["client_admin", "operator", "viewer"] as const) {
      assert.equal(roleHas(role, "platform.providers.manage"), false);
      assert.throws(() =>
        providerAccountMutationRequest({ ...actor, role, tenantId: id }, operations[0]!.operation),
      );
    }
  });
  it("validates real code, secret and key-version shapes before network access", () => {
    const bad: ProviderAccountMutation[] = [
      { kind: "create", channel: "SMS", code: "UPPER", token: "token" },
      { kind: "create", channel: "SMS", code: "sms-account", token: "line\nbreak" },
      {
        kind: "create",
        channel: "EMAIL",
        code: "email-account",
        username: "has space",
        secret: "secret",
      },
      { kind: "replace", channel: "EMAIL", id, username: "user", secret: "has space" },
      { kind: "replace", channel: "WHATSAPP", id, token: "short" },
      { kind: "replace", channel: "WHATSAPP", id, token: '{"username":"user"}' },
      { kind: "reencrypt", id, keyVersion: 0 },
      { kind: "reencrypt", id, keyVersion: 10000 },
      { kind: "reencrypt", id, keyVersion: 1.5 },
    ];
    for (const operation of bad)
      assert.throws(() => providerAccountMutationRequest(actor, operation));
  });
  it("returns only actual account references and key versions, never credential input or arbitrary response fields", () => {
    for (const { operation } of operations) {
      const result = mapProviderAccountMutation(
        {
          id,
          keyVersion: 2,
          token: "private",
          secret: "private",
          username: "private",
          ciphertext: "private",
          success: true,
        },
        operation,
      );
      assert.deepEqual(
        result,
        operation.kind !== "create" && operation.kind !== "reencrypt"
          ? { id }
          : { id, keyVersion: 2 },
      );
    }
    assert.throws(() =>
      mapProviderAccountMutation(
        { id: other, keyVersion: 2 },
        { kind: "reencrypt", id, keyVersion: 2 },
      ),
    );
    assert.throws(() =>
      mapProviderAccountMutation({ id, keyVersion: 1 }, { kind: "reencrypt", id, keyVersion: 2 }),
    );
  });
  it("sends human POSTs to configuration endpoints with no extra probe or provider call", async () => {
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        seen.push({ url: String(url), init });
        return new Response(JSON.stringify({ id, keyVersion: 2 }));
      },
    });
    for (const { operation, path, body } of operations) {
      await api.applyProviderAccountMutation(actor, operation);
      const last = seen.at(-1)!;
      assert.equal(last.url, `https://api.example.com/v1${path}`);
      assert.equal(last.init?.method, "POST");
      assert.equal(last.init?.body, JSON.stringify(body));
      assert.equal((last.init?.headers as Record<string, string>)["Authorization"], "Bearer token");
    }
    assert.equal(seen.length, operations.length);
  });
  it("reports API failures without retry, fabricated verification or mock fallback", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => {
        calls++;
        return new Response('{"message":"conflict"}', { status: 409 });
      },
    });
    await assert.rejects(
      api.applyProviderAccountMutation(actor, operations[0]!.operation),
      ApiError,
    );
    assert.equal(calls, 1);
  });
  it("passes only operation names into mutations and clears input secrets on completion or close", () => {
    const ui = readFileSync(
      new URL("../../../components/app/ProviderAccountActions.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /mutationFn: async \(action: ProviderAccountMutation\["kind"\]\)/);
    assert.match(ui, /mutation.mutate\(kind\)/);
    assert.match(ui, /finally \{\s*if \(active.current\) clearSecrets\(\)/);
    assert.match(ui, /retry: false/);
    assert.match(ui, /gcTime: 0/);
    assert.doesNotMatch(
      ui,
      /localStorage|sessionStorage|setQueryData|testProviderConnection|api\./,
    );
    const page = readFileSync(
      new URL("../../../components/app/ProviderMonitoring.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /configurable=\{view === "accounts"\}/);
    assert.match(page, /configurable && detail.data/);
  });
  it("validates callback secret distinction and closed character/length rules without sharing the sending token", () => {
    const invalid: ProviderAccountMutation[] = [
      {
        kind: "callbackConfigure",
        id,
        appSecret: "same-credential-value",
        verifyToken: "same-credential-value",
      },
      { kind: "callbackAppSecret", id, appSecret: "short" },
      { kind: "callbackVerifyToken", id, verifyToken: "token contains spaces" },
    ];
    for (const operation of invalid)
      assert.throws(() => providerAccountMutationRequest(actor, operation));
    const ui = readFileSync(
      new URL("../../../components/app/ProviderAccountActions.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /account.transport === "META_GRAPH"/);
    assert.match(ui, /setAppSecretInput\(""\)/);
    assert.match(ui, /setVerifyTokenInput\(""\)/);
  });
});
