import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapUserPage,
  mapUserResponse,
  toCreateUserRequest,
  toUpdateUserProfileRequest,
  toUserRoleRequest,
  toUserStatusRequest,
  userCreatePath,
  userItemPath,
  userListPath,
} from "./user-mapper.ts";

const tenantId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-10-01T00:00:00.000Z";

describe("user API mapper", () => {
  it("maps every backend role and status without inventing login or MFA data", () => {
    const statuses = ["INVITED", "ACTIVE", "SUSPENDED", "DISABLED"] as const;
    const expected = ["invited", "active", "suspended", "disabled"] as const;
    for (const [index, status] of statuses.entries()) {
      const user = mapUserResponse(response({ status }));
      assert.equal(user.status, expected[index]);
      assert.equal(user.role, "client_admin");
      assert.equal(user.name, "Nora Saleh");
      assert.equal(user.mfa, undefined);
      assert.equal(user.lastLoginAt, undefined);
    }
    assert.equal(mapUserResponse(response({ role: "PLATFORM_SUPER_ADMIN" })).role, "super_admin");
  });

  it("maps a tenant name only when the global endpoint returns it", () => {
    assert.equal(
      mapUserResponse(response({ tenantName: "Example tenant" })).tenantName,
      "Example tenant",
    );
    assert.equal(mapUserResponse(response()).tenantName, undefined);
    assert.equal(mapUserResponse(response({ tenantId: null, tenantName: null })).tenantName, null);
  });

  it("validates page metadata and item count", () => {
    assert.deepEqual(mapUserPage({ items: [response()], page: 1, pageSize: 1, total: 1 }), {
      items: [mapUserResponse(response())],
      page: 1,
      pageSize: 1,
      total: 1,
    });
    assert.throws(() => mapUserPage({ items: [], page: 1, pageSize: 1, total: 1 }), /incomplete/);
    assert.throws(
      () => mapUserPage({ items: [response(), response()], page: 1, pageSize: 2, total: 2 }),
      /duplicate/,
    );
  });

  it("selects only established list routes and pagination parameters", () => {
    assert.equal(
      userListPath("super_admin", { page: 2, pageSize: 50 }),
      "/platform/users?page=2&pageSize=50",
    );
    assert.equal(
      userListPath("super_admin", { page: 1, pageSize: 20 }, tenantId),
      `/tenants/${tenantId}/users?page=1&pageSize=20`,
    );
    assert.equal(
      userListPath("client_admin", { page: 1, pageSize: 20 }, tenantId),
      "/users?page=1&pageSize=20",
    );
    assert.equal(userCreatePath("client_admin", tenantId), "/users");
    assert.equal(userCreatePath("super_admin", tenantId), `/tenants/${tenantId}/users`);
    assert.equal(userItemPath("client_admin", userId), `/users/${userId}`);
    assert.equal(
      userItemPath("super_admin", userId, tenantId),
      `/tenants/${tenantId}/users/${userId}`,
    );
    assert.throws(() => userCreatePath("super_admin"), /tenant/);
    assert.throws(() => userItemPath("super_admin", userId), /tenant/);
  });

  it("serializes directory search, status, sorting, and direction without tenant scope parameters", () => {
    const path = userListPath("super_admin", {
      page: 3,
      pageSize: 50,
      search: "  Nora Saleh ",
      filters: { status: "active", tenantId },
      sortBy: "tenantName",
      sortDirection: "desc",
    });
    assert.equal(
      path,
      "/platform/users?page=3&pageSize=50&search=Nora+Saleh&status=ACTIVE&sortBy=tenantName&sortDirection=desc",
    );
    assert.equal(path.includes(tenantId), false);
    assert.throws(
      () => userListPath("super_admin", { sortBy: "tenantName" }, tenantId),
      /global platform directory/,
    );
    assert.throws(
      () => userListPath("client_admin", { sortBy: "tenantName" }),
      /global platform directory/,
    );
  });

  it("maps create, profile, role, and lifecycle DTOs without unsupported fields", () => {
    assert.deepEqual(
      toCreateUserRequest({
        email: " nora@example.test ",
        firstName: " Nora ",
        lastName: " Saleh ",
        firstNameArabic: "نورة",
        lastNameArabic: null,
        preferredLanguage: "ar",
        role: "client_admin",
      }),
      {
        email: "nora@example.test",
        firstName: "Nora",
        lastName: "Saleh",
        firstNameAr: "نورة",
        lastNameAr: null,
        preferredLanguage: "AR",
        role: "CLIENT_ADMIN",
      },
    );
    const profile = toUpdateUserProfileRequest({
      firstName: "Nora",
      lastName: "Saleh",
      firstNameArabic: null,
      lastNameArabic: null,
      mobileNumber: null,
      jobTitle: null,
      department: null,
      preferredLanguage: "en",
    });
    assert.deepEqual(profile, {
      firstName: "Nora",
      lastName: "Saleh",
      firstNameAr: null,
      lastNameAr: null,
      mobile: null,
      jobTitle: null,
      department: null,
      preferredLanguage: "EN",
    });
    assert.equal("email" in profile, false);
    assert.equal("role" in profile, false);
    assert.equal("tenantId" in profile, false);
    assert.equal("externalSubject" in profile, false);
    assert.deepEqual(toUserRoleRequest("viewer"), { role: "VIEWER" });
    assert.deepEqual(toUserStatusRequest("suspended"), { status: "SUSPENDED" });
  });
});

function response(overrides: Record<string, unknown> = {}) {
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
    role: "CLIENT_ADMIN",
    status: "ACTIVE",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
