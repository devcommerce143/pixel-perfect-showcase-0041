# Dolf Connect frontend-to-backend contract map

This document compares the portal in this repository with the verified Dolf Connect Engine contracts supplied for this audit. It is an integration plan only. No application code was changed to produce it.

The engine repository was not opened, edited, or run. Where the verified contract names a path but does not specify the HTTP method, request body, or response body, this document says so. It does not invent those fields. Backend validation rejects unknown DTO fields, so the portal’s mock types must not be sent as-is.

Base prefix for every path below: `/api/v1`.

## Executive summary

The portal has no HTTP client. `src/lib/api/client.ts` binds `api` to `createMockApi()`. Every screen reads and writes in-memory demo data. A success toast means the mock resolved, not that the engine accepted the operation. Reloading the page discards those writes.

Human portal calls must use `Authorization: Bearer <Keycloak access token>`. The engine has no login or token-exchange route. `GET /api/v1/auth/me` returns `{ userId, role, tenantId, status }`. Machine calls use HTTP Basic application credentials and must not be used for ordinary portal requests. `POST /api/v1/messages` is a machine route and is not a portal send API.

No portal screen can be connected by swapping the mock for these endpoints without an adapter. Role names differ, tenant scope is chosen in the browser today, and mock DTOs are not verified engine DTOs. Keycloak itself has not been verified against a live instance.

Safe first work is the HTTP client, Keycloak Authorization Code + PKCE, `GET /api/v1/auth/me`, and read-only history, usage, subscription, and entitlements. Message submit, bulk materialization, provider probes, webhook delivery, audit, reports, channel catalog, and provider-account listing must stay mocked, disabled, or marked unavailable.

Mock mode can remain for local UI work only behind an explicit development switch. A production build must not be able to report mock success as an API success.

## Screen-to-endpoint mapping

Frontend permissions are UI visibility only. The engine remains authoritative. “Backend role” is the portal permission translated to the engine role name. Per-route role enforcement was not included in the verified contract, so the table does not claim the engine allows that role to call the path.

Authentication modes:

- **Bearer** — human Keycloak access token.
- **Basic** — application credential. Not for normal portal requests.
- **Unspecified** — the verified contract did not state the authentication mode.

