import { buildApiUrl } from "../../config/runtime.ts";
import { ApiError, parseApiError } from "./errors.ts";

export interface HumanRequest {
  signal?: AbortSignal;
}

export interface HumanHttpClient {
  get<T>(path: string, request?: HumanRequest): Promise<T>;
  post<T>(path: string, body: unknown, request?: HumanRequest): Promise<T>;
  patch<T>(path: string, body: unknown, request?: HumanRequest): Promise<T>;
  put<T>(path: string, body: unknown, request?: HumanRequest): Promise<T>;
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
  };

  async function send<T>(
    method: string,
    path: string,
    body: unknown,
    request?: HumanRequest,
  ): Promise<T> {
    const token = options.getAccessToken();
    if (!token) {
      throw new ApiError({ statusCode: 401, message: "Not authenticated." });
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (method !== "GET") headers["Content-Type"] = "application/json";
    const init: RequestInit = { method, headers };
    if (method !== "GET") init.body = JSON.stringify(body);
    if (request?.signal) init.signal = request.signal;
    const response = await fetchImpl(buildApiUrl(options.apiBaseUrl, path), init);

    const text = await response.text();
    if (!response.ok) throw parseApiError(response.status, text);
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
