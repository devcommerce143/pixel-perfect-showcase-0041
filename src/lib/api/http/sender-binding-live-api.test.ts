import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  senderBindingsPath,
  senderBindingMutationRequest,
  mapSenderBinding,
  mapSenderBindingPage,
} from "./sender-binding-mapper.ts";
import { senderBindingKey, bindingSenderReady } from "../sender-bindings.ts";
import type { SenderBindingOperation } from "../sender-bindings.ts";
import type { SenderIdentityRead } from "../types.ts";
const tenant = "11111111-1111-4111-8111-111111111111",
  account = "22222222-2222-4222-8222-222222222222",
  sender = "33333333-3333-4333-8333-333333333333",
  id = "44444444-4444-4444-8444-444444444444",
  other = "55555555-5555-4555-8555-555555555555";
const actor = { userId: other, role: "super_admin", tenantId: null, name: "Platform" } as const;
const row = {
  id,
  tenantId: tenant,
  providerAccountId: account,
  senderIdentityId: sender,
  providerSenderName: "Exact Case",
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};
const query = { tenantId: tenant, providerAccountId: account, limit: 20 };
describe("platform sender-provider binding contracts", () => {
  it("requires explicit named tenant/cursor scope and rejects non-platform request construction", () => {
    assert.equal(
      senderBindingsPath(actor, { ...query, senderIdentityId: sender, cursor: id }),
      `/sender-provider-bindings?tenantId=${tenant}&limit=20&providerAccountId=${account}&senderIdentityId=${sender}&cursor=${id}`,
    );
    assert.throws(() =>
      senderBindingsPath({ ...actor, role: "client_admin", tenantId: tenant }, query),
    );
    for (const bad of [
      { ...query, tenantId: "bad" },
      { ...query, limit: 0 },
      { ...query, limit: 101 },
      { ...query, cursor: "bad" },
    ])
      assert.throws(() => senderBindingsPath(actor, bad));
  });
  it("allowlists binding metadata and rejects cross-tenant/account/sender results", () => {
    assert.deepEqual(
      mapSenderBinding(
        { ...row, token: "private", recipient: "private", messageBody: "private" },
        tenant,
        account,
        id,
      ),
      row,
    );
    assert.throws(() => mapSenderBinding(row, other, account));
    assert.throws(() => mapSenderBinding(row, tenant, other));
    assert.throws(() => mapSenderBinding(row, tenant, account, other));
    assert.throws(() =>
      mapSenderBindingPage(
        { items: [row], nextCursor: null },
        { ...query, senderIdentityId: other },
      ),
    );
  });
  it("honors cursor pagination without fabricated totals or partial pages", () => {
    assert.deepEqual(mapSenderBindingPage({ items: [row], nextCursor: null }, query), {
      items: [row],
      nextCursor: null,
    });
    assert.throws(() => mapSenderBindingPage({ items: [row], nextCursor: id }, query));
    assert.throws(() => mapSenderBindingPage({ items: [row, row], nextCursor: null }, query));
    assert.deepEqual(
      mapSenderBindingPage({ items: [row], nextCursor: id }, { ...query, limit: 1 }),
      { items: [row], nextCursor: id },
    );
  });
  it("preserves SMS spelling and omits caller-controlled email/WhatsApp From overrides", () => {
    assert.deepEqual(
      senderBindingMutationRequest(actor, {
        kind: "create",
        channel: "SMS",
        tenantId: tenant,
        providerAccountId: account,
        senderIdentityId: sender,
        providerSenderName: "Exact Case",
      }),
      {
        path: "/sender-provider-bindings",
        body: {
          tenantId: tenant,
          providerAccountId: account,
          senderIdentityId: sender,
          providerSenderName: "Exact Case",
        },
      },
    );
    for (const channel of ["EMAIL", "WHATSAPP"] as const) {
      const request = senderBindingMutationRequest(actor, {
        kind: "create",
        channel,
        tenantId: tenant,
        providerAccountId: account,
        senderIdentityId: sender,
      });
      assert.equal(request.path, `/sender-provider-bindings/${channel.toLowerCase()}`);
      assert.equal("providerSenderName" in request.body, false);
    }
    assert.throws(() =>
      senderBindingMutationRequest(actor, {
        kind: "create",
        channel: "SMS",
        tenantId: tenant,
        providerAccountId: account,
        senderIdentityId: sender,
        providerSenderName: " trailing ",
      }),
    );
  });
  it("keeps backend readiness rules instead of manufacturing verification", () => {
    const base = {
      id: sender,
      tenantId: tenant,
      displayName: null,
      verificationStatus: "verified",
      operationalStatus: "active",
      providerReference: null,
      rejectionReason: null,
      suspensionReason: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as const;
    const email: SenderIdentityRead = {
      ...base,
      channel: "email",
      email: {
        emailAddress: "sender@example.com",
        domain: "example.com",
        domainVerificationStatus: "verified",
        spfStatus: "verified",
        dkimStatus: "verified",
      },
    };
    const whatsapp: SenderIdentityRead = {
      ...base,
      channel: "whatsapp",
      whatsapp: {
        businessDisplayName: "Business",
        phoneNumber: "+966500000000",
        countryCode: "SA",
        phoneNumberId: "12345",
        wabaId: "67890",
      },
    };
    assert.equal(bindingSenderReady(email, "EMAIL"), true);
    assert.equal(
      bindingSenderReady(
        { ...email, email: { ...email.email, dkimStatus: "not_configured" } },
        "EMAIL",
      ),
      false,
    );
    assert.equal(bindingSenderReady({ ...email, operationalStatus: "inactive" }, "EMAIL"), false);
    assert.equal(bindingSenderReady(whatsapp, "WHATSAPP"), true);
    assert.equal(
      bindingSenderReady(
        { ...whatsapp, whatsapp: { ...whatsapp.whatsapp, wabaId: "12345" } },
        "WHATSAPP",
      ),
      false,
    );
    assert.equal(
      bindingSenderReady(
        {
          ...base,
          channel: "sms",
          verificationStatus: "draft",
          operationalStatus: "inactive",
          sms: { senderId: "DOLF", countryCode: "SA" },
        },
        "SMS",
      ),
      true,
    );
  });
  it("uses human GETs/POSTs for exact list/detail/create/remove contracts with no provider request", async () => {
    let response: unknown = { items: [row], nextCursor: null };
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        seen.push({ url: String(url), init });
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer token");
        return new Response(JSON.stringify(response));
      },
    });
    await api.listSenderBindings(actor, query);
    response = row;
    await api.getSenderBinding(actor, id, tenant, account);
    const operations: SenderBindingOperation[] = [
      {
        kind: "create",
        channel: "SMS",
        tenantId: tenant,
        providerAccountId: account,
        senderIdentityId: sender,
        providerSenderName: row.providerSenderName,
      },
      {
        kind: "create",
        channel: "EMAIL",
        tenantId: tenant,
        providerAccountId: account,
        senderIdentityId: sender,
      },
      {
        kind: "create",
        channel: "WHATSAPP",
        tenantId: tenant,
        providerAccountId: account,
        senderIdentityId: sender,
      },
      { kind: "remove", id, tenantId: tenant, providerAccountId: account },
    ];
    for (const operation of operations) {
      response =
        operation.kind === "remove"
          ? { id }
          : {
              ...row,
              providerSenderName:
                operation.channel === "EMAIL"
                  ? "sender@example.com"
                  : operation.channel === "WHATSAPP"
                    ? "123456789012345"
                    : row.providerSenderName,
            };
      const expected = senderBindingMutationRequest(actor, operation);
      const result = await api.applySenderBindingMutation(actor, operation);
      const request = seen.at(-1)!;
      assert.equal(request.url, `https://api.example.com/v1${expected.path}`);
      assert.equal(request.init?.method, "POST");
      assert.equal(request.init?.body, JSON.stringify(expected.body));
      assert.equal(result.kind, operation.kind === "remove" ? "removed" : "created");
    }
    assert.equal(seen.length, 6);
    assert.equal(seen[0]?.init?.method, "GET");
    assert.equal(seen[1]?.url, `https://api.example.com/v1/sender-provider-bindings/${id}`);
  });
  it("surfaces 404, conflicts and unauthorized reads without mock fallback or fake deletion", async () => {
    for (const status of [403, 404, 409, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.com/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response('{"message":"unavailable"}', { status }),
      });
      await assert.rejects(api.listSenderBindings(actor, query), ApiError);
      await assert.rejects(
        api.applySenderBindingMutation(actor, {
          kind: "remove",
          id,
          tenantId: tenant,
          providerAccountId: account,
        }),
        ApiError,
      );
    }
  });
  it("isolates identity, selected tenant and account with guarded late mutation completions", () => {
    const key = senderBindingKey(actor, tenant, account);
    for (const next of [
      senderBindingKey({ ...actor, userId: id }, tenant, account),
      senderBindingKey(actor, other, account),
      senderBindingKey(actor, tenant, other),
    ])
      assert.notDeepEqual(key, next);
    const source = readFileSync(
      new URL("../../../components/app/ProviderBindings.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /actor.userId.*actor.role.*tenantId.*account.id/);
    assert.match(source, /if \(!active.current\) return/);
    assert.match(source, /retry: false/);
    assert.doesNotMatch(source, /api\.|markVerified|testProviderConnection/);
  });
});
