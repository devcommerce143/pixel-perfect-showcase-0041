import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import { senderMutationRequest, mapSenderMutation } from "./sender-mutation-mapper.ts";
import { availableSenderActions, senderMutationKey } from "../sender-mutations.ts";
import type { LiveSenderMutation, SenderRegistration } from "../sender-mutations.ts";
import { mapSenderIdentity } from "./sender-identity-mapper.ts";
import { roleHas } from "../../auth/permissions.ts";
const tenant = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333";
const actor = { userId: id, role: "client_admin", tenantId: tenant, name: "Admin" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const row = {
  id,
  tenantId: tenant,
  channel: "SMS",
  displayName: "Notices",
  verificationStatus: "DRAFT",
  operationalStatus: "INACTIVE",
  providerReference: null,
  rejectionReason: null,
  suspensionReason: null,
  sms: { senderId: "DOLF", countryCode: "SA" },
  email: null,
  whatsapp: null,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};
const sms: SenderRegistration = {
  channel: "sms",
  displayName: " Notices ",
  senderId: " dolf ",
  countryCode: "sa",
};
describe("sender registration and internal lifecycle contracts", () => {
  it("uses exact channel subtype bodies and two-letter country codes", () => {
    assert.deepEqual(senderMutationRequest(actor, { kind: "create", input: sms }), {
      path: "/senders",
      body: {
        channel: "SMS",
        displayName: "Notices",
        sms: { senderId: "dolf", countryCode: "SA" },
      },
    });
    const email: SenderRegistration = {
      channel: "email",
      displayName: "Email",
      emailAddress: " notices@example.com ",
      providerReference: " ref ",
    };
    assert.deepEqual(
      senderMutationRequest(platform, { kind: "create", input: email }, tenant).body,
      {
        channel: "EMAIL",
        displayName: "Email",
        providerReference: "ref",
        email: { emailAddress: "notices@example.com" },
      },
    );
    const whatsapp: SenderRegistration = {
      channel: "whatsapp",
      displayName: "WhatsApp",
      businessDisplayName: "Business",
      phoneNumber: "+966500000000",
      countryCode: "SA",
      wabaId: "waba",
      phoneNumberId: "phone",
    };
    assert.deepEqual(senderMutationRequest(actor, { kind: "create", input: whatsapp }).body, {
      channel: "WHATSAPP",
      displayName: "WhatsApp",
      whatsapp: {
        businessDisplayName: "Business",
        phoneNumber: "+966500000000",
        countryCode: "SA",
        wabaId: "waba",
        phoneNumberId: "phone",
      },
    });
    for (const input of [
      { ...sms, senderId: "NO" },
      { ...sms, countryCode: "+966" },
      { ...whatsapp, wabaId: "" },
      { ...email, emailAddress: "invalid" },
    ])
      assert.throws(() => senderMutationRequest(actor, { kind: "create", input }));
  });
  it("requires named tenant platform context and prevents tenant hopping and tenant verification decisions", () => {
    assert.throws(() => senderMutationRequest(platform, { kind: "create", input: sms }));
    assert.throws(() => senderMutationRequest(actor, { kind: "create", input: sms }, other));
    for (const kind of ["review", "verify", "reject"] as const)
      assert.throws(() => senderMutationRequest(actor, { kind, id, reason: "evidence" }));
    assert.throws(() =>
      senderMutationRequest(platform, { kind: "reject", id, reason: " " }, tenant),
    );
    assert.throws(() => senderMutationRequest(actor, { kind: "suspend", id }));
  });
  it("projects scoped responses and requires actual resulting states", () => {
    assert.equal(
      mapSenderMutation({ ...row, secret: "internal" }, actor, { kind: "create", input: sms })
        .verificationStatus,
      "draft",
    );
    assert.throws(() =>
      mapSenderMutation({ ...row, tenantId: other }, actor, { kind: "create", input: sms }),
    );
    assert.throws(() => mapSenderMutation({ ...row, id: other }, actor, { kind: "submit", id }));
    assert.throws(() => mapSenderMutation(row, actor, { kind: "submit", id }));
    assert.throws(() =>
      mapSenderMutation({ ...row, verificationStatus: "PROVIDER_APPROVED" }, actor, {
        kind: "verify",
        id,
      }),
    );
  });
  it("exposes state-valid actions while preserving platform-only internal decisions", () => {
    const draft = mapSenderIdentity(row);
    assert.deepEqual(availableSenderActions(draft, false), ["submit", "suspend"]);
    const pending = { ...draft, verificationStatus: "pending_verification" as const };
    assert.deepEqual(availableSenderActions(pending, false), ["suspend"]);
    assert.deepEqual(availableSenderActions(pending, true), ["verify", "reject", "suspend"]);
    const active = {
      ...draft,
      verificationStatus: "verified" as const,
      operationalStatus: "active" as const,
    };
    assert.deepEqual(availableSenderActions(active, true), ["deactivate", "suspend"]);
    assert.equal(roleHas("client_admin", "senderIdentities.request"), true);
    for (const role of ["operator", "viewer"] as const) {
      assert.equal(roleHas(role, "senderIdentities.request"), false);
      assert.equal(roleHas(role, "platform.senderIdentities.manage"), false);
    }
  });
  it("isolates mutation identity, role and tenant scope", () => {
    const key = senderMutationKey(actor);
    for (const next of [
      senderMutationKey({ ...actor, userId: other }),
      senderMutationKey({ ...actor, role: "viewer" }),
      senderMutationKey({ ...actor, tenantId: other }),
      senderMutationKey(platform, tenant),
      senderMutationKey(platform, other),
    ])
      assert.notDeepEqual(key, next);
  });
  it("uses POST human routes for all supported actions and normalized response states", async () => {
    const states = {
      submit: "SUBMITTED",
      review: "PENDING_VERIFICATION",
      verify: "VERIFIED",
      reject: "REJECTED",
      reopen: "DRAFT",
    } as const;
    const operations: LiveSenderMutation[] = [
      { kind: "create", input: sms },
      ...(
        [
          "submit",
          "review",
          "verify",
          "reject",
          "reopen",
          "activate",
          "deactivate",
          "suspend",
        ] as const
      ).map((kind) => ({ kind, id, reason: "Evidence" })),
    ];
    let response: unknown = row;
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify(response), { status: 200 });
      },
    });
    for (const operation of operations) {
      const verificationStatus =
        operation.kind in states ? states[operation.kind as keyof typeof states] : "DRAFT";
      const operationalStatus =
        operation.kind === "activate"
          ? "ACTIVE"
          : operation.kind === "suspend"
            ? "SUSPENDED"
            : "INACTIVE";
      response = { ...row, verificationStatus, operationalStatus };
      await api.applyLiveSenderMutation(platform, operation, tenant);
      const request = requests.at(-1)!,
        expected = senderMutationRequest(platform, operation, tenant);
      assert.equal(request.url, `https://api.example.com/v1${expected.path}`);
      assert.equal(request.init?.method, "POST");
      assert.equal(request.init?.body, JSON.stringify(expected.body));
      assert.equal(
        (request.init?.headers as Record<string, string>)["Authorization"],
        "Bearer token",
      );
    }
  });
  it("propagates failures without mock fallback or automatic submission retries", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => {
        calls++;
        return new Response('{"message":"conflict"}', { status: 409 });
      },
    });
    await assert.rejects(api.applyLiveSenderMutation(actor, { kind: "submit", id }), ApiError);
    assert.equal(calls, 1);
    const component = readFileSync(
      new URL("../../../components/app/LiveSenderActions.tsx", import.meta.url),
      "utf8",
    );
    assert.match(component, /retry: false/);
    assert.doesNotMatch(component, /api\.|reactivate|updateSender/);
  });
});
