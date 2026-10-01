<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The web app is a presentation layer only: screens use `src/lib/api/queries.ts`, which calls the `DolfConnectApi` interface in `src/lib/api/client.ts`; swap the mock for an HTTP client there, never call data sources from components. Why: backend APIs are the source of truth.
- Roles/permissions live only in `src/lib/auth/permissions.ts`; navigation in `src/config/navigation.ts` filters by permission and pages wrap in `RequirePermission`. Why: one place for role logic.
- Session is simulated in `src/lib/auth/session.tsx` and must be replaced by Keycloak/OIDC claims, not a local password store. Why: auth is Keycloak-based.
- All UI strings go through `useI18n().t` with keys in `src/lib/i18n/en.ts` (ar.ts must match); use logical CSS (ms/me/ps/start/end) and `rtl:` variants. Why: EN/AR RTL is foundational.
- Statuses render only via `StatusBadge` + `components/app/status.ts`; colors only via tokens in `src/styles.css`. Why: consistent semantics.
- Unbuilt modules use `ScheduledModule` so routes/permissions exist before screens.
