import type { QuotaUsageReading } from "./types.ts";

/** Null means no configured ceiling, never an invented unlimited allowance. */
export function quotaPresentation(reading: QuotaUsageReading) {
  return {
    remaining: reading.ceiling === null ? null : Math.max(0, reading.ceiling - reading.used),
    percentage:
      reading.ceiling !== null && reading.ceiling > 0
        ? (reading.used / reading.ceiling) * 100
        : null,
  };
}

export function quotaPeriodEnd(periodStart: string): string {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString();
}
