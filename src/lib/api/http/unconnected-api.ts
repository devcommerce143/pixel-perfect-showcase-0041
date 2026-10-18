import type { DolfConnectApi } from "../client.ts";
import { LiveApiNotConnectedError } from "./errors.ts";

/** Live business operations are intentionally unavailable until a later phase. */
export function createUnconnectedLiveApi(): DolfConnectApi {
  return new Proxy({} as DolfConnectApi, {
    get(_target, property) {
      if (property === "then") return undefined;
      return () => Promise.reject(new LiveApiNotConnectedError(String(property)));
    },
  });
}