| Screen / operation | Frontend | Endpoint | Auth | Classification |
|---|---|---|---|---|
| Sign-in | `src/routes/login.tsx` → `authService.signIn` | No portal login or token-exchange route | n/a | Backend API missing. Keycloak must issue the token in the browser. |
| Session restore / current user | `SessionProvider` in `src/lib/auth/session.tsx` | `GET /api/v1/auth/me` | Bearer | Adapter required. Keycloak configuration unverified. |
| Sign-out | `authService.signOut` | No engine logout route was named | n/a | Frontend work. Clear the Keycloak session locally. Do not call a fictional token endpoint. |
| Forgot password | Local text in `login.tsx` | None named | n/a | Backend API missing. Keep the current non-sending notice. |
| Dashboard KPIs, trend, channel split | `getDashboard()` in `src/routes/index.tsx` | No dashboard aggregate route was named. Related reads: message history, usage, subscription, entitlements, health | Bearer for those reads | Adapter required for any composition. Do not send the mock dashboard DTO. |
| Dashboard export button | `src/routes/index.tsx` (no click handler) | No report-export route | n/a | Backend API missing. The button currently does nothing. |
| Dashboard quota when no tenant is selected | Hardcoded `410_120 / 500_000` and delta `6.4` inside `getDashboard()` | `GET /api/v1/usage` is tenant-scoped in the verified contract, not a platform rollup | Bearer | Mock-only until a platform usage contract is documented. |
| Message history | `listMessages` → `src/routes/messages.index.tsx` | `GET /api/v1/message-history` | Bearer | Adapter required. Query parameter names were not supplied. |
| Message history CSV | Browser export in `messages.index.tsx` | No export route | n/a | Backend API missing. Keep client export off live data until an export contract exists, or limit it to the page already returned. |
| Message detail | `getMessage` → `src/routes/messages.$messageId.tsx` | `GET /api/v1/message-history/:messageId` | Bearer | Adapter required. Attempts, routing, and failure objects are frontend-only unless a documented response includes them. |
| Send message | `sendMessage` → `src/routes/messages.send.tsx` | `POST /api/v1/messages` | **Basic, not Bearer** | Dormant and the wrong authentication mode for the portal. Do not wire this screen to the human token. |
| Bulk job list | `listBulkJobs` → `src/routes/messages.bulk.tsx` | No bulk-job listing route | n/a | Backend API missing. |
| Bulk job detail | `getBulkJob` | Not named. Listing is absent. | n/a | Backend API missing for the list/detail UI as it exists. |
| Bulk create / CSV intake | `createBulkJob` | `/api/v1/bulk-jobs` (method and body not specified in this contract) | Unspecified | Feature area exists; materialization is dormant. Do not activate it. |
| Bulk suppression check | `checkBulkSuppression` always returns `[]` | No suppression route was named | n/a | Mock-only. |
| Templates list | `listTemplates` → `src/routes/templates.tsx` | `/api/v1/templates` (method and query not specified) | Bearer expected for portal; exact mode unspecified | Adapter required. |
| Template create, SMS or email | `createTemplate` | Creation currently supports WhatsApp templates only | Unspecified | Backend capability missing for SMS and email creation. |
| Template create, WhatsApp | `createTemplate` | `/api/v1/templates` | Unspecified | Adapter required. Frontend also sends category, language, subject, and body variables. Unknown fields will be rejected. |
| Template update, submit, activate, deactivate | `updateTemplate`, `submitTemplateForApproval`, `activateTemplate`, `deactivateTemplate` | Not named beyond the templates collection | Unspecified | Do not assume these verbs exist. |
| Applications list and detail | `listApplications` / `listApplicationsPage` → `src/routes/applications.tsx` | `/api/v1/applications` | Unspecified; portal must use Bearer if this is a human route | Adapter required. |
| Application create, update, enable/disable | `createApplication`, `updateApplication`, `setApplicationStatus` | Same collection. Methods not specified. | Unspecified | Adapter required. Do not send `tenantName`, `credentialCount`, or `lastActivityAt`. |
| Credential list | `listCredentials` → `src/routes/credentials.tsx` | `/api/v1/applications/:applicationId/credentials` | Unspecified | Adapter required. The frontend list is global and filtered by optional `applicationId`. The engine path is nested under one application. |
| Credential create / rotate | `createCredential`, `rotateCredential` return a one-time secret | Nested credentials path. Methods not specified. | Unspecified | Adapter required. Secret must be shown once and never stored in the portal. |
| Credential revoke | `revokeCredential` | Not individually named | Unspecified | Confirm the verb before wiring. The mock accepts a reason and ignores it. |
| Usage screen | `getUsage` → `src/routes/usage.tsx` | `GET /api/v1/usage`, `GET /api/v1/subscription`, `GET /api/v1/entitlements` | Bearer | Adapter required. One frontend `UsageSummary` spans three reads. |
| Platform usage table across tenants | Same `getUsage` when no tenant is selected | No cross-tenant usage route was named | Bearer | Missing as a single call. Platform routes under `/api/v1/tenants/:tenantId/...` may exist where documented. Do not invent a rollup. |
| Subscription display | Embedded in tenant and usage models | `GET /api/v1/subscription` | Bearer | Adapter required. |
| Entitlements / quota policy / TPS | `resolveEntitlements` in the mock; plan and override forms | `GET /api/v1/entitlements` | Bearer | Adapter required. Frontend `hard_stop` / `soft_cap` behavior is display-only. |
| Audit log and CSV | `listAuditEvents` → `src/routes/audit.tsx` | No durable audit-query route | n/a | Backend API missing. |
| API documentation | `src/routes/docs.tsx` | Static copy. Sample `POST /v1/messages` does not match `POST /api/v1/messages` or `SendMessageInput`. | n/a | Docs are illustrative. Do not treat them as the contract. |
| Webhook list | `listWebhooks` → `src/routes/webhooks.tsx` | `/api/v1/applications/:applicationId/webhooks` | Unspecified | Adapter required. Frontend records have no `applicationId` or `tenantId`. |
| Webhook create, update, enable, delete | Matching `api` methods | Nested webhook path. Methods not specified. | Unspecified | Adapter required. |
| Webhook test delivery | `testWebhook` fabricates HTTP 200 | Delivery is dormant. No test-probe route was named. | n/a | Dormant. Do not show success from a local fake delivery. |
| Reports and CSV | `getReport` → `src/routes/reports.tsx` | No report-export route | n/a | Backend API missing. |
| Users list, invite, edit, enable/disable, resend | `src/routes/users.tsx` | `/api/v1/users` (methods and bodies not specified) | Unspecified; Bearer if human | Adapter required. Resend-invitation was not named. |
| Settings | `getSettings` / `updateSettings` → `src/routes/settings.tsx` | No settings route was named | n/a | Backend API missing. The mock object is global, not per tenant. |
| Sender identities, all lifecycle actions | `src/routes/sender-identities.tsx` | `/api/v1/senders` (methods not specified) | Unspecified | Adapter required. Email DNS status fields must not be sent unless documented. |
| Tenants list, create, edit, suspend | `src/routes/platform.tenants.tsx` | Platform routes `/api/v1/tenants/:tenantId/...` where documented. Exact suffixes were not supplied. | Bearer, platform only | Adapter required. Do not send browser tenant scope for tenant users. |
| Plans | `src/routes/platform.plans.tsx` | Not named | n/a | Backend API missing in the verified contract. |
| Channels | `src/routes/platform.channels.tsx` | No platform channel-catalog route | n/a | Backend API missing. |
| Providers list, create, update, enable | `src/routes/platform.providers.tsx` | No provider-account listing route | n/a | Backend API missing for the catalog UI. |
| Provider connection test | `testProviderConnection` | Health APIs read stored observations. They do not initiate probes. | Bearer if the health read is a human route; mode unspecified | Dormant / not a probe. A success toast would be false. |
| Provider usage and billing panel | `getProviderUsageBilling` | Not named | n/a | Backend API missing in the verified contract. Seed source is `development_sample`. |
| Provider health page | `src/routes/platform.health.tsx` | Provider health APIs exist. Paths not specified. | Unspecified | Adapter required for stored observations only. Do not add a live probe. |
| Routing rules | `src/routes/platform.routing.tsx` | Routing APIs exist. Paths not specified. | Unspecified | Adapter required. Routing and failover execution are dormant. Do not activate them. |
| Platform API clients | `src/routes/platform.api-clients.tsx` | Not named. This list is not the application-credentials resource. | n/a | Backend API missing until identified. Do not map it onto `/applications/:id/credentials` without a confirmed identity model. |
| System configuration | `src/routes/platform.config.tsx` | Not named | n/a | Backend API missing. |
| Header search | `AppHeader` input with no handler | None | n/a | UI placeholder. |
| Notification bell | Two fixed strings | None | n/a | Mock-only. Must not be presented as live alerts. |
| Connectivity check (no screen) | None | `GET /api/v1/health` | Unspecified | First wire-up candidate. Response fields were not supplied. |

