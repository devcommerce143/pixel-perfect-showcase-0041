import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLiveDashboardUnavailable } from "./dashboard-availability.ts";
import { DashboardResponseError } from "./http/dashboard-mapper.ts";
import { ApiError, LiveApiNotConnectedError } from "./http/errors.ts";

describe("dashboard availability", () => {
  it("treats only the unconnected live dashboard error as unavailable data", () => {
    assert.equal(isLiveDashboardUnavailable(new LiveApiNotConnectedError("getDashboard")), true);
  });

  it("does not hide authentication, authorization, or other failures", () => {
    assert.equal(
      isLiveDashboardUnavailable(new ApiError({ statusCode: 401, message: "Unauthorized" })),
      false,
    );
    assert.equal(
      isLiveDashboardUnavailable(new ApiError({ statusCode: 403, message: "Forbidden" })),
      false,
    );
    assert.equal(
      isLiveDashboardUnavailable(new ApiError({ statusCode: 500, message: "Unavailable" })),
      false,
    );
    assert.equal(isLiveDashboardUnavailable(new TypeError("network")), false);
    assert.equal(isLiveDashboardUnavailable(new Error("LiveApiNotConnectedError")), false);
    assert.equal(isLiveDashboardUnavailable(new DashboardResponseError("Dashboard response must be an object.")), false);
  });
});
