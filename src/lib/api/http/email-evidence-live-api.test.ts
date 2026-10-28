import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  emailEvidencePath,
  emailEvidenceKey,
  emailEvidenceBody,
  mapEmailEvidenceCurrent,
  mapEmailEvidencePage,
} from "../email-evidence.ts";
import type { EmailEvidenceInput } from "../email-evidence.ts";
const id = "11111111-1111-4111-8111-111111111111",
  tenant = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333";
const actor = { userId: other, role: "super_admin", tenantId: null, name: "Admin" } as const;
const states = {
  domainVerificationStatus: "VERIFIED",
  spfStatus: "VERIFIED",
  dkimStatus: "VERIFIED",
} as const;
const current = { senderId: id, tenantId: tenant, domain: "example.test", ...states };
const input: EmailEvidenceInput = {
  domain: "example.test",
  ...states,
  evidenceReference: "review:CASE-1",
  expected: states,
  expectedRevision: 1,
};
const item = {
  id: other,
  actorUserId: other,
  createdAt: "2026-10-21T00:00:00.000Z",
  evidenceReference: "review:CASE-1",
  source: "OPERATOR_REVIEW",
  ...states,
};
const page = { current, items: [item], page: 1, pageSize: 20, total: 1 };
describe("reviewed email evidence live contracts", () => {
  it("requires explicit named-tenant platform scope and bounded pagination", () => {
    assert.equal(
      emailEvidencePath(actor, tenant, id, 2),
      `/tenants/${tenant}/senders/${id}/email-evidence?page=2&pageSize=20`,
    );
    assert.equal(
      emailEvidencePath(actor, tenant, id),
      `/tenants/${tenant}/senders/${id}/email-evidence`,
    );
    assert.throws(() => emailEvidencePath({ ...actor, role: "viewer" }, tenant, id));
    assert.throws(() => emailEvidencePath({ ...actor, userId: "" }, tenant, id));
    assert.throws(() => emailEvidencePath(actor, "bad", id));
    assert.throws(() => emailEvidencePath(actor, tenant, "bad"));
    for (const value of [0, 1.5, 1e12])
      assert.throws(() => emailEvidencePath(actor, tenant, id, value));
  });
  it("accepts plain and legacy references, trims whitespace and preserves history", () => {
    for (const reference of [
      "EMAIL-READINESS-2026-10-27",
      "review:EMAIL-READINESS-2026-10-27",
      "ticket:INC-123",
      "change:CHG-123",
    ]) {
      assert.equal(
        emailEvidenceBody({ ...input, evidenceReference: `  ${reference}  ` }).evidenceReference,
        reference,
      );
      assert.equal(
        mapEmailEvidencePage(
          { ...page, items: [{ ...item, evidenceReference: reference }] },
          tenant,
          id,
          1,
          ).items[0]?.evidenceReference,
        reference,
      );
    }
    for (const reference of [
      "",
      "  ",
      "x".repeat(65),
      "review:" + "x".repeat(65),
      "a/b",
      "a:b",
      "a\nB",
    ])
      assert.throws(() => emailEvidenceBody({ ...input, evidenceReference: reference }));
  });
  it("projects only reviewed fields and preserves the frozen expected state and revision", () => {
    assert.deepEqual(
      emailEvidenceBody({ ...input, rawEvidence: "secret" } as EmailEvidenceInput),
      input,
    );
    for (const reference of ["https://private.test?token=secret", "review:has space"])
      assert.throws(() => emailEvidenceBody({ ...input, evidenceReference: reference }));
    assert.throws(() => emailEvidenceBody({ ...input, expectedRevision: -1 }));
    assert.throws(() =>
      emailEvidenceBody({
        ...input,
        spfStatus: "PROVIDER_APPROVED",
      } as unknown as EmailEvidenceInput),
    );
    assert.throws(() =>
      emailEvidenceBody({
        ...input,
        expected: { ...states, dkimStatus: "UNKNOWN" },
      } as unknown as EmailEvidenceInput),
    );
  });
  it("validates actual current states and scopes without claiming provider approval", () => {
    assert.deepEqual(
      mapEmailEvidenceCurrent({ ...current, internal: "private" }, tenant, id, input),
      current,
    );
    assert.throws(() => mapEmailEvidenceCurrent(current, other, id));
    assert.throws(() => mapEmailEvidenceCurrent(current, tenant, other));
    assert.throws(() =>
      mapEmailEvidenceCurrent({ ...current, spfStatus: "FAILED" }, tenant, id, input),
    );
    assert.throws(() =>
      mapEmailEvidenceCurrent({ ...current, domain: "other.test" }, tenant, id, input),
    );
  });
  it("projects history allowlists and preserves redacted unknown fields as unavailable", () => {
    assert.deepEqual(
      mapEmailEvidencePage(
        { ...page, items: [{ ...item, token: "secret", rawEvidence: "private" }] },
        tenant,
        id,
        1,
      ),
      page,
    );
    const redacted = {
      ...item,
      evidenceReference: null,
      source: null,
      domainVerificationStatus: null,
      spfStatus: null,
      dkimStatus: null,
    };
    assert.deepEqual(mapEmailEvidencePage({ ...page, items: [redacted] }, tenant, id, 1).items, [
      redacted,
    ]);
    for (const changed of [
      { source: "PROVIDER_SYNC" },
      { evidenceReference: "https://secret.test" },
      { dkimStatus: "INTERNAL_ERROR" },
    ])
      assert.throws(() =>
        mapEmailEvidencePage({ ...page, items: [{ ...item, ...changed }] }, tenant, id, 1),
      );
    for (const changed of [
      { page: 2 },
      { pageSize: 50 },
      { total: 0 },
      { items: [item, item], total: 2 },
    ])
      assert.throws(() => mapEmailEvidencePage({ ...page, ...changed }, tenant, id, 1));
  });
  it("uses separate human GET/POST paths with exact bodies and safe responses", async () => {
    const calls: Array<{ url: string; method: string | undefined; body: unknown }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async (url, init) => {
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer human");
        calls.push({
          url: String(url),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        return new Response(JSON.stringify(init?.method === "POST" ? current : page));
      },
    });
    assert.deepEqual(await api.getEmailEvidence(actor, tenant, id, 1), page);
    assert.deepEqual(await api.recordEmailEvidence(actor, tenant, id, input), current);
    assert.deepEqual(calls, [
      {
        url: `https://api.example.test/api/v1/tenants/${tenant}/senders/${id}/email-evidence?page=1&pageSize=20`,
        method: "GET",
        body: undefined,
      },
      {
        url: `https://api.example.test/api/v1/tenants/${tenant}/senders/${id}/email-evidence`,
        method: "POST",
        body: input,
      },
    ]);
  });
  it("surfaces denied/conflicting/failed reads and records without mock evidence", async () => {
    for (const status of [401, 403, 404, 409, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "human",
        fetchImpl: async () => new Response('{"message":"failed"}', { status }),
      });
      await assert.rejects(api.getEmailEvidence(actor, tenant, id, 1), ApiError);
      await assert.rejects(api.recordEmailEvidence(actor, tenant, id, input), ApiError);
    }
  });
  it("isolates identity, role, own tenant, selected tenant and sender in keys", () => {
    const key = emailEvidenceKey(actor, tenant, id);
    assert.notDeepEqual(key, emailEvidenceKey({ ...actor, userId: id }, tenant, id));
    assert.notDeepEqual(
      key,
      emailEvidenceKey({ ...actor, role: "viewer", tenantId: tenant }, tenant, id),
    );
    assert.notDeepEqual(key, emailEvidenceKey(actor, other, id));
    assert.notDeepEqual(key, emailEvidenceKey(actor, tenant, other));
  });
  it("requires platform permission in live sender details and captures revision when opening review", () => {
    const parent = readFileSync(
      new URL("../../../components/app/LiveSenderActions.tsx", import.meta.url),
      "utf8",
    );
    assert.match(parent, /identity\?\.channel === "email"/);
    assert.match(parent, /can\("platform.senderIdentities.manage"\)/);
    const ui = readFileSync(
      new URL("../../../components/app/EmailEvidencePanel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /expectedRevision: history\.data\.total/);
    assert.match(ui, /mutation\.mutate\(draft\)/);
    assert.match(ui, /retry: false/);
    assert.match(ui, /gcTime: 0/);
    assert.match(ui, /active\.current/);
    assert.doesNotMatch(ui, /\bfetch\(|api\.|PROVIDER_SYNC|setInterval/);
  });
});
