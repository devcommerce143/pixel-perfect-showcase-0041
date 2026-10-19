import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./http/errors.ts";
import { tenantProfileErrorMessage } from "./tenant-profile-error.ts";

describe("tenant profile error messages", () => {
  it("maps validation, permission, missing-tenant, and conflict errors", () => {
    assert.equal(tenantProfileErrorMessage(new ApiError({ statusCode: 400, message: "Invalid" })), "ten.profileRejected");
    assert.equal(tenantProfileErrorMessage(new ApiError({ statusCode: 403, message: "Forbidden" })), "ten.profileForbidden");
    assert.equal(tenantProfileErrorMessage(new ApiError({ statusCode: 404, message: "Missing" })), "ten.profileNotFound");
    assert.equal(tenantProfileErrorMessage(new ApiError({ statusCode: 409, message: "Conflict" })), "ten.profileConflict");
  });

  it("uses a generic safe message for network and unexpected errors", () => {
    assert.equal(tenantProfileErrorMessage(new ApiError({ statusCode: 500, message: "Internal" })), "ten.profileError");
    assert.equal(tenantProfileErrorMessage(new Error("Network error")), "ten.profileError");
  });
});
