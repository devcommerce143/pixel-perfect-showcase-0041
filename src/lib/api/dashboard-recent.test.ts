import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recentDashboardMessagesSource } from "./dashboard-recent.ts";

describe("dashboard recent message source", () => {
  it("keeps mock mode on the existing message list", () => {
    assert.equal(recentDashboardMessagesSource("mock"), "mock-list");
    assert.equal(recentDashboardMessagesSource("live"), "live-endpoint");
  });
});
