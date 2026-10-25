# Message acceptance verification — 2026-10-25

This is targeted acceptance evidence, not full platform, accessibility or
localization acceptance. All browser API traffic used loopback fixtures with
synthetic authentication. External browser requests were blocked. The only
permitted POST returns an in-memory acceptance receipt; it cannot reach NestJS,
PostgreSQL, a worker or a provider.

## Scenario results

| Scenario | Screen / route | Result and evidence |
| --- | --- | --- |
| Missing active subscription | `/messages/send?tenantId=…` | PASS EN/AR: exact missing-subscription guidance, titled warning/status, review disabled. |
| Expired subscription | Same | PASS EN/AR: ended-subscription guidance, review disabled; no claim that another failure means expiry. |
| Suspended organization | Same | PASS EN/AR: tenant-suspended explanation rather than invented subscription expiry; review disabled. |
| Channel unavailable | Same | PASS EN/AR: SMS-specific subscription restriction, review disabled. |
| No eligible sender | Same | PASS EN/AR: empty sender fixture produces current-page guidance, review disabled. |
| Specifically inactive sender | Same | BLOCKED browser: empty eligible-list case tested; no separate inactive-row browser fixture. Frontend eligibility unit tests provide supplementary evidence only. |
| Invalid recipient | Same | PASS EN/AR: invalid recipient blocks review. |
| Backend failure | Same | PASS EN/AR: synthetic HTTP 500 produces safe alert, no raw fixture exception, review disabled; Tab moves focus to a control. |
| Network disconnect/timeout | Same | BLOCKED browser: HTTP failure tested, not a transport disconnect. Error-type unit tests are supplementary. |
| Controlled success | Same | PASS EN/AR: fixture receipt only, acceptance is distinct from delivery. |
| Insufficient send permission | Same, VIEWER | PASS EN/AR: permission explanation and no recipient controls. |
| Users & Access restricted mutations | `/users` | BLOCKED browser: no dedicated user-mutation fixtures exercised. Backend authorization tests passed; no real authenticated API acceptance performed. |
| Missing/expired/suspended subscription administration | `/platform/tenants`, `/platform/plans`, `/usage` | BLOCKED browser: restriction rendering verified in Send Message, not these standalone screens. |
| Quota exhaustion / hard-stop / soft-cap | Dashboard / usage / sending | BLOCKED browser: no exhaustion fixture exercised. Offline dispatch-policy tests passed; not proof of live persistence/enforcement. |
| Provider not configured | `/platform/providers` | PASS EN/AR: empty provider list shows empty guidance, no error alert. Does not establish readiness of a real account. |
| Recorded failed health | Same | PASS EN/AR: stored DEGRADED/TIMEOUT fixture renders localized failure category. No health probe runs. |
| Configuration API unavailable | Same | PASS EN/AR: one safe alert, no raw fixture exception; no mock fallback. |
| Other changed modules | All other screens in `USER_MESSAGE_AUDIT.md` | BLOCKED browser: broad existing harness stopped at an outdated client-identifier assertion before completing these screens. No acceptance inferred from the prior implementation report. |
| Alert RTL / layout | Send Message | PASS representative desktop EN/AR: direction, titled status, bounded icon, no alert horizontal overflow. Arabic missing-subscription screenshot visually inspected. |
| Mobile / screen reader / dismissal controls | Shared UI | BLOCKED: not exercised. Tab-focus and DOM roles are limited accessibility evidence, not a full audit. |
| Independent Arabic language review | All | BLOCKED: no independent reviewer participated. |

## Automated checks executed

- `node --experimental-strip-types test/browser/live-read-smoke.mjs`: stopped at
  stale `fixture-public-client` expectation. This is an incomplete broad run,
  not evidence of an application defect or a passing suite.
- Targeted browser command: `node --experimental-strip-types
  test/browser/live-read-smoke.mjs --messages-only`.
- Offline frontend: `user-message.test.ts` and
  `http/human-message-live-api.test.ts`: 13 tests passed.
- Offline backend: authorization guard, entitlement rules and dispatch-policy
  suites: 21 tests passed in three suites. No database/provider integrations ran.
- ESLint for the new browser-check module and Node syntax checks for the
  harness/check module passed. No new full application typecheck/build claimed.

## Changes in this verification pass

- `test/browser/live-read-smoke.mjs`: optional targeted fixture mode, controlled
  state variations, safe failure screenshots, and one narrowly matched synthetic
  acceptance response. Default mode still rejects all API writes.
- `test/browser/message-acceptance-checks.mjs`: EN/AR browser assertions and
  screenshots. Fixed test loading races by waiting for enabled controls.
- This report. No application or backend production code was changed.

Pre-existing dirty files remain in place. No staging, commits, migrations,
configuration changes, real messages, database operations or provider calls.

## Final browser run

The final targeted command exited 0: **24 checks passed** in Chrome
156.0.8078.48. No unknown fixture paths or uncaught browser exceptions remained.
Artifacts (JSON results and screenshots):
`C:\Users\m.mohiseen\AppData\Local\Temp\dolf-browser-artifacts-thbDpq`.
The JSON's legacy `readRequests: 144` field counts all requests: 142 GETs and
two strictly local synthetic POST receipts. No API request was forwarded.
The external Google Fonts origin was blocked by browser interception.
The harness closed its own Chromium process and Vite server and exited cleanly.

No confirmed production defect was found in the executed scenarios; no production
code fix was made. The earlier incomplete runs exposed fixture omissions and
test-loading races, which were corrected within the browser tests.

Final worktree status: frontend 75 modified tracked files / 25 untracked files
(the existing harness edited; this report and check module newly untracked),
versus 75 / 23 at the start. Backend remains 14 / 6. Neither index contains
staged changes. All changes remain unstaged and uncommitted.
