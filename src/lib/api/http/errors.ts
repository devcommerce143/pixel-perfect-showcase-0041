export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorName: string | null;
  readonly path: string | null;
  readonly timestamp: string | null;
  readonly correlationId: string | null;
  readonly details: string[];

  constructor(init: {
    statusCode: number;
    message: string;
    errorName?: string | null;
    path?: string | null;
    timestamp?: string | null;
    correlationId?: string | null;
    details?: string[];
  }) {
    super(init.message);
    this.name = "ApiError";
    this.statusCode = init.statusCode;
    this.errorName = init.errorName ?? null;
    this.path = init.path ?? null;
    this.timestamp = init.timestamp ?? null;
    this.correlationId = init.correlationId ?? null;
    this.details = init.details ?? [];
  }
}

export class LiveApiNotConnectedError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(
      `Live mode is not connected for ${operation}. Business screens stay unavailable in this phase.`,
    );
    this.name = "LiveApiNotConnectedError";
    this.operation = operation;
  }
}

export function parseApiError(statusCode: number, body: string): ApiError {
  const trimmed = body.trim();
  if (!trimmed) {
    return new ApiError({ statusCode, message: "The server returned an empty error response." });
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) {
      return new ApiError({
        statusCode,
        message: "The server returned a non-JSON error response.",
      });
    }
    const details = readMessages(parsed["message"]);
    const message = details.length > 0 ? details.join(" ") : "The request was rejected.";
    return new ApiError({
      statusCode: typeof parsed["statusCode"] === "number" ? parsed["statusCode"] : statusCode,
      message,
      errorName: typeof parsed["error"] === "string" ? parsed["error"] : null,
      path: typeof parsed["path"] === "string" ? parsed["path"] : null,
      timestamp: typeof parsed["timestamp"] === "string" ? parsed["timestamp"] : null,
      correlationId: typeof parsed["correlationId"] === "string" ? parsed["correlationId"] : null,
      details,
    });
  } catch {
    return new ApiError({ statusCode, message: "The server returned a non-JSON error response." });
  }
}

function readMessages(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
