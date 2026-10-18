import { buildApiUrl } from "../../config/runtime.ts";
import { ApiError, parseApiError } from "./errors.ts";

export interface HumanRequest {
  signal?: AbortSignal;
}

export interface HumanHttpClient {
  get<T>(path: string, request?: HumanRequest): Promise<T>;
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
    async get<T>(path: string, request?: HumanRequest): Promise<T> {
      const token = options.getAccessToken();
      if (!token) {
        throw new ApiError({ statusCode: 401, message: "Not authenticated." });
      }

      const init: RequestInit = {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      };
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
    },
  };
}
