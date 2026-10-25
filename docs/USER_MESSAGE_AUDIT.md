# User-facing message audit and cleanup

## Scope and method

Static inspection covered all route files, app/auth/shared UI components, message
and dashboard features, both translation dictionaries, API error/mutation
mappers, and the backend shared exception filter and domain error boundary.
No provider, database, runtime service or browser session was contacted.
Existing business permissions, subscription rules, quotas and request contracts
remain authoritative and unchanged. No migration or runtime configuration change.

## Findings by module

| Module/screens | Classification and resulting treatment |
| --- | --- |
| Dashboard | KEEP real quota bands/counts and hard-stop versus soft-cap explanations. ALERT quota warnings and load failures through shared notices. |
| Clients / tenants | KEEP actual subscription states and field validation. REWRITE plan/access wording. ALERT operation failures; preserve uncertain-result instructions. |
| Subscriptions / plans | REWRITE entitlement jargon as channels, limits and allowances. KEEP immediate-change and partial-save warnings. ALERT save failures. |
| Users / access | REWRITE local-account creation caveat without implying an invitation was sent. KEEP role restrictions. ALERT operation failures; KEEP short inline field errors. |
| Messages / send | REWRITE acceptance, worker and duplicate-key terminology. ALERT actual blocker code, unavailable channel/bulk feature, and missing eligible sender/template on the current page. No inference about other pages. |
| Bulk Jobs | REWRITE processing/confirmation guidance. KEEP accepted-versus-delivered distinction, import headers, format/size limits and per-row validation. ALERT failures and invalid list filters. |
| Templates / reusable content | KEEP immutability, approval and uncertain-creation safeguards. ALERT lifecycle/preview failures. |
| Applications / API clients | KEEP permissions and sender access controls. REWRITE validation guidance; ALERT operation failures. |
| API credentials | KEEP one-time-secret and revocation warnings. REWRITE rate-setting caveat. ALERT failed actions; never display credential/error payloads. |
| Usage / subscription | REWRITE plan allowance wording. KEEP actual counters, unavailable values and quota policy semantics. ALERT read errors. |
| Audit logs | REWRITE UUID wording as references. KEEP audit filters and administrative retention restrictions. ALERT operation/filter failures. |
| API documentation | KEEP technical protocol, endpoint, authorization and duplicate-request documentation for its developer audience. Do not replace accurate contracts with vague UI language. |
| Channels / settings | REWRITE external policy ownership without internal product/service terminology. KEEP distinction between subscription access and provider readiness. |
| Sender identities | REWRITE internal-verification versus provider-approval explanation. KEEP approval and active-state requirements. ALERT failed changes. |
| Providers / health | KEEP recorded observations, failures, freshness and last-success distinction. REWRITE unsupported balance wording. REMOVE duplicate account-code display. Shared read errors preserve safe support references. |
| Routing | REWRITE provider-order guidance. KEEP priority, uncertain-save and failover restrictions. ALERT failures; no routing changes. |
| Webhooks | KEEP URL validation, signing-secret and uncertain-test instructions. ALERT load/save failures. API documentation remains technical. |
| Reports | KEEP real report ranges, export scope and empty data. ALERT read/export failures. No fabricated totals. |
| System configuration / mock screens | KEEP clear operational restrictions and mock/live separation. ALERT relevant existing operation failures; no new backend configuration controls. |
| Authentication / root fallback | INTERNAL ONLY raw profile exception text; use localized safe guidance and retain support reference. REWRITE/localize missing-page and route errors. REMOVE redundant numeric missing-page label. |
| Shared dialogs / alerts | ALERT errors, warnings, information and confirmed success with distinct semantic variants. Use logical start/end padding. Localize close controls. KEEP concise inline field validation. |
| Other UI primitives | KEEP language autonyms, brand names, file-format names and technical control labels where necessary. Generic unused pagination/carousel/breadcrumb/sidebar primitive copy remains unchanged. |

## Shared implementation

- `MessageAlert` reuses the existing Alert primitive and design tokens. Errors
  use role=alert; other variants use role=status. No automatic dismissal.
- `ErrorState` maps stable error types/statuses to localized copy, never renders
  exception.message or details, and preserves UUID support references.
- Known operation-specific failure mappings and concise field validation remain.
  Generic status mapping does not invent an entitlement cause from an HTTP code.
- Sending explanations use the actual resolved blocker/channel/feature data.
  Existing canReview and backend enforcement are unchanged.
- The backend suppresses raw server exception messages in development as well as
  production; envelope fields/status codes and safe correlated logging remain.
- Root fallbacks provide their own localization provider because they can render
  outside the normal application providers.

## Verification limits