### Frontend fields that must not be posted

These are computed, duplicated, or secret-display values on the current types in `src/lib/api/types.ts`. Sending them will fail validation if the engine DTO does not declare them.

- Names copied for display: `tenantName`, `applicationName`, `templateName`, `senderIdentityName`, `planName`, `planCode`.
- Counts and percents: `users`, `applications`, `messages30d`, `quotaPct`, `credentialCount`, `Plan.tenants`, channel `providers` / `tenants` / `senderIds` / `volume30d`.
- Secrets after the one-time reveal: credential `secret`, webhook `signingSecret`, provider secret fields. `keyPrefix` and `secretConfigured` are not a secret store.
- Effective entitlements and usage rows derived from `quotaPct`.
- `SenderIdentityActor` (`role`, `tenantId`, `userId`, `name`). The engine reads the token.

### Frontend request fields the screens collect

These are what the UI sends into the mock. They are not confirmed engine bodies.

| Operation | Fields the UI collects |
|---|---|
| Send | `channel`, `applicationId`, `senderIdentityId`, `recipient`, `templateId`, `subject`, `body`, `idempotencyKey` |
| Bulk create | `name`, `channel`, `applicationId`, `senderIdentityId`, `templateId`, `recipients`, `estimatedUsage`, `estimatedSegments`, `duplicates`, `suppressed`, `recipientRows`, `idempotencyKey` |
| Template write | `name`, `channel`, `category`, `language`, `subject`, `body` |
| Application write | `tenantId`, `name`, `environment`, `channels`, `scopes` |
| Credential create | `applicationId`, `scopes`, `environment`, `expiresAt`, `rateLimit` |
| Webhook write | `url`, `events`, `applicationName`; update may also carry `signingSecret` |
| User invite | English and Arabic names, `email`, `mobileNumber`, `jobTitle`, `department`, `preferredLanguage`, `role`, optional `tenantId` |
| Tenant upsert | `code`, `name`, `status`, `region`, `dataRegion`, `defaultLanguage`, `timezone`, `notes`, `planId`, `overrides`, `primaryAdministrator` |
| Sender write | Channel-specific identity fields in `SenderIdentityInput` |
| Provider write | `name`, `channel`, `environment`, `dataRegion`, `adapterConfig` including secrets |
| Routing write | Full `RoutingRule` except `id`. `primaryProvider` and `failoverProvider` are display names. |

