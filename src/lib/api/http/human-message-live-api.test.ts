import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  humanMessageBody,
  humanMessageIdempotencyKey,
  humanMessageKey,
  humanMessagePath,
  humanMessageScope,
  humanMessageSenderEligible,
  mapHumanMessageAcceptance,
} from "../human-message.ts";
import type { HumanMessageInput } from "../human-message.ts";
import type { Application, SenderIdentityRead } from "../types.ts";
import { roleHas } from "../../auth/permissions.ts";

const tenant = "11111111-1111-4111-8111-111111111111",
  app = "22222222-2222-4222-8222-222222222222",
  sender = "33333333-3333-4333-8333-333333333333",
  actorId = "44444444-4444-4444-8444-444444444444";
const actor = { role: "operator", tenantId: tenant, userId: actorId, name: "Operator" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const input: HumanMessageInput = {
  channel: "sms",
  senderId: sender,
  recipient: "+15550000000",
  sms: { body: "Private fixture content" },
};
const key = "portal:fixture-stable-idempotency";
const result = {
  id: sender,
  channel: "SMS",
  status: "ACCEPTED",
  acceptedAt: "2026-10-21T00:00:00.000Z",
  queuedAt: null,
  replay: false,
};
describe("human message acceptance with no providers or persistence", () => {
  it("uses distinct human routes and requires explicit platform/tenant scope", () => {
    assert.equal(humanMessagePath(actor, app), `/applications/${app}/messages`);
    assert.equal(
      humanMessagePath(platform, app, tenant),
      `/tenants/${tenant}/applications/${app}/messages`,
    );
    assert.equal(humanMessageScope(actor), tenant);
    assert.throws(() => humanMessagePath(platform, app));
    assert.throws(() => humanMessagePath(actor, app, sender));
    assert.throws(() => humanMessagePath({ ...actor, userId: "" }, app));
    assert.throws(() => humanMessagePath({ ...actor, role: "viewer" }, app));
    assert.equal(roleHas("viewer", "messages.send"), false);
    assert.equal(roleHas("viewer", "platform.messages.submit"), false);
    assert.equal(roleHas("super_admin", "messages.send"), false);
  });
  it("projects only channel-specific fields without credential or actor impersonation", () => {
    assert.deepEqual(
      humanMessageBody({
        ...input,
        credentialId: actorId,
        submittedByUserId: sender,
      } as HumanMessageInput),
      {
        channel: "SMS",
        senderId: sender,
        recipient: "+15550000000",
        sms: { body: "Private fixture content" },
      },
    );
    assert.deepEqual(
      humanMessageBody({
        channel: "email",
        senderId: sender,
        recipient: "person@example.test",
        email: { subject: "Subject", body: "Body" },
      }),
      {
        channel: "EMAIL",
        senderId: sender,
        recipient: "person@example.test",
        email: { subject: "Subject", body: "Body" },
      },
    );
    assert.deepEqual(
      humanMessageBody({
        channel: "whatsapp",
        senderId: sender,
        recipient: "+15550000000",
        whatsapp: { templateKey: "fixture_template", language: "en" },
      }),
      {
        channel: "WHATSAPP",
        senderId: sender,
        recipient: "+15550000000",
        whatsapp: { templateKey: "fixture_template", language: "en" },
      },
    );
  });
  it("rejects invalid limits, recipients, keys and unsupported WhatsApp variables", () => {
    for (const invalid of [
      { ...input, senderId: "bad" },
      { ...input, recipient: "not-a-phone" },
      { ...input, sms: { body: "" } },
      { ...input, sms: { body: "x".repeat(1601) } },
      {
        channel: "email",
        senderId: sender,
        recipient: "invalid",
        email: { subject: "test", body: "body" },
      },
      {
        channel: "whatsapp",
        senderId: sender,
        recipient: "+15550000000",
        whatsapp: {
          templateKey: "valid",
          language: "en",
          variables: { name: "not silently dropped" },
        },
      },
    ])
      assert.throws(() => humanMessageBody(invalid as HumanMessageInput));
    for (const value of ["short", "invalid key with spaces", "x".repeat(129)])
      assert.throws(() => humanMessageIdempotencyKey(value));
    assert.equal(humanMessageIdempotencyKey(key), key);
  });
  it("uses actual tenant/application channel, scope, lifecycle and allow-list rules", () => {
    const application: Application = {
      id: app,
      tenantId: tenant,
      name: "App",
      environment: "sandbox",
      status: "active",
      channels: ["sms"],
      scopes: ["messages:send"],
      senderAccess: "all_eligible",
      createdAt: result.acceptedAt,
    };
    const identity: SenderIdentityRead = {
      id: sender,
      tenantId: tenant,
      channel: "sms",
      displayName: "Actual sender",
      verificationStatus: "verified",
      operationalStatus: "active",
      providerReference: null,
      rejectionReason: null,
      suspensionReason: null,
      createdAt: result.acceptedAt,
      updatedAt: result.acceptedAt,
      sms: { senderId: "Actual", countryCode: "SA" },
    };
    assert.equal(humanMessageSenderEligible(application, identity, "sms", tenant), true);
    for (const changed of [
      { ...application, tenantId: actorId },
      { ...application, scopes: [] },
      { ...application, channels: [] },
      { ...application, senderAccess: "allow_list", allowListSenderIds: [] },
    ])
      assert.equal(
        humanMessageSenderEligible(changed as Application, identity, "sms", tenant),
        false,
      );
    assert.equal(
      humanMessageSenderEligible(
        { ...application, senderAccess: "allow_list", allowListSenderIds: [sender] },
        identity,
        "sms",
        tenant,
      ),
      true,
    );
    assert.equal(
      humanMessageSenderEligible(
        application,
        { ...identity, operationalStatus: "suspended" },
        "sms",
        tenant,
      ),
      false,
    );
  });
  it("distinguishes new acceptance from real replay status and omits private fields", () => {
    assert.deepEqual(
      mapHumanMessageAcceptance(
        { ...result, recipient: "private", payloadHash: "private", credentialId: "private" },
        "sms",
      ),
      { ...result, channel: "sms", status: "accepted" },
    );
    for (const status of ["UNKNOWN", "SUBMITTED", "DELIVERED"])
      assert.equal(
        mapHumanMessageAcceptance({ ...result, replay: true, status }, "sms").status,
        status.toLowerCase(),
      );
    for (const invalid of [
      { status: "DELIVERED" },
      { channel: "EMAIL" },
      { id: "invalid" },
      { replay: "false" },
      { acceptedAt: "bad" },
      { status: "constructor" },
    ])
      assert.throws(() => mapHumanMessageAcceptance({ ...result, ...invalid }, "sms"));
  });
  it("sends only human Bearer POST with stable idempotency and no-store", async () => {
    const calls: Array<{ url: string; key: string | undefined; body: unknown }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers["Authorization"], "Bearer human");
        assert.equal(init?.method, "POST");
        assert.equal(init?.cache, "no-store");
        calls.push({
          url: String(url),
          key: headers["Idempotency-Key"],
          body: JSON.parse(String(init?.body)),
        });
        return new Response(JSON.stringify(result));
      },
    });
    await api.submitHumanMessage(actor, app, input, key);
    await api.submitHumanMessage(platform, app, input, key, tenant);
    assert.equal(calls[0]?.url, `https://api.example.test/api/v1/applications/${app}/messages`);
    assert.equal(
      calls[1]?.url,
      `https://api.example.test/api/v1/tenants/${tenant}/applications/${app}/messages`,
    );
    assert.equal(calls[0]?.key, calls[1]?.key);
    assert.deepEqual(calls[0]?.body, humanMessageBody(input));
  });
  it("preserves the same payload/key on explicit retry after an unconfirmed response", async () => {
    const calls: Array<{ body: unknown; key: string | undefined }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async (_url, init) => {
        calls.push({
          body: init?.body,
          key: (init?.headers as Record<string, string>)["Idempotency-Key"],
        });
        if (calls.length === 1) throw new TypeError("synthetic connection interruption");
        return new Response(JSON.stringify({ ...result, replay: true }));
      },
    });
    await assert.rejects(api.submitHumanMessage(actor, app, input, key));
    assert.equal((await api.submitHumanMessage(actor, app, input, key)).replay, true);
    assert.deepEqual(calls[0], calls[1]);
  });
  it("surfaces authentication, validation, conflict and server failures without mock success", async () => {
    for (const status of [401, 403, 404, 409, 422, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "human",
        fetchImpl: async () => new Response('{"message":"failed"}', { status }),
      });
      await assert.rejects(api.submitHumanMessage(actor, app, input, key), ApiError);
    }
  });
  it("isolates actor, role, own tenant and selected tenant without content in keys", () => {
    const base = humanMessageKey(actor);
    for (const changed of [
      humanMessageKey({ ...actor, userId: app }),
      humanMessageKey({ ...actor, role: "viewer" }),
      humanMessageKey({ ...actor, tenantId: sender }),
      humanMessageKey(platform, tenant),
      humanMessageKey(platform, sender),
    ])
      assert.notDeepEqual(base, changed);
    assert.equal(JSON.stringify(base).includes("Private"), false);
  });
  it("isolates mock submission and keeps live payload/key only in the mounted confirmed form", () => {
    const ui = readFileSync(
      new URL("../../../components/app/LiveMessageSend.tsx", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL("../../../routes/messages.send.tsx", import.meta.url),
      "utf8",
    );
    assert.match(route, /apiMode === "mock"/);
    assert.match(route, /MockSendMessage/);
    assert.match(route, /LiveMessageSend/);
    assert.match(ui, /retry: false/);
    assert.match(ui, /gcTime: 0/);
    assert.match(ui, /mutationFn: \(\)/);
    assert.match(ui, /if \(!frozen\)/);
    assert.match(ui, /crypto.randomUUID/);
    assert.match(ui, /if \(!active.current\) return/);
    assert.doesNotMatch(ui, /\bfetch\(|api\.|localStorage|sessionStorage/);
  });
});
