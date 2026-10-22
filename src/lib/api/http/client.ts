import { buildApiUrl } from "../../config/runtime.ts";
import { ApiError, parseApiError } from "./errors.ts";

export interface HumanRequest {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export interface HumanHttpClient {
  getCsv(path: string, request?: HumanRequest): Promise<string>;
  get<T>(path: string, request?: HumanRequest): Promise<T>;
  post<T>(path: string, body: unknown, request?: HumanRequest): Promise<T>;
  patch<T>(path: string, body: unknown, request?: HumanRequest): Promise<T>;
  put<T>(path: string, body: unknown, request?: HumanRequest): Promise<T>;
  delete<T>(path: string, request?: HumanRequest): Promise<T>;
}

/**
 * Human portal client. It sends only a Bearer access token.
 * Machine Basic credentials and message submission belong to a different client.
 */
export function createHumanHttpClient(options: {
  apiBaseUrl: string;
  getAccessToken: () => string | null;
  fetchImpl?: typeof fetch;
}): HumanHttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    getCsv(path: string, request?: HumanRequest): Promise<string> {
      return send<string>("GET", path, undefined, request, "csv");
    },
    get<T>(path: string, request?: HumanRequest): Promise<T> {
      return send<T>("GET", path, undefined, request);
    },
    post<T>(path: string, body: unknown, request?: HumanRequest): Promise<T> {
      return send<T>("POST", path, body, request);
    },
    patch<T>(path: string, body: unknown, request?: HumanRequest): Promise<T> {
      return send<T>("PATCH", path, body, request);
    },
    put<T>(path: string, body: unknown, request?: HumanRequest): Promise<T> {
      return send<T>("PUT", path, body, request);
    },
    delete<T>(path: string, request?: HumanRequest): Promise<T> {
      return send<T>("DELETE", path, undefined, request);
    },
  };

  async function send<T>(
    method: string,
    path: string,
    body: unknown,
    request?: HumanRequest,
    format: "json" | "csv" = "json",
  ): Promise<T> {
    const token = options.getAccessToken();
    if (!token) {
      throw new ApiError({ statusCode: 401, message: "Not authenticated." });
    }

    const headers: Record<string, string> = {
      Accept: format === "csv" ? "text/csv" : "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (method !== "GET" && method !== "DELETE") headers["Content-Type"] = "application/json";
    if (request?.idempotencyKey !== undefined) {
      if (method !== "POST" || !/^[A-Za-z0-9._:-]{16,128}$/.test(request.idempotencyKey))
        throw new Error("Invalid idempotent human request");
      headers["Idempotency-Key"] = request.idempotencyKey;
    }
    const init: RequestInit = { method, headers };
    if (format === "csv" || request?.idempotencyKey !== undefined) init.cache = "no-store";
    if (method !== "GET" && method !== "DELETE") init.body = JSON.stringify(body);
    if (request?.signal) init.signal = request.signal;
    const response = await fetchImpl(buildApiUrl(options.apiBaseUrl, path), init);

    const text = await response.text();
    if (!response.ok) throw parseApiError(response.status, text);
    if (format === "csv") {
      if (!/^text\/csv(?:;|$)/i.test(response.headers.get("content-type") ?? ""))
        throw new ApiError({
          statusCode: response.status,
          message: "The server returned an invalid CSV response.",
        });
      return text as T;
    }
    if (!text.trim()) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError({
        statusCode: response.status,
        message: "The server returned a non-JSON response.",
      });
    }
  }
}
