import { LiveApiNotConnectedError } from "./http/errors.ts";

/** True only when the dashboard query failed because live business data is not connected. */
export function isLiveDashboardUnavailable(error: unknown): boolean {
  return error instanceof LiveApiNotConnectedError;
}
