import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./http/errors.ts";
import { tenantStatusErrorMessage } from "./tenant-status-error.ts";

describe("tenant status error messages", () => {
  it("maps validation, permission, missing-tenant, and conflict errors", () => {
    assert.equal(tenantStatusErrorMessage(new ApiError({ statusCode: 400, message: "Rejected" })), "ten.statusRejected");
    assert.equal(tenantStatusErrorMessage(new ApiError({ statusCode: 403, message: "Forbidden" })), "ten.statusForbidden");
    assert.equal(tenantStatusErrorMessage(new ApiError({ statusCode: 404, message: "Missing" })), "ten.statusNotFound");
    assert.equal(tenantStatusErrorMessage(new ApiError({ statusCode: 409, message: "Conflict" })), "ten.statusConflict");
  });

  it("uses a generic safe message for network and unexpected errors", () => {
    assert.equal(tenantStatusErrorMessage(new ApiError({ statusCode: 500, message: "Internal" })), "ten.statusError");
    assert.equal(tenantStatusErrorMessage(new Error("Network error")), "ten.statusError");
  });
});
