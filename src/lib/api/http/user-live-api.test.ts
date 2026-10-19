import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";

const base = "https://api.example.test/api/v1";
const tenantId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-10-01T00:00:00.000Z";

describe("live user API", () => {
  it("uses the global platform directory and tenant-scoped route without tenant headers", async () => {
    const requests: { url: string; headers: string[]; bearer: string | null }[] = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        requests.push({
          url: String(input),
          headers: [...headers.keys()],
          bearer: headers.get("Authorization"),
        });
        return new Response(
          JSON.stringify({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          }),
          { status: 200 },
        );
      },
    });
    const platform = {
      role: "super_admin",
      tenantId: null,
      userId: "platform",
      name: "Platform",
    } as const;
    const client = { role: "client_admin", tenantId, userId: "client", name: "Client" } as const;

    await api.listUsers(platform, {
      page: 1,
      pageSize: 20,
      search: " Nora ",
      filters: { status: "active" },
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    await api.listUsers(platform, { page: 2, pageSize: 50 }, tenantId);
    await api.listUsers(client, { page: 1, pageSize: 10 }, "spoofed-tenant");

    assert.deepEqual(
      requests.map(({ url }) => url),
      [
        `${base}/platform/users?page=1&pageSize=20&search=Nora&status=ACTIVE&sortBy=createdAt&sortDirection=desc`,
        `${base}/tenants/${tenantId}/users?page=2&pageSize=50`,
        `${base}/users?page=1&pageSize=10`,
      ],
    );
    assert.ok(
      requests.every(
        (request) =>
          request.bearer === "Bearer test-token" &&
          request.headers.length === 2 &&
          !request.headers.some((header) => header.includes("tenant")),
      ),
    );
  });

  it("creates invited users, patches only profile fields, and separates role and status operations", async () => {
    const requests: { url: string; method: string; body: unknown; headers: string[] }[] = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : null;
        requests.push({
          url: String(input),
          method: init?.method ?? "GET",
          body,
          headers: [...headers.keys()],
        });
        const status =
          body && typeof body === "object" && "status" in body ? String(body.status) : "INVITED";
        const role =
          body && typeof body === "object" && "role" in body ? String(body.role) : "OPERATOR";
        const preferredLanguage =
          body && typeof body === "object" && "preferredLanguage" in body
            ? String(body.preferredLanguage)
            : "EN";
        return new Response(
          JSON.stringify(
            userResponse({
              status,
              role,
              preferredLanguage,
            }),
          ),
          { status: 200 },
        );
      },
    });
    const actor = {
      role: "super_admin",
      tenantId: null,
      userId: "platform",
      name: "Platform",
    } as const;

    const created = await api.inviteUser(
      actor,
      {
        email: "nora@example.test",
        firstName: "Nora",
        lastName: "Saleh",
        preferredLanguage: "en",
        role: "operator",
      },
      tenantId,
    );
    const updated = await api.updateUser(
      actor,
      userId,
      {
        firstName: "Nora",
        lastName: "Saleh",
        firstNameArabic: null,
        lastNameArabic: null,
        mobileNumber: null,
        jobTitle: null,
        department: null,
        preferredLanguage: "ar",
      },
      tenantId,
    );
    await api.setUserRole(actor, userId, "viewer", tenantId);
    const disabled = await api.setUserStatus(actor, userId, "disabled", tenantId);

    assert.equal(created.status, "invited");
    assert.equal(updated.preferredLanguage, "ar");
    assert.equal(disabled.status, "disabled");
    assert.deepEqual(
      requests.map(({ url, method }) => ({ url, method })),
      [
        { url: `${base}/tenants/${tenantId}/users`, method: "POST" },
        { url: `${base}/tenants/${tenantId}/users/${userId}`, method: "PATCH" },
        { url: `${base}/tenants/${tenantId}/users/${userId}/role`, method: "POST" },
        { url: `${base}/tenants/${tenantId}/users/${userId}/status`, method: "POST" },
      ],
    );
    assert.deepEqual(requests[0]?.body, {
      email: "nora@example.test",
      firstName: "Nora",
      lastName: "Saleh",
      preferredLanguage: "EN",
      role: "OPERATOR",
    });
    assert.equal(
      typeof requests[1]?.body === "object" &&
        requests[1].body !== null &&
        "email" in requests[1].body,
      false,
    );
    assert.equal(
      typeof requests[1]?.body === "object" &&
        requests[1].body !== null &&
        "role" in requests[1].body,
      false,
    );
    assert.ok(
      requests.every(
        (request) =>
          request.headers.includes("authorization") &&
          !request.headers.some((header) => header.includes("tenant")),
      ),
    );
  });
});

function userResponse(overrides: Record<string, string> = {}) {
  return {
    id: userId,
    tenantId,
    email: "nora@example.test",
    firstName: "Nora",
    lastName: "Saleh",
    firstNameAr: null,
    lastNameAr: null,
    mobile: null,
    jobTitle: null,
    department: null,
    preferredLanguage: "EN",
    role: "OPERATOR",
    status: "ACTIVE",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
