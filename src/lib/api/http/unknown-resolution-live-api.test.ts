import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import { roleHas } from "../../auth/permissions.ts";
import {
  unknownResolutionAvailable,
  unknownResolutionBody,
  unknownResolutionKey,
  unknownResolutionPath,
  mapUnknownResolution,
} from "../unknown-resolution.ts";
import type { UnknownResolutionDecision, UnknownResolutionInput } from "../unknown-resolution.ts";
import type { MessageHistoryDetail } from "../types.ts";

const message = "11111111-1111-4111-8111-111111111111";
const tenant = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const actor = { userId: other, role: "super_admin", tenantId: null, name: "Admin" } as const;
const input: UnknownResolutionInput = {
  decision: "commit",
  reason: "Reviewed uncertain acceptance",
  evidenceReference: "ticket:CASE-1",
};
const response = (decision: UnknownResolutionDecision, changed = true) => ({
  messageId: message,
  decision,
  changed,
  messageStatus: decision === "record_acceptance" ? "SUBMITTED" : "UNKNOWN",
  reservationState: decision === "release" ? "RELEASED" : "COMMITTED",
});
const detail: MessageHistoryDetail = {
  id: message,
  applicationId: other,
  channel: "sms",
  status: "unknown",
  senderIdentityId: other,
  templateId: null,
  correlationId: null,
  contentPurgedAt: null,
  recipientNormalized: "+15550000000",
  acceptedAt: "2026-10-21T00:00:00.000Z",
  queuedAt: null,
  attempts: [
    {
      attemptNumber: 1,
      state: "unknown",
      errorCategory: null,
      startedAt: "2026-10-21T00:00:00.000Z",
      finishedAt: null,
    },
  ],
};

