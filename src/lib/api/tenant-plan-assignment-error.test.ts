import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./http/errors.ts";
import { tenantPlanAssignmentErrorMessage } from "./tenant-plan-assignment-error.ts";

describe("tenant plan assignment error messages", () => {
  it("maps validation, authorization, not-found, conflict, and entitlement errors", () => {
    assert.equal(tenantPlanAssignmentErrorMessage(new ApiError({ statusCode: 400, message: "Rejected" })), "ten.assignmentRejected");
    assert.equal(tenantPlanAssignmentErrorMessage(new ApiError({ statusCode: 403, message: "Forbidden" })), "ten.assignmentForbidden");
    assert.equal(tenantPlanAssignmentErrorMessage(new ApiError({ statusCode: 404, message: "Missing" })), "ten.assignmentNotFound");
    assert.equal(tenantPlanAssignmentErrorMessage(new ApiError({ statusCode: 409, message: "Conflict" })), "ten.assignmentConflict");
    assert.equal(tenantPlanAssignmentErrorMessage(new ApiError({ statusCode: 422, message: "Invalid entitlement" })), "ten.assignmentEntitlement");
  });

  it("uses a safe generic message for other failures", () => {
    assert.equal(tenantPlanAssignmentErrorMessage(new ApiError({ statusCode: 503, message: "Internal details" })), "ten.assignmentError");
    assert.equal(tenantPlanAssignmentErrorMessage(new Error("Network error")), "ten.assignmentError");
  });
});