`POST /api/v1/messages` additionally requires an idempotency key and machine Basic authentication. The portal generates a UUID and never sends a Basic credential. WhatsApp dispatch currently rejects non-empty parameter variables. The send and bulk screens require those variables to be filled.

## Authentication and role/tenant handling

### What the portal does today

- Development sign-in compares email and password to `DEVELOPMENT_ACCOUNTS` in `src/lib/auth/session.tsx`. The shared development password is in source. Outside `import.meta.env.DEV`, sign-in throws `mock_auth_development_only`.
- The stored session is a user id in `localStorage` or `sessionStorage` (`dc.mockSession`). There is no access token, refresh, or expiry.
- `api` is the mock in every build, including production. Only the auth service is disabled outside development.
- Roles in `src/lib/auth/permissions.ts` are `super_admin`, `client_admin`, `operator`, and `viewer`.
- Engine roles are `PLATFORM_SUPER_ADMIN`, `CLIENT_ADMIN`, `OPERATOR`, and `VIEWER`.
- `isPlatform` is `role === "super_admin"`. Tenant users are fixed to `session.user.tenantId`. Platform users pass `tenantId` in the URL via `useGlobalTenantContext()`.
- Almost every call also sends `SenderIdentityActor`. `src/lib/api/client.ts` says that object is mock-only. A real client must not send it as authority.
- `RequirePermission` and `getNavigation()` only hide UI.

### What the engine requires

- The browser obtains a Keycloak access token. The engine does not exchange or issue it.
- Portal requests send `Authorization: Bearer <access token>`.
- `GET /api/v1/auth/me` is the profile: `{ userId, role, tenantId, status }`. It has no `name`, `email`, or `tenantName`.
- Tenant users must not choose their effective tenant with a browser-supplied id. The token is the scope.
- Platform administration, where documented, uses `/api/v1/tenants/:tenantId/...`. That path is for platform operations, not a substitute for tenant-user scope.
- Machine Basic credentials stay off portal requests. `POST /api/v1/messages` is a machine route.

