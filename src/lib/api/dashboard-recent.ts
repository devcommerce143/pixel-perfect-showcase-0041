/** Mock recent messages stay on the local list. Live mode uses the dashboard endpoint. */
export function recentDashboardMessagesSource(mode: "mock" | "live"): "mock-list" | "live-endpoint" {
  return mode === "live" ? "live-endpoint" : "mock-list";
}
