import type { ApiMode } from "../config/runtime";
import type { SenderIdentityActor } from "./types";

export function applicationMutationControlsEnabled(mode: ApiMode): boolean {
  return mode === "mock";
}

export function applicationScopeKey(
  actor: SenderIdentityActor,
  selectedTenantId?: string,
): string {
  return actor.role === "super_admin"
    ? selectedTenantId || "all-tenants"
    : `tenant:${actor.tenantId ?? "unknown"}`;
}

export function applicationSelectionMatchesScope(
  applicationTenantId: string,
  selectionScopeKey: string | null,
  currentScopeKey: string,
  isPlatform: boolean,
): boolean {
  return selectionScopeKey === currentScopeKey &&
    (!isPlatform ||
      currentScopeKey === "all-tenants" ||
      applicationTenantId === currentScopeKey);
}

export function applicationDetailTenantId(
  isPlatform: boolean,
  selectedTenantId: string | undefined,
  applicationTenantId: string | undefined,
): string | undefined {
  if (!isPlatform) return undefined;
  return selectedTenantId || applicationTenantId;
}
