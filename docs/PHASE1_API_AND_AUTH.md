# Phase 1 — API mode, HTTP client, and organization sign-in

This phase connects the portal’s authentication foundation to Dolf Connect Engine later. It does not connect business screens, and it does not send messages.

## Mode

`VITE_API_MODE` accepts `mock` or `live`.

- Local development defaults to `mock` when the variable is unset.
- A production build rejects `mock` and rejects an unset mode. It does not serve the demo portal.
- An unknown value such as `staging` is a configuration error. It is not treated as mock.
- Live mode with missing API or OIDC settings is a configuration error. A failed live request or a failed sign-in never switches the portal back to mock data.

Mock mode keeps the existing demo password session and in-memory API. The banner says the session is simulated. Demo accounts are loaded only in mock mode.

Live mode shows an organization sign-in button. The password form is not used. Business screens still call the existing API interface, but that interface rejects every operation with `LiveApiNotConnectedError`. A banner says business screens are not connected. That rejection is intentional for this phase.

## Public configuration

Copy `.env.example` to `.env.local`. Vite exposes only `VITE_` variables to the browser, so none of these may contain a client secret or any other secret.

| Variable                             | Required in live mode | Purpose                                                                                                                                        |
| ------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_MODE`                      | Yes                   | `live`                                                                                                                                         |
| `VITE_API_BASE_URL`                  | Yes                   | Engine origin, or an origin that already ends in `/api/v1`. The client normalizes it to one `/api/v1` base. Embedded credentials are rejected. |
| `VITE_OIDC_ISSUER`                   | Yes                   | Keycloak realm issuer URL                                                                                                                      |
| `VITE_OIDC_CLIENT_ID`                | Yes                   | Public client id                                                                                                                               |
| `VITE_OIDC_REDIRECT_URI`             | Yes                   | Absolute callback URL registered for this client. The portal route is `/auth/callback`.                                                        |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | Yes                   | Absolute URL registered as a post-logout redirect                                                                                              |
| `VITE_OIDC_SILENT_REDIRECT_URI`      | No                    | Absolute silent-renewal URL. Renewal stays disabled when this is empty.                                                                        |

The Keycloak client must allow Authorization Code with PKCE and must not use a browser client secret. The redirect and logout URLs must be supplied by the environment owner. This repository does not contain production hosts or credentials.

## Authentication flow

1. The user chooses organization sign-in. The portal stores only a same-origin return path in `sessionStorage` under `dc.oidcReturnTo`.
2. `oidc-client-ts` starts Authorization Code with PKCE (`response_type=code`, scope `openid`). No client secret is configured.
3. Keycloak redirects to `/auth/callback` with the authorization code. The library exchanges that code, then the portal replaces the callback URL.
4. The portal calls `GET /api/v1/auth/me` with `Authorization: Bearer <access token>`.
5. The returned profile is the only source of portal role and tenant in live mode. Browser-supplied role or tenant values are not authorization.

Role mapping:

| Engine role            | Portal role    |
| ---------------------- | -------------- |
| `PLATFORM_SUPER_ADMIN` | `super_admin`  |
| `CLIENT_ADMIN`         | `client_admin` |
| `OPERATOR`             | `operator`     |
| `VIEWER`               | `viewer`       |

A platform administrator’s session tenant is always empty, even if the profile includes a tenant id. The existing platform tenant selector remains a view filter. Tenant roles require a non-empty `tenantId`. Unknown roles, malformed profiles, and blocked statuses do not grant access and do not fall back to a demo user.

Blocked statuses are a portal policy because the engine documents `status` only as a string: `disabled`, `inactive`, `suspended`, `revoked`, `locked`, and `deleted`, compared case-insensitively. Any other non-empty status is accepted.

`auth/me` does not return a display name, email, or tenant name. Live sessions show the user id and leave the email and tenant name empty.

## HTTP client

`createHumanHttpClient` is the human client. It sends GET requests only, with `Accept: application/json` and a bearer token. There is no POST method, so a human token cannot be attached to message submission. Machine Basic credentials are a separate future client.

Errors use the engine shape when the body is JSON. `message` may be a string or an array of strings. Empty and non-JSON bodies become a safe `ApiError` that keeps the HTTP status and the correlation id when the id is present. The client does not retry, and it does not log tokens, authorization headers, or response bodies.

The access token used by the client is held in memory. `oidc-client-ts` also stores the OIDC user in `sessionStorage` so the sign-in redirect can finish in the same tab. The portal does not copy tokens to `localStorage` or put them in its own storage keys. `sessionStorage` is still readable by script running on the portal origin. Library logging is set to none.

A 401 clears the OIDC user after one silent renewal attempt. Silent renewal runs only when `VITE_OIDC_SILENT_REDIRECT_URI` is set; otherwise the user must sign in again. A 403 is a permission denial and is not treated as success. Other profile failures show a retryable error and grant no role.

## Still required before a live environment

- Public Keycloak client settings and the six required variables above.
- A backend user record that `GET /api/v1/auth/me` can resolve for the signed-in Keycloak user.
- A later phase to connect read-only history, usage, subscription, and entitlements. No business screen uses the HTTP client yet.

Tests under `src/lib/**/*.test.ts` use Node’s test runner and do not contact Keycloak or the engine.
