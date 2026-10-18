/**
 * Backend payload from `GET /api/v1/dashboard/quota`.
 * Warning bands stay in the engine vocabulary.
 */

export interface BackendQuotaUsageReading {
  committed: number;
  reserved: number;
  used: number;
  ceiling: number | null;
  band: string;
  overage: number | null;
}

export interface BackendQuotaChannelWarning extends BackendQuotaUsageReading {
  channel: string;
  enabled: boolean;
}

export interface BackendTenantQuotaWarning {
  scope: "tenant";
  tenantId: string;
  periodStart: string;
  configured: boolean;
  policy: string | null;
  policySource: string | null;
  aggregate: BackendQuotaUsageReading;
  channels: BackendQuotaChannelWarning[];
}

export interface BackendPlatformQuotaWarning {
  scope: "platform";
  tenantId: null;
  periodStart: string;
  counts: {
    atOrAbove80: number;
    atOrAbove90: number;
    atOrAbove100: number;
    unconfigured: number;
  };
}
