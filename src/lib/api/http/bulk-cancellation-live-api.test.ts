import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  bulkCancellationPath,
  bulkCancellationKey,
  mapBulkCancellation,
  bulkCancellationFailure,
} from "../bulk-cancellation.ts";
import { roleHas } from "../../auth/permissions.ts";

const tenant = "11111111-1111-4111-8111-111111111111",
  application = "22222222-2222-4222-8222-222222222222",
  jobId = "33333333-3333-4333-8333-333333333333",
  user = "44444444-4444-4444-8444-444444444444",
  other = "55555555-5555-4555-8555-555555555555";
const target = { tenantId: tenant, applicationId: application, jobId };
const actor = { userId: user, role: "operator", tenantId: tenant, name: "Operator" } as const;
const receipt = {
  id: jobId,
  status: "CANCELLED",
  cancelledAt: "2026-10-21T00:00:00.000Z",
  replay: false,
};
describe("separate human bulk cancellation, without creating or dispatching jobs", () => {
  it("uses application-scoped tenant routes and explicit named-tenant platform routes", () => {
    assert.equal(
      bulkCancellationPath(actor, target),
      `/applications/${application}/bulk-jobs/${jobId}/cancel`,
    );
    assert.equal(
      bulkCancellationPath({ ...actor, role: "super_admin", tenantId: null }, target),
      `/tenants/${tenant}/applications/${application}/bulk-jobs/${jobId}/cancel`,
    );
    assert.throws(() => bulkCancellationPath(actor, { ...target, tenantId: other }));
    assert.throws(() => bulkCancellationPath(actor, { ...target, applicationId: "bad" }));
  });
  it("keeps VIEWER monitoring separate from both legacy creation and cancellation", () => {
    assert.equal(roleHas("viewer", "messages.bulk.monitor"), true);
    assert.equal(roleHas("viewer", "messages.bulk"), false);
    assert.equal(roleHas("viewer", "messages.bulk.cancel"), false);
    assert.throws(() => bulkCancellationPath({ ...actor, role: "viewer" }, target));
    for (const role of ["operator", "client_admin", "super_admin"] as const)
      assert.equal(roleHas(role, "messages.bulk.cancel"), true);
  });
  it("projects only a validated cancellation receipt, preserving replay and unknown timestamps", () => {
    assert.deepEqual(
      mapBulkCancellation(
        { ...receipt, recipient: "private", credentialId: "private", delivered: 99 },
        target,
      ),
      receipt,
    );
    assert.deepEqual(mapBulkCancellation({ ...receipt, replay: true, cancelledAt: null }, target), {
      ...receipt,
      replay: true,
      cancelledAt: null,
    });
    for (const patch of [
      { status: "DELIVERED" },
      { status: "SUBMITTED" },
      { id: other },
      { replay: "true" },
      { cancelledAt: "invalid" },
      { cancelledAt: undefined },
    ])
      assert.throws(() => mapBulkCancellation({ ...receipt, ...patch }, target));
  });
  it("sends one human-authenticated POST with only explicit confirmation", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/api/v1",
      getAccessToken: () => "human-token",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({ ...receipt, payload: "private" }));
      },
    });
    assert.deepEqual(await api.cancelHumanBulkJob(actor, target), receipt);
    assert.equal(requests.length, 1);
    const request = requests[0];
    assert.ok(request);
    assert.equal(
      request.url,
      `https://api.example.com/api/v1/applications/${application}/bulk-jobs/${jobId}/cancel`,
    );
    assert.equal(request.init?.method, "POST");
    assert.deepEqual(JSON.parse(String(request.init?.body)), { confirm: true });
    assert.equal(
      (request.init?.headers as Record<string, string>)["Authorization"],
      "Bearer human-token",
    );
  });
  it("does not retry, fall back to mock, or call the API for locally denied actors", async () => {
    for (const status of [403, 404, 409, 500]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.com/v1",
        getAccessToken: () => "human-token",
        fetchImpl: async () => {
          calls++;
          return new Response('{"message":"unavailable"}', { status });
        },
      });
      await assert.rejects(api.cancelHumanBulkJob(actor, target), (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(
          bulkCancellationFailure(error),
          status === 403
            ? "bulkCancel.forbidden"
            : status === 404
              ? "bulkCancel.notFound"
              : status === 409
                ? "bulkCancel.conflict"
                : "bulkCancel.error",
        );
        return true;
      });
      assert.equal(calls, 1);
      await assert.rejects(api.cancelHumanBulkJob({ ...actor, role: "viewer" }, target));
      assert.equal(calls, 1);
    }
  });
  it("isolates mutation targets by actor, authority and each tenant/application/job", () => {
    const key = bulkCancellationKey(actor, target);
    for (const nextActor of [
      { ...actor, userId: other },
      { ...actor, role: "client_admin" as const },
      { ...actor, tenantId: other },
    ])
      assert.notDeepEqual(key, bulkCancellationKey(nextActor, target));
    for (const nextTarget of [
      { ...target, tenantId: other },
      { ...target, applicationId: other },
      { ...target, jobId: other },
    ])
      assert.notDeepEqual(key, bulkCancellationKey(actor, nextTarget));
    const source = readFileSync(
      new URL("../../../components/app/BulkJobCancellation.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /retry: false/);
    assert.match(source, /gcTime: 0/);
    assert.match(source, /can\("messages.bulk.cancel"\)/);
    assert.match(source, /!confirmed/);
    assert.doesNotMatch(source, /api\.|fetch\(/);
  });
});
