import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  mapProviderAttempts,
  providerAttemptsKey,
  providerAttemptsPath,
} from "../provider-attempts.ts";
import { mapMessageHistoryStatus, mapMessageHistoryAttempt } from "./message-history-mapper.ts";
const id = "11111111-1111-4111-8111-111111111111",
  tenant = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333";
const actor = { role: "super_admin", userId: id, tenantId: null, name: "Admin" } as const;
const attempt = {
  attemptNumber: 1,
  state: "REJECTED",
  errorCategory: "PROVIDER_REJECTED",
  startedAt: "2026-10-21T00:00:00.000Z",
  finishedAt: null,
  providerAccountId: other,
  providerAccountCode: "stored-account",
  providerRouteId: null,
  senderProviderBindingId: null,
};
const body = {
  messageId: id,
  messageStatus: "UNKNOWN",
  providerChanged: false,
  attempts: [attempt],
};
describe("recorded provider attempt history", () => {
  it("requires authenticated named-tenant platform access", () => {
    assert.equal(
      providerAttemptsPath(actor, tenant, id),
      `/tenants/${tenant}/message-history/${id}/provider-attempts`,
    );
    for (const role of ["viewer", "operator", "client_admin"] as const)
      assert.throws(() => providerAttemptsPath({ ...actor, role }, tenant, id));
    assert.throws(() => providerAttemptsPath({ ...actor, userId: "" }, tenant, id));
    assert.throws(() => providerAttemptsPath(actor, "all", id));
    assert.throws(() => providerAttemptsPath(actor, tenant, "bad"));
  });
  it("projects only safe recorded metadata and leaves missing targets null", () => {
    const mapped = mapProviderAttempts(
      {
        ...body,
        recipient: "private",
        attempts: [{ ...attempt, providerMessageId: "private", credential: "secret" }],
      },
      id,
    );
    assert.equal(mapped.messageStatus, "unknown");
    assert.equal(mapped.providerChanged, false);
    assert.deepEqual(mapped.attempts[0], { ...attempt, state: "rejected" });
    assert.equal("recipient" in mapped, false);
    assert.equal("credential" in mapped.attempts[0]!, false);
    assert.equal(
      mapProviderAttempts(
        { ...body, attempts: [{ ...attempt, providerAccountId: null, providerAccountCode: null }] },
        id,
      ).attempts[0]!.providerAccountId,
      null,
    );
  });
  it("requires different recorded account IDs for provider change, never a rejection alone", () => {
    const second = { ...attempt, attemptNumber: 2, providerAccountId: tenant };
    assert.equal(
      mapProviderAttempts({ ...body, providerChanged: true, attempts: [attempt, second] }, id)
        .providerChanged,
      true,
    );
    assert.throws(() => mapProviderAttempts({ ...body, providerChanged: true }, id));
    assert.throws(() => mapProviderAttempts({ ...body, attempts: [attempt, second] }, id));
    assert.equal(
      mapProviderAttempts({ ...body, attempts: [attempt, { ...attempt, attemptNumber: 2 }] }, id)
        .providerChanged,
      false,
    );
    assert.equal(
      mapProviderAttempts(
        {
          ...body,
          attempts: [
            attempt,
            { ...attempt, attemptNumber: 2, providerAccountId: null, providerAccountCode: null },
          ],
        },
        id,
      ).providerChanged,
      false,
    );
  });
  it("rejects unordered, duplicate, wrong-message and invalid metadata/status contracts", () => {
    for (const change of [
      { messageId: other },
      { messageStatus: "not-a-status" },
      { providerChanged: "true" },
      { attempts: [{ ...attempt, providerRouteId: "bad" }] },
      { attempts: [{ ...attempt, providerAccountId: null }] },
      { attempts: [attempt, attempt] },
      { attempts: [{ ...attempt, attemptNumber: 2 }, attempt] },
    ])
      assert.throws(() => mapProviderAttempts({ ...body, ...change }, id));
    for (const value of ["constructor", "toString", "__proto__", "DELIVERED_PROVIDER_GUESS"]) {
      assert.throws(() => mapMessageHistoryStatus(value));
      assert.throws(() => mapMessageHistoryAttempt({ ...attempt, state: value }));
    }
    assert.throws(() =>
      mapMessageHistoryAttempt({ ...attempt, errorCategory: "internal-error-string" }),
    );
  });
  it("uses the existing human GET with no mutation or mock fallback", async () => {
    const calls: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async (url, init) => {
        calls.push(String(url));
        assert.equal(init?.method, "GET");
        assert.equal(init?.body, undefined);
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer human");
        return new Response(JSON.stringify(body));
      },
    });
    assert.equal((await api.getProviderAttempts(actor, tenant, id)).providerChanged, false);
    assert.deepEqual(calls, [
      `https://api.example.test/api/v1/tenants/${tenant}/message-history/${id}/provider-attempts`,
    ]);
  });
  it("surfaces denied/missing/failed responses without converting them to empty history", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "human",
        fetchImpl: async () => new Response('{"message":"failed"}', { status }),
      });
      await assert.rejects(api.getProviderAttempts(actor, tenant, id), ApiError);
    }
  });
  it("isolates identity, role, own tenant, named tenant and message", () => {
    const key = providerAttemptsKey(actor, tenant, id);
    for (const changed of [
      providerAttemptsKey({ ...actor, userId: other }, tenant, id),
      providerAttemptsKey({ ...actor, role: "viewer" }, tenant, id),
      providerAttemptsKey({ ...actor, tenantId: tenant }, tenant, id),
      providerAttemptsKey(actor, other, id),
      providerAttemptsKey(actor, tenant, other),
    ])
      assert.notDeepEqual(key, changed);
  });
});
