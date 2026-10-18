import type { DolfConnectApi } from "../client.ts";
import { createHumanHttpClient } from "./client.ts";
import { mapDashboardMessages } from "./dashboard-messages-mapper.ts";
import { mapDashboardQuota } from "./dashboard-quota-mapper.ts";
import { mapDashboardSummary } from "./dashboard-mapper.ts";
import { mapPlanPage } from "./plan-mapper.ts";
import { createUnconnectedLiveApi } from "./unconnected-api.ts";
import { planListPath } from "../plans-catalog.ts";
import type { PlanListQuery } from "../types.ts";

/**
 * Live portal API. Dashboard reads and `listPlans` call the engine.
 * Every other operation still rejects with `LiveApiNotConnectedError`.
 * The request uses the shared human client, which attaches the current Bearer access token.
 */
export function createLiveApi(options: {
  apiBaseUrl: string | null;
  getAccessToken: () => string | null;
  fetchImpl?: typeof fetch;
}): DolfConnectApi {
  const unavailable = createUnconnectedLiveApi();
  if (!options.apiBaseUrl) return unavailable;

  const http = createHumanHttpClient({
    apiBaseUrl: options.apiBaseUrl,
    getAccessToken: options.getAccessToken,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  return new Proxy(unavailable, {
    get(target, property, receiver) {
      if (property === "getDashboard") {
        return async () => mapDashboardSummary(await http.get("/dashboard"));
      }
      if (property === "getDashboardMessages") {
        return async () => mapDashboardMessages(await http.get("/dashboard/messages"));
      }
      if (property === "getDashboardQuota") {
        return async () => mapDashboardQuota(await http.get("/dashboard/quota"));
      }
      if (property === "listPlans") {
        return async (query?: PlanListQuery) => mapPlanPage(await http.get(planListPath(query)));
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