### Role map

| Portal role | Engine role | Notes |
|---|---|---|
| `super_admin` | `PLATFORM_SUPER_ADMIN` | Only this role may use documented `/tenants/:tenantId/...` paths. |
| `client_admin` | `CLIENT_ADMIN` | Tenant comes from the token. |
| `operator` | `OPERATOR` | Same tenant rule. |
| `viewer` | `VIEWER` | Same tenant rule. |

`auth/me.status` is not the portal’s user status enum (`active`, `invited`, `pending_activation`, `disabled`). Do not assume they match.

### Keycloak

Live Keycloak configuration is unverified. Do not contact Keycloak as part of implementation planning. The portal should keep mock sign-in only when mock mode is explicitly on. A live-mode build that cannot obtain a token must stop at the login screen and must not fall back to demo users.

## DTO and type mismatches

| Portal type or value | Engine fact | Risk |
|---|---|---|
| `SessionUser.id`, `name`, `email`, `tenantName` | `auth/me` returns `userId`, `role`, `tenantId`, `status` only | Adapter. Name and email are not in this response. |
| `super_admin` and lowercase roles | Uppercase engine role names | String compare will fail if values are copied through. |
| `ListParams.tenantId` and actor `tenantId` | Tenant users must not supply the effective tenant | Drop the field for tenant roles. Platform scope belongs in a documented path, not a shared query. |
| `Message` attempts, routing, failure, idempotency, segments, preview, `events` including `accepted` | Detail route exists; body was not supplied | Render only fields the history DTO actually returns. |
| Portal send returns `{ id, status: "accepted" }` while storing `queued` | `SUBMITTED` means provider/relay acceptance, not device delivery | Copy must say accepted for processing. `SUBMITTED` is not `delivered`. |
| Docs sample `POST /v1/messages` with `to`, `template`, `parameters` | `POST /api/v1/messages`, machine auth, idempotency key | Three different shapes. None of the portal shapes is confirmed. |
| `UsageSummary` with many tenants, plans, and renewal | Separate `usage`, `subscription`, and `entitlements` reads | Split the screen’s data loading. Do not post the summary. |
| Usage math from seeded `quotaPct` | Real usage route | Delete the derivation when live. |
| `TenantSubscriptionStatus` includes `pending` | Not confirmed | Do not send `pending` unless documented. |
| Template categories `Authentication`, `Transactional`, `Notification`, `Marketing` | Not confirmed | Likely rejected if sent and undeclared. |
| Routing categories `authentication`, `transactional`, `marketing` | Not confirmed, and different from template categories | Do not reuse one enum for the other. |
| WhatsApp billing categories `marketing`, `utility`, `authentication`, `service` | Not part of the verified portal contract | Provider billing UI has no named route. |
| Application `scopes` as a fixed string list | Not confirmed | Send only documented scope values. |
| Credential `environment`, `rateLimit`, `expiresAt: null` | Not confirmed. Unknown fields are rejected. | Map only after the credential DTO is confirmed. |
| Webhook `applicationName` | Path is `/applications/:applicationId/webhooks` | The portal must select an application id. |
| Webhook events include `message.sent`, `bulk_job.completed`, `template.status_changed` | Not confirmed | Send only documented event names. |
| Routing provider **names** | Not confirmed | A live rule must use the identifier the engine documents. |
| Provider adapter secrets in the create body | No provider-account listing route | Do not add a catalog client that posts secrets. |
| Error handling via `Error.message` substring checks (`email`, `code`, `code already`) | `{ statusCode, error, message, path, timestamp, correlationId }` | Map `statusCode` and `correlationId`. Do not parse English sentences. |
| Pagination `page` / `pageSize` and sort fields | Not confirmed on history or other lists | Confirm names before sending. History has a date-window limit in earlier engine notes; the exact query keys were not restated in this contract. |

