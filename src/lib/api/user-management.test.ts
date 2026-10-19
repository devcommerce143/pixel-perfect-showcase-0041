import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PortalUser } from "./types.ts";
import { ApiError } from "./http/errors.ts";
import { availableUserStatusTransitions, userMutationErrorMessage } from "./user-management.ts";
import { createMockApi, sortMockUsers } from "./mock/mock-api.ts";

describe("user management behavior", () => {
  it("supports tenant-name search, status filtering, sorting, and pagination in mock mode", async () => {
    const api = createMockApi();
    const actor = {
      role: "super_admin",
      tenantId: null,
      userId: "platform",
      name: "Platform",
    } as const;
    const result = await api.listUsers(actor, {
      page: 1,
      pageSize: 2,
      search: "AL NOOR FINANCIAL SERVICES",
      filters: { status: "active" },
      sortBy: "name",
      sortDirection: "desc",
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.total, 4);
    assert.ok(result.items.every((user) => user.status === "active"));
    assert.ok(result.items.every((user) => user.tenantName === "Al Noor Financial Services"));
    assert.deepEqual(result.items.map((user) => user.id), ["usr-0150", "usr-0134"]);
    assert.equal(result.page, 1);
    assert.equal(result.pageSize, 2);

    const arabicNameSearch = await api.listUsers(actor, {
      page: 1,
      pageSize: 20,
      search: "نورة",
      filters: { status: "all" },
    });
    assert.ok(arabicNameSearch.items.some((user) => user.firstNameArabic?.includes("نورة")));
  });

  it("matches multiword Arabic names across first- and last-name fields", async () => {
    const api = createMockApi();
    const actor = {
      role: "super_admin",
      tenantId: null,
      userId: "platform",
      name: "Platform",
    } as const;

    const matching = await api.listUsers(actor, {
      page: 1,
      pageSize: 20,
      search: "نورة القهطاني",
    });
    assert.deepEqual(matching.items.map((user) => user.id), ["usr-0101"]);

    const notMatching = await api.listUsers(actor, {
      page: 1,
      pageSize: 20,
      search: "نورة اسم-غير-موجود",
    });
    assert.equal(notMatching.total, 0);
    assert.deepEqual(notMatching.items, []);
  });

  it("sorts persisted statuses by Prisma enum order in both directions with stable IDs", () => {
    const rows = [
      fixture("active", "active"),
      fixture("disabled", "disabled"),
      fixture("invited-z", "invited"),
      fixture("suspended", "suspended"),
      fixture("invited-a", "invited"),
    ];

    assert.deepEqual(
      sortMockUsers(rows, "status", "asc").map((user) => user.id),
      ["invited-a", "invited-z", "active", "suspended", "disabled"],
    );
    assert.deepEqual(
      sortMockUsers(rows, "status", "desc").map((user) => user.id),
      ["disabled", "suspended", "active", "invited-a", "invited-z"],
    );
  });

  it("sorts created dates chronologically and uses database null placement for missing dates", async () => {
    const rows = [
      fixture("new", "active", { createdAt: "2026-03-01T00:00:00.000Z" }),
      fixture("missing-z", "active"),
      fixture("same-b", "active", { createdAt: "2026-02-01T00:00:00.000Z" }),
      fixture("old", "active", { createdAt: "2026-01-01T00:00:00.000Z" }),
      fixture("same-a", "active", { createdAt: "2026-02-01T00:00:00.000Z" }),
      fixture("missing-a", "active"),
    ];

    assert.deepEqual(
      sortMockUsers(rows, "createdAt", "asc").map((user) => user.id),
      ["old", "same-a", "same-b", "new", "missing-a", "missing-z"],
    );
    assert.deepEqual(
      sortMockUsers(rows, "createdAt", "desc").map((user) => user.id),
      ["missing-a", "missing-z", "new", "same-a", "same-b", "old"],
    );

    const created = await createMockApi().inviteUser(
      { role: "client_admin", tenantId: "TEN-00012", userId: "admin", name: "Admin" },
      {
        firstName: "New",
        lastName: "User",
        email: "new.user@example.test",
        preferredLanguage: "en",
        role: "operator",
      },
    );
    assert.ok(created.createdAt);
    assert.ok(Number.isFinite(Date.parse(created.createdAt)));
  });

  it("sorts nullable tenant relations like PostgreSQL in both directions", () => {
    const rows = [
      fixture("beta", "active", { tenantName: "Beta" }),
      fixture("null-z", "active", { tenantId: null, tenantName: null }),
      fixture("alpha-b", "active", { tenantName: "Alpha" }),
      fixture("alpha-a", "active", { tenantName: "Alpha" }),
      fixture("null-a", "active", { tenantId: null }),
    ];

    assert.deepEqual(
      sortMockUsers(rows, "tenantName", "asc").map((user) => user.id),
      ["alpha-a", "alpha-b", "beta", "null-a", "null-z"],
    );
    assert.deepEqual(
      sortMockUsers(rows, "tenantName", "desc").map((user) => user.id),
      ["null-a", "null-z", "beta", "alpha-a", "alpha-b"],
    );
  });

  it("offers only backend-supported user status transitions", () => {
    assert.deepEqual(availableUserStatusTransitions("invited"), [
      "active",
      "suspended",
      "disabled",
    ]);
    assert.deepEqual(availableUserStatusTransitions("active"), ["suspended", "disabled"]);
    assert.deepEqual(availableUserStatusTransitions("suspended"), ["active", "disabled"]);
    assert.deepEqual(availableUserStatusTransitions("disabled"), ["active"]);
    assert.deepEqual(availableUserStatusTransitions("pending_activation"), []);
  });

  it("maps conflicts and failures to safe localized message keys", () => {
    const conflict = new ApiError({
      statusCode: 409,
      message: "Database detail: email_normalized",
    });
    assert.equal(userMutationErrorMessage(conflict, "create"), "users.duplicateEmail");
    assert.equal(userMutationErrorMessage(conflict, "status"), "users.transitionRejected");
    assert.equal(userMutationErrorMessage(conflict, "role"), "users.roleRejected");
    assert.equal(
      userMutationErrorMessage(
        new ApiError({ statusCode: 403, message: "private detail" }),
        "profile",
      ),
      "users.accessDenied",
    );
    assert.equal(
      userMutationErrorMessage(new Error("private detail"), "create"),
      "users.createError",
    );
  });
});

function fixture(
  id: string,
  status: PortalUser["status"],
  overrides: Partial<PortalUser> = {},
): PortalUser {
  return {
    id,
    tenantId: "tenant-1",
    name: `Name ${id}`,
    firstName: "Name",
    lastName: id,
    email: `${id}@example.test`,
    role: "operator",
    status,
    ...overrides,
  };
}