describe("platform UNKNOWN resolution integration", () => {
  it("requires a named tenant and centralized platform permission", () => {
    assert.equal(
      unknownResolutionPath(actor, tenant, message),
      `/tenants/${tenant}/messages/${message}/unknown-resolution`,
    );
    for (const role of ["viewer", "operator", "client_admin"] as const) {
      assert.equal(roleHas(role, "platform.messages.resolveUnknown"), false);
      assert.throws(() => unknownResolutionPath({ ...actor, role }, tenant, message));
      assert.equal(unknownResolutionAvailable({ ...actor, role }, tenant, detail), false);
    }
    assert.throws(() => unknownResolutionPath({ ...actor, userId: "" }, tenant, message));
    assert.throws(() => unknownResolutionPath(actor, "all", message));
    assert.throws(() => unknownResolutionPath(actor, tenant, "invalid"));
  });
  it("offers only live SMS UNKNOWN with an uncertain attempt and explicit tenant", () => {
    assert.equal(unknownResolutionAvailable(actor, tenant, detail), true);
    assert.equal(unknownResolutionAvailable(actor, undefined, detail), false);
    assert.equal(unknownResolutionAvailable(actor, tenant, { ...detail, channel: "email" }), false);
    assert.equal(
      unknownResolutionAvailable(actor, tenant, { ...detail, status: "submitted" }),
      false,
    );
    assert.equal(unknownResolutionAvailable(actor, tenant, { ...detail, attempts: [] }), false);
  });
  it("validates and allowlists evidence and receipt inputs without arbitrary fields", () => {
    assert.deepEqual(
      unknownResolutionBody({
        ...input,
        reason: `  ${input.reason}  `,
        secret: "drop",
      } as UnknownResolutionInput),
      input,
    );
    for (const invalid of [
      { decision: "resend" },
      { reason: "short" },
      { reason: "first line\nsecond line" },
      { evidenceReference: "no" },
      { evidenceReference: "x".repeat(129) },
      { providerMessageId: "123" },
      { decision: "record_acceptance" },
      { decision: "record_acceptance", providerMessageId: "not-numeric" },
    ])
      assert.throws(() =>
        unknownResolutionBody({ ...input, ...invalid } as UnknownResolutionInput),
      );
    assert.equal(
      unknownResolutionBody({
        ...input,
        decision: "record_acceptance",
        providerMessageId: "12345678901234567890",
      }).providerMessageId,
      "12345678901234567890",
    );
  });
  it("maps only exact accounting/acceptance outcomes, never delivered", () => {
    for (const decision of ["commit", "release", "record_acceptance"] as const) {
      const mapped = mapUnknownResolution(
        { ...response(decision), recipient: "private", reason: "private" },
        message,
        decision,
      );
      assert.equal(
        mapped.messageStatus,
        decision === "record_acceptance" ? "submitted" : "unknown",
      );
      assert.equal(mapped.reservationState, decision === "release" ? "released" : "committed");
      assert.equal("recipient" in mapped, false);
      assert.equal("reason" in mapped, false);
      assert.equal(
        mapUnknownResolution(response(decision, false), message, decision).changed,
        false,
      );
    }
    for (const invalid of [
      { messageStatus: "DELIVERED" },
      { reservationState: "RESERVED" },
      { messageId: other },
      { decision: "release" },
      { changed: "true" },
    ])
      assert.throws(() =>
        mapUnknownResolution({ ...response("commit"), ...invalid }, message, "commit"),
      );
  });
  it("uses only the human named-tenant POST with exact projected body", async () => {
    const calls: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async (url, init) => {
        calls.push(String(url));
        assert.equal(init?.method, "POST");
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer human");
        assert.deepEqual(JSON.parse(String(init?.body)), input);
        return new Response(JSON.stringify(response("commit")));
      },
    });
    assert.equal(
      (await api.resolveUnknownMessage(actor, tenant, message, input)).messageStatus,
      "unknown",
    );
    assert.deepEqual(calls, [
      `https://api.example.test/api/v1/tenants/${tenant}/messages/${message}/unknown-resolution`,
    ]);
  });
  it("does not send denied scope/invalid evidence and never falls back after errors", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async () => {
        calls++;
        return new Response('{"message":"conflict"}', { status: 409 });
      },
    });
    await assert.rejects(
      api.resolveUnknownMessage({ ...actor, role: "viewer" }, tenant, message, input),
    );
    await assert.rejects(
      api.resolveUnknownMessage(actor, tenant, message, { ...input, reason: "bad" }),
    );
    assert.equal(calls, 0);
    await assert.rejects(api.resolveUnknownMessage(actor, tenant, message, input), ApiError);
    assert.equal(calls, 1);
    for (const status of [401, 403, 404, 500]) {
      const failed = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "human",
        fetchImpl: async () => new Response('{"message":"failed"}', { status }),
      });
      await assert.rejects(failed.resolveUnknownMessage(actor, tenant, message, input), ApiError);
    }
  });
  it("isolates actor, role, own tenant, named tenant and message in operation keys", () => {
    const key = unknownResolutionKey(actor, tenant, message);
    for (const otherKey of [
      unknownResolutionKey({ ...actor, userId: message }, tenant, message),
      unknownResolutionKey({ ...actor, role: "viewer" }, tenant, message),
      unknownResolutionKey({ ...actor, tenantId: tenant }, tenant, message),
      unknownResolutionKey(actor, other, message),
      unknownResolutionKey(actor, tenant, other),
    ])
      assert.notDeepEqual(key, otherKey);
  });
  it("keeps confirmation/evidence in mounted state, disables retries and uses query-layer mutations", () => {
    const ui = readFileSync(
      new URL("../../../features/messages/UnknownResolutionPanel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /retry: false/);
    assert.match(ui, /gcTime: 0/);
    assert.match(ui, /mutationFn: \(\)/);
    assert.match(ui, /unknownResolutionMutations\.resolve/);
    assert.match(ui, /!valid \|\| !acknowledged/);
    assert.match(ui, /if \(!active\.current\) return/);
    assert.doesNotMatch(ui, /\bfetch\(|localStorage|sessionStorage|api\./);
  });
});