`src/lib/api/types.ts` remains the mock/presentation contract. It should not be treated as the engine schema.

## Missing and dormant feature warnings

### Backend API missing

Do not add buttons that call these, and do not show success for them.

- Portal login, token exchange, and a named logout endpoint.
- Durable audit-log query and the audit CSV as a server export.
- Report aggregates and report export.
- Platform channel catalog.
- Provider-account listing and provider usage/billing.
- Bulk-job listing and the current bulk detail table as a list API.
- Plans, system configuration, tenant settings, and the platform API-client list, as named routes in this contract.
- SMS and email template creation. Template creation currently supports WhatsApp only.
- A human Bearer route for `POST /api/v1/messages`.

### Dormant or operationally incomplete

Routes or flags may exist. Do not activate them. Do not let the UI report success.

- Bulk materialization.
- Message dispatch.
- Provider routing and failover execution.
- Email and WhatsApp dispatch.
- Meta callbacks, so WhatsApp delivered/read status will not advance from those callbacks.
- Webhook delivery. The portal test action currently fabricates a 200 response.
- Provider health reads stored observations. It does not probe providers. The portal test button does the opposite: it invents latency and status.
- WhatsApp message dispatch rejects non-empty parameter variables. The send and bulk forms require variables.
- `SUBMITTED` is not confirmed delivery.
- APISIX, metrics, alerting, and HTTP rate limiting were previously described as incomplete. This contract does not add portal routes for them.

### Controls that imply unavailable functionality

| Control | Location | Why it misleads |
|---|---|---|
| Send success toast | `messages.send.tsx` | Mock returns `accepted` with no provider call. |
| Bulk completion after timers | `mock-api.ts` `createBulkJob` | Results are invented. Listing does not exist. |
| Webhook test toast | `webhooks.tsx` | Delivery is dormant. |
| Provider and health “test connection” | `platform.providers.tsx`, `platform.health.tsx` | Local success/failure from the enabled flag. |
| Dashboard export | `index.tsx` | No handler and no export API. |
| Notification bell | `AppHeader` | Fixed “quota” and “template approved” text. |
| Header search | `AppHeader` | Placeholder only. |
| Forgot password | `login.tsx` | Informational text only. This part is already honest. |
| Audit “immutable” copy and CSV | `audit.tsx` | No query API. The mock does not record most mutations. |
| Reports CSV | `reports.tsx` | Counts in-memory messages. |
| Settings MFA, IP allowlist, retention | `settings.tsx` | Stored on one global mock object and not enforced. |
| Quota `hard_stop` | Plans and usage UI | Sends are not blocked. |

## Recommended implementation sequence

Keep the current screens, routes, translations, and RTL layout. Add a live client beside the mock. Do not replace `DolfConnectApi` by posting mock types.

### 1. HTTP client and mock switch

- Add one client that prefixes `/api/v1`, sends JSON, and attaches `Authorization: Bearer` only in live mode.
- Parse the error object `{ statusCode, error, message, path, timestamp, correlationId }`.
- Strip unknown fields per confirmed DTO. Do not spread mock objects into JSON.
- Mock mode is opt-in for local UI development (`import.meta.env.DEV` plus an explicit flag). Production must refuse to boot in mock mode.
- Live mode must not fall back to `createMockApi()` on network failure.
- Mock toasts and banners must say the data is simulated. Live toasts must use the engine status, not the mock’s `accepted` / `completed` strings.
- Do not send `SenderIdentityActor`.

### 2. Keycloak, then profile

- Authorization Code + PKCE in the browser. Do not add a portal call to a token-exchange URL.
- Block the shell until a token exists.
- Call `GET /api/v1/auth/me` and map `userId`, `role`, `tenantId`, `status` into the session.
- Translate engine role names to the existing permission sets. Unknown roles get no permissions.
- On `401`, clear the session and return to login. Do not retry with a demo user.
- Ignore `tenantId` search params for `CLIENT_ADMIN`, `OPERATOR`, and `VIEWER`.