The automated UI checks render real shared alerts with EN/AR dictionaries using
in-memory test loaders. They are not browser acceptance or live OIDC verification.
No provider capacity, subscription expiration, permission or message success is
invented. There is no claim that every server-side internal diagnostic string was
rewritten: those remain internal, with safe HTTP/UI boundaries.

Browser layout/accessibility acceptance and an independent native Arabic review
remain unverified. Existing unrelated formatting debt is not a reason to reformat
entire screens. Final executed test/check results are reported with the change.

## Executed checks

- Frontend `npm test`: 357 tests passed, 47 suites; zero failures.
- Frontend `npx tsc --noEmit`: passed.
- Focused ESLint: passed for user-message helper/tests, MessageAlert, States,
  alert/dialog/sheet primitives, LiveMessageSend, TemplateRegistry and
  ProviderAttemptHistory. Wider screen formatting debt remains; no full-lint pass
  is claimed.
- Backend focused Jest: 31 tests passed in five suites covering the exception
  filter, security audit filter, entitlement rules, dispatch policy and
  authorization guard.
- Backend build TypeScript check (`tsc --noEmit --incremental false -p
  tsconfig.build.json`) and focused exception-filter ESLint: passed.
- No browser, database, provider, build/deployment or live worker checks ran.

## Exact files edited in this task

Frontend (relative to D:\\dolf-connect):

- `docs/USER_MESSAGE_AUDIT.md`
- `package.json`
- `src/components/app/AdministrativeAudit.tsx`
- `src/components/app/BulkJobCancellation.tsx`
- `src/components/app/BulkJobMonitoring.tsx`
- `src/components/app/ContentTemplateRegistry.tsx`
- `src/components/app/CredentialMonitor.tsx`
- `src/components/app/CredentialRegistry.tsx`
- `src/components/app/EmailEvidencePanel.tsx`
- `src/components/app/LiveApplicationActions.tsx`
- `src/components/app/LiveMessageSend.tsx`
- `src/components/app/LiveSenderActions.tsx`
- `src/components/app/MessageAlert.tsx`
- `src/components/app/MessageHistoryApplicationFilter.tsx`
- `src/components/app/MockBulkSend.tsx`
- `src/components/app/MockPlatformConfig.tsx`
- `src/components/app/MockProviderRouting.tsx`
- `src/components/app/MockProviders.tsx`
- `src/components/app/MockTemplates.tsx`
- `src/components/app/MockUsage.tsx`
- `src/components/app/MonitoringCsvButton.tsx`
- `src/components/app/ProviderAccountActions.tsx`
- `src/components/app/ProviderBindings.tsx`
- `src/components/app/ProviderMonitoring.tsx`
- `src/components/app/ProviderRouting.tsx`
- `src/components/app/ReusableContentPicker.tsx`
- `src/components/app/SmsPilotControlState.tsx`
- `src/components/app/States.tsx`
- `src/components/app/TemplateRegistry.tsx`
- `src/components/app/TenantPolicyLive.tsx`
- `src/components/app/UsageReportLive.tsx`
- `src/components/app/WebhookRegistry.tsx`
- `src/components/auth/AuthBoundary.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/features/dashboard/DashboardCsvButton.tsx`
- `src/features/dashboard/QuotaWarnings.tsx`
- `src/features/dashboard/RecordedOperations.tsx`
- `src/features/messages/ProviderAttemptHistory.tsx`
- `src/features/messages/UnknownResolutionPanel.tsx`
- `src/lib/api/user-message.test.ts`
- `src/lib/api/user-message.ts`
- `src/lib/i18n/ar.ts`
- `src/lib/i18n/en.ts`
- `src/routes/__root.tsx`
- `src/routes/applications.tsx`
- `src/routes/index.tsx`
- `src/routes/login.tsx`
- `src/routes/messages.$messageId.tsx`
- `src/routes/messages.index.tsx`
- `src/routes/platform.plans.tsx`
- `src/routes/platform.tenants.tsx`
- `src/routes/users.tsx`

Backend (relative to D:\\dolf-connect-engine):

- `src/common/filters/all-exceptions.filter.spec.ts`
- `src/common/filters/all-exceptions.filter.ts`

## Worktree preservation

Initial frontend: 58 modified tracked files and 19 untracked files. Final:
75 modified tracked files and 23 untracked files. Initial backend: 12 modified
tracked files and six untracked files. Final: 14 modified tracked files and six
untracked files. Nothing is staged. Baseline hashes confirm that all pre-existing
dirty files outside the edited frontend list remain byte-for-byte unchanged;
all 18 pre-existing dirty backend files remain byte-for-byte unchanged. No
baseline file disappeared. Existing changes in edited files were extended with
focused edits rather than replaced. No commits or Git worktree mutations were
performed by Git commands.
