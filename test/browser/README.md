# Isolated live UI fixtures

Run `node --experimental-strip-types test/browser/live-read-smoke.mjs` from the frontend repository with an installed Chrome or Edge. This starts a new loopback-only Vite instance and an isolated temporary headless browser profile. It uses existing dependencies and Node's native DevTools WebSocket support.

An in-memory Vite plugin supplies synthetic public runtime settings and read-only API fixtures. It never edits `.env`, uses the user's browser profile or credentials, opens a real issuer, starts the backend or workers, or permits API mutations. External page requests are blocked and browser background networking is disabled. The harness only opens a review form; it never confirms a mutation.

It checks mounted live-mode pages, role presentation, validation, errors without mock fallback, an actual CSV download, and English/Arabic RTL and local locale persistence. Screenshots and a result manifest go to a separate temporary artifact directory. Only its own newly created browser profile is removed after a checked-path cleanup.

These checks **do not verify real OIDC, backend authorization, database persistence, provider behavior, or full end-to-end business acceptance**. Those remain separate integration/manual acceptance requirements. The fixture token is synthetic and is accepted only by this local fixture middleware.

Coverage now also includes local personalized CSV upload/review and reusable SMS/Email content-version detail with named preview controls. All recorded API requests remain GET-only; rendering, version creation/lifecycle, message acceptance and bulk creation/cancellation are never submitted by this browser harness. Render POST contracts are checked separately using mocked frontend fetch and backend HTTP/unit fixtures.