### 3. Read-only tenant data

After the profile call succeeds:

1. `GET /api/v1/message-history` and `GET /api/v1/message-history/:messageId`.
2. `GET /api/v1/usage`, `GET /api/v1/subscription`, and `GET /api/v1/entitlements`.
3. `GET /api/v1/health` as an operational check, once its auth and body are confirmed.

Map only returned fields. Hide attempt, routing, and failure sections when the payload does not include them. Show `SUBMITTED` as accepted by the relay, not delivered.

### 4. Read-only administration that has a named collection

Applications, nested credentials (no secret replay), templates, users, and senders. Confirm each method and DTO before enabling create or edit. Leave SMS and email template creation unavailable.

### 5. Stay unavailable

Leave these on the explicit mock switch, or disable the action and explain that it is not available:

- Send message and any use of machine Basic from the portal.
- Bulk create, list, and simulated results.
- Webhook test and any copy that implies delivery.
- Provider connection tests, provider catalog editing, and routing save if the DTO is still unknown.
- Audit, reports, channel catalog, plans, settings, system configuration, and platform API clients.
- Dashboard export, global search, and the notification bell’s demo items.

Platform tenant paths may be added only for `PLATFORM_SUPER_ADMIN`, and only for suffixes that are documented. Do not let a tenant role pass `:tenantId`.

## Verification checklist for the first integration phase

The first phase is the client, Keycloak session, `GET /api/v1/auth/me`, and the read-only history and usage calls. It does not include send, bulk, probes, or webhook delivery.

- [ ] Git diff contains no change under `src/` until implementation is explicitly requested. This audit adds only this document.
- [ ] Production build cannot start with mock mode enabled.
- [ ] Development mock mode shows a visible simulated-data indicator on screens that still use the mock.
- [ ] Live mode never calls `createMockApi()` and never toasts success when the response is an error object.
- [ ] No request from the portal uses HTTP Basic.
- [ ] No request includes `SenderIdentityActor` or a tenant id chosen by a tenant user.
- [ ] `GET /api/v1/auth/me` is called with the Bearer token and mapped without inventing `name` or `email` if they are absent.
- [ ] An unknown or missing role renders `ForbiddenState` rather than a demo super admin.
- [ ] `401` and `403` do not show an empty table as if the tenant had no data.
- [ ] History and detail use the two named GET routes only.
- [ ] Usage, subscription, and entitlements are three reads, not `getUsage()`’s synthesized `quotaPct`.
- [ ] Status text does not call `SUBMITTED` delivered.
- [ ] Send, bulk submit, webhook test, and provider test stay disabled or on the mock switch.
- [ ] No call is made to Keycloak, APISIX, a provider, or a live engine during this audit.
- [ ] No SMS, email, or WhatsApp message is sent.
- [ ] English and Arabic strings and RTL layout are unchanged.
- [ ] Error UI can show `correlationId` from the engine error body.

## Source files inspected

- `src/lib/api/client.ts`, `src/lib/api/types.ts`, `src/lib/api/queries.ts`
- `src/lib/api/mock/mock-api.ts`, `mock-data.ts`, `mock-data-ext.ts`
- `src/lib/api/provider-catalog.ts`, `src/lib/api/template-variables.ts`
- `src/lib/auth/session.tsx`, `src/lib/auth/permissions.ts`
- `src/lib/tenant-context.ts`
- `src/config/navigation.ts`
- `src/components/auth/AuthBoundary.tsx`, `src/components/app/RequirePermission.tsx`, `src/components/app/AppHeader.tsx`
- Portal routes under `src/routes/` for login, dashboard, messages, templates, applications, credentials, usage, audit, docs, webhooks, reports, users, settings, sender identities, and platform screens

Engine source was not inspected. Field-level engine DTOs other than `GET /api/v1/auth/me` remain outside this document on purpose.
