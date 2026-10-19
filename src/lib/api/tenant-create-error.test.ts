import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./http/errors.ts";
import { tenantCreateErrorMessage } from "./tenant-create-error.ts";

describe("tenant create error messages", () => {
  it("maps HTTP 400 to invalid submitted tenant or administrator information", () => {
    assert.equal(tenantCreateErrorMessage(new ApiError({ statusCode: 400, message: "Invalid" })), "ten.createRejected");
  });

  it("maps HTTP 403 to an authorization message", () => {
    assert.equal(tenantCreateErrorMessage(new ApiError({ statusCode: 403, message: "Forbidden" })), "ten.createForbidden");
  });

  it("uses generic conflict feedback for duplicate conflicts without a stable duplicate code", () => {
    assert.equal(
      tenantCreateErrorMessage(new ApiError({
        statusCode: 409,
        errorName: "Conflict",
        message: "Tenant code is already in use",
      })),
      "ten.createConflict",
    );
  });

  it("uses generic conflict feedback for invalid timezone or state conflicts", () => {
    assert.equal(
      tenantCreateErrorMessage(new ApiError({
        statusCode: 409,
        errorName: "Conflict",
        message: "Timezone is not valid",
      })),
      "ten.createConflict",
    );
  });

  it("uses generic conflict feedback when a 409 cannot be classified", () => {
    assert.equal(
      tenantCreateErrorMessage(new ApiError({ statusCode: 409, message: "Conflict" })),
      "ten.createConflict",
    );
  });

  it("uses the generic message for network, unexpected server, and other errors", () => {
    assert.equal(tenantCreateErrorMessage(new ApiError({ statusCode: 502, message: "Gateway failure" })), "ten.createError");
    assert.equal(tenantCreateErrorMessage(new Error("Network failure")), "ten.createError");
    assert.equal(tenantCreateErrorMessage("unexpected"), "ten.createError");
  });
});
