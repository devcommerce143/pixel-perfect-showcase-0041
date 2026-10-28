# Frontend on the production Docker VM

The application remains TanStack Start with SSR. Docker selects Nitro
`node-server` for that build only; Lovable and local Vite dev configuration remain
intact. There is no staging environment or new backend service dependency.

## Organization-supplied public build inputs

Supply these through an operator-owned Compose settings file outside both repos,
or CI public build arguments. No actual production URLs are supplied here.

| Input | Required value |
| --- | --- |
| `DOLF_FRONTEND_NODE_IMAGE` | Approved official Node 22 (22.12+) image including the node user, pinned as `node:<reviewed-tag>@sha256:<approved-digest>`; same image for build/runtime, built for the VM architecture |
| `DOLF_FRONTEND_IMAGE` | Reviewed frontend release tag; record image ID/digest and source snapshot/lockfile hashes |
| `DOLF_FRONTEND_EDGE_NETWORK` | Existing Docker network that external APISIX can reach |
| `VITE_API_BASE_URL` | Public browser-reachable HTTPS API base; `/api/v1` is appended if absent |
| `VITE_OIDC_ISSUER` | Approved HTTPS Keycloak realm issuer, not just the Keycloak origin |
| `VITE_OIDC_CLIENT_ID` | Public browser client ID, never a client secret |
| `VITE_OIDC_REDIRECT_URI` | Approved portal origin plus `/auth/callback`, registered exactly with Keycloak |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | Approved portal logout destination on that same origin, such as its existing `/login` route |
| `VITE_OIDC_SILENT_REDIRECT_URI` | Optional; leave empty to preserve disabled silent renewal. A nonempty value requires a separately verified existing silent-callback handler on the portal origin; packaging adds no handler and does not certify this flow |

Docker fixes `VITE_API_MODE=live`. Production builds validate HTTPS and reject
loopback/IP/local hosts, embedded credentials, query/fragment URLs, missing values,
invalid login callback paths, and undocumented VITE_ keys. Validation does not prove
domain ownership, DNS, certificates or issuer acceptance. Standalone production
builds use the same check; developer HTTP `.env.local` values now intentionally
fail production builds. `npm run dev` is unchanged. `npm run build:dev` is not a
production artifact.

All VITE_ values are public and compiled into the browser bundle. Runtime env
cannot update them: rebuild for an approved URL change. Never pass tokens, client
secrets, private keys, database/provider credentials, or backend runtime env files.
Build arguments/history/provenance and CI logs are not secret storage. Private
registry authentication, if needed, must use the organization's BuildKit secret
workflow, not copied `.npmrc` files or build args. The Docker context allowlist
excludes developer env/config, Git, old output and dependencies.

## Build and run after deployment approval

From this repository, with an externally prepared settings file (these are
instructions, not authorization to deploy):

```text
docker compose --env-file /approved/path/frontend.env -f deploy/compose.yaml build frontend
docker compose --env-file /approved/path/frontend.env -f deploy/compose.yaml up -d --no-build frontend
docker compose --env-file /approved/path/frontend.env -f deploy/compose.yaml stop frontend
```

No migration or database initialization occurs. This separate Compose project
does not replace or restart backend services. The image copies the whole `.output`
tree, including traced dependencies and public assets, into a non-root Node runtime.
Command: `node .output/server/index.mjs`. It listens on `0.0.0.0:3000` **inside the
container**, without a host port publication. The health check requests local
`/login` and requires HTTP 200 HTML; it proves SSR liveness, not authentication or
API/Keycloak readiness. Root FS is read-only, `/tmp` temporary, logs rotate at
10 MB x 3, restart is unless-stopped, and graceful stop has 30 seconds. Runtime
settings: `NODE_ENV=production`, `NITRO_HOST=0.0.0.0`, `NITRO_PORT=3000`. No
application secrets are required by this frontend runtime.

## APISIX/network integration

Infra must approve an existing shared Docker network and attach APISIX (or its
approved private upstream path) to it. Route the approved portal hostname to
`frontend:3000`; ensure that service alias is unique on the network. The
`external: true` declaration does not create infrastructure. If APISIX is on
another host or cannot join that network, obtain an approved private connectivity
design before startup. Do not publish an all-interface port as a workaround.

Route portal paths including `/auth/callback`, `/login`, and `/assets/*` to the
frontend with paths intact. Browser API traffic uses the public API URL, not a
Docker service hostname. Keycloak is also reached by the browser at its approved
public issuer. Existing backend APISIX/TLS/trusted-proxy settings remain unchanged.
Backend CORS must allow the exact portal HTTPS origin. Keycloak must allow the
exact callback/logout origins and use a public Authorization Code + PKCE client.

Before production: verify the pinned image, vulnerability policy, Keycloak login,
logout and optional renewal, API CORS, APISIX paths/TLS/headers, network reachability,
health and restart behavior on the VM. A local synthetic-config build is not
production authentication or APISIX verification. Keep durable dispatch controls
unchanged; frontend startup does not enable them.
