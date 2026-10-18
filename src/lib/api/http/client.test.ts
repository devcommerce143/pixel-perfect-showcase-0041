import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHumanHttpClient } from "./client.ts";
import { ApiError } from "./errors.ts";
import { createUnconnectedLiveApi } from "./unconnected-api.ts";

const base = "https://engine.example/api/v1";
const token = "test-access-token";

function jsonResponse(status: number, body: string) {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

describe("human HTTP client", () => {
  it("attaches a bearer token and parses JSON", async () => {
    const seen: Array<{ url: string; authorization: string | null }> = [];
    const logs: unknown[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args);
    };
    try {
      const client = createHumanHttpClient({
        apiBaseUrl: base,
        getAccessToken: () => token,
        fetchImpl: async (input, init) => {
          const headers = new Headers(init?.headers);
          seen.push({ url: String(input), authorization: headers.get("Authorization") });
          return jsonResponse(200, JSON.stringify({ userId: "user-1", role: "VIEWER" }));
        },
      });
      const body = await client.get<{ userId: string }>("/auth/me");
      assert.deepEqual(body, { userId: "user-1", role: "VIEWER" });
      assert.deepEqual(seen, [
        { url: "https://engine.example/api/v1/auth/me", authorization: `Bearer ${token}` },
      ]);
      assert.equal(JSON.stringify(logs).includes(token), false);
    } finally {
      console.log = original;
    }
  });

  it("does not call the network without an access token", async () => {
    let calls = 0;
    const client = createHumanHttpClient({
      apiBaseUrl: base,
      getAccessToken: () => null,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(200, "{}");
      },
    });
    await assert.rejects(
      () => client.get("/auth/me"),
      (error: unknown) => error instanceof ApiError && error.statusCode === 401,
    );
    assert.equal(calls, 0);
  });

  it("keeps array messages, status, and correlation id", async () => {
    const client = createHumanHttpClient({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () =>
        jsonResponse(
          400,
          JSON.stringify({
            statusCode: 400,
            error: "Bad Request",
            message: ["channel is required", "template is required"],
            path: "/api/v1/auth/me",
            timestamp: "2026-10-15T00:00:00.000Z",
            correlationId: "corr-1",
          }),
        ),
    });
    await assert.rejects(
      () => client.get("/auth/me"),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.correlationId, "corr-1");
        assert.deepEqual(error.details, ["channel is required", "template is required"]);
        assert.equal(error.message, "channel is required template is required");
        return true;
      },
    );
  });

  it("handles empty and non-JSON error bodies without a second request", async () => {
    let calls = 0;
    const client = createHumanHttpClient({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => {
        calls += 1;
        return new Response(calls === 1 ? "" : "<html>secret</html>", {
          status: calls === 1 ? 502 : 500,
        });
      },
    });
    await assert.rejects(
      () => client.get("/auth/me"),
      (error: unknown) =>
        error instanceof ApiError && error.statusCode === 502 && error.correlationId === null,
    );
    await assert.rejects(
      () => client.get("/auth/me"),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.statusCode, 500);
        assert.equal(error.message, "The server returned a non-JSON error response.");
        assert.equal(error.message.includes("secret"), false);
        return true;
      },
    );
    assert.equal(calls, 2);
  });

  it("passes the abort signal through", async () => {
    const controller = new AbortController();
    let received: AbortSignal | null = null;
    const client = createHumanHttpClient({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (_input, init) => {
        received = init?.signal ?? null;
        return jsonResponse(200, "{}");
      },
    });
    await client.get("/auth/me", { signal: controller.signal });
    assert.equal(received, controller.signal);
  });

  it("leaves business operations unconnected in live mode", async () => {
    const api = createUnconnectedLiveApi();
    await assert.rejects(
      () => api.getDashboard(),
      (error: unknown) => {
        assert.equal(error instanceof Error && error.name, "LiveApiNotConnectedError");
        return true;
      },
    );
  });
});
