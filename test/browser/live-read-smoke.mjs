/** Mounted LIVE-mode UI checks against local, read-only contract fixtures. NOT real OIDC/DB acceptance. */
import assert from "node:assert/strict";
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "vite";
import { en } from "../../src/lib/i18n/en.ts";
import { ar } from "../../src/lib/i18n/ar.ts";

const bulkOnly = process.argv.includes("--bulk-only");
const notificationsOnly = process.argv.includes('--notifications-only');
const messagesOnly = process.argv.includes("--messages-only");
let messageScenario = "active";
const tenant = notificationsOnly ? randomUUID() : "11111111-1111-4111-8111-111111111111";
const actor = notificationsOnly ? randomUUID() : "22222222-2222-4222-8222-222222222222";
const application = "33333333-3333-4333-8333-333333333333";
const provider = "44444444-4444-4444-8444-444444444444";
const taqnyatEmailProvider = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sender = "55555555-5555-4555-8555-555555555555";
const message = "66666666-6666-4666-8666-666666666666";
const smsSender = "77777777-7777-4777-8777-777777777777";
const fixturePlan = "88888888-8888-4888-8888-888888888888";
const fixtureSubscription = "99999999-9999-4999-8999-999999999999";
const bulkJob = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const contentTemplate = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const timestamp = new Date().toISOString();
const token = "synthetic-browser-fixture-not-a-real-credential";
const requests = [];
const blocked = [];
const unknown = [];
const exceptions = [];
const checks = [];
let role = "PLATFORM_SUPER_ADMIN";
let credentialFailure = false;
let providerAttemptFailure = false;
let submissionFixture = false;
const tenantRow = {
  id: tenant,
  code: "FIXTURE",
  name: "Fixture tenant Alpha",
  status: "ACTIVE",
  dataRegion: "fixture",
  defaultLanguage: "EN",
  timezone: "UTC",
  notes: null,
  primaryAdminUserId: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const readiness = {
  domainVerificationStatus: "NOT_CONFIGURED",
  spfStatus: "NOT_CONFIGURED",
  dkimStatus: "NOT_CONFIGURED",
};
const senderRow = {
  id: sender,
  tenantId: tenant,
  channel: "EMAIL",
  displayName: "Fixture email sender",
  verificationStatus: "VERIFIED",
  operationalStatus: "INACTIVE",
  providerReference: null,
  rejectionReason: null,
  suspensionReason: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  email: { emailAddress: "sender@fixture.example", domain: "fixture.example", ...readiness },
};
const providerRow = {
  providerAccountId: provider,
  code: "fixture-account",
  channel: "SMS",
  accountStatus: "ACTIVE",
  transport: "TAQNYAT_SMS",
  state: "UNKNOWN",
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,
  lastCheckedAt: null,
  lastTransitionAt: null,
  lastHttpStatus: null,
  lastLatencyMs: null,
  lastFailureClass: null,
};

function activeSubmissionPolicy() {
  return {
    subscription: {
      id: fixtureSubscription,
      tenantId: tenant,
      planId: fixturePlan,
      status: "ACTIVE",
      startsAt: timestamp,
      endsAt: null,
      tpsLimitOverride: null,
      quotaPolicyOverride: null,
      channelOverrides: [],
      plan: {
        id: fixturePlan,
        code: "FIXTURE",
        name: "Fixture plan",
        description: null,
        status: "ACTIVE",
        defaultTpsLimit: 10,
        defaultQuotaPolicy: "HARD_STOP",
        features: ["API_ACCESS", "BULK_MESSAGING"],
        channels: ["SMS", "EMAIL", "WHATSAPP"].map((channel) => ({
          channel,
          enabled: channel === "SMS" || bulkOnly,
          monthlyQuota: channel === "SMS" || bulkOnly ? 100 : null,
        })),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    effective: {
      tenantId: tenant,
      tenantStatus: "ACTIVE",
      subscriptionId: fixtureSubscription,
      planId: fixturePlan,
      configured: true,
      operational: true,
      blockers: [],
      quotaPolicy: "HARD_STOP",
      quotaPolicySource: "plan",
      tpsLimit: 10,
      tpsSource: "plan",
      features: ["API_ACCESS", "BULK_MESSAGING"],
      channels: ["SMS", "EMAIL", "WHATSAPP"].map((channel) => ({
        channel,
        enabled: channel === "SMS" || bulkOnly,
        monthlyQuota: channel === "SMS" || bulkOnly ? 100 : null,
        tpsLimit: channel === "SMS" || bulkOnly ? 10 : null,
        quotaSource: channel === "SMS" || bulkOnly ? "plan" : "unavailable",
        tpsSource: channel === "SMS" || bulkOnly ? "plan" : "unavailable",
        ignoredOverride: false,
      })),
    },
  };
}
const submissionApp = {
  id: application,
  tenantId: tenant,
  name: "Fixture submission application",
  environment: "SANDBOX",
  status: "ACTIVE",
  channels: bulkOnly ? ["SMS", "EMAIL", "WHATSAPP"] : ["SMS"],
  scopes: ["MESSAGES_SEND"],
  senderAccess: "ALL_ELIGIBLE",
  allowListSenderIds: [],
  channelAvailability: (bulkOnly ? ["SMS", "EMAIL", "WHATSAPP"] : ["SMS"]).map((channel) => ({ channel, granted: true, available: true })),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const submissionSender = {
  id: smsSender,
  tenantId: tenant,
  channel: "SMS",
  displayName: "Fixture SMS sender",
  verificationStatus: "VERIFIED",
  operationalStatus: "ACTIVE",
  providerReference: null,
  rejectionReason: null,
  suspensionReason: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  sms: { senderId: "Fixture", countryCode: "SA" },
  email: null,
  whatsapp: null,
};
function fixture(url) {
  const route = url.pathname.replace("/fixture-api/api/v1", "");
  if (route === '/notifications') return {items:[],page:Number(url.searchParams.get('page')??1),pageSize:20,total:0,unreadCount:0};
  if (messagesOnly && route === "/provider-health" && messageScenario === "provider-empty") return {items:[],nextCursor:null};
  if (messagesOnly && route === "/provider-health" && messageScenario === "provider-failed") return {items:[{...providerRow,state:"DEGRADED",lastCheckedAt:timestamp,lastFailureClass:"TIMEOUT",consecutiveFailures:1}],nextCursor:null};
  if (messagesOnly && route.endsWith("/subscription")) {
    const value = activeSubmissionPolicy();
    const blockers = { missing: "SUBSCRIPTION_MISSING", expired: "SUBSCRIPTION_ENDED", suspended: "TENANT_SUSPENDED" };
    if (blockers[messageScenario]) {
      value.effective.operational = false;
      value.effective.blockers = [blockers[messageScenario]];
      if (messageScenario === "missing") {
        value.subscription = null;
        value.effective.subscriptionId = null;
        value.effective.planId = null;
        value.effective.configured = false;
        value.effective.quotaPolicy = value.effective.quotaPolicySource = null;
        value.effective.tpsLimit = value.effective.tpsSource = null;
        value.effective.features = [];
        value.effective.channels = value.effective.channels.map((item) => ({...item, enabled:false, monthlyQuota:null, tpsLimit:null, quotaSource:"unavailable", tpsSource:"unavailable"}));
      }
      if (messageScenario === "expired") value.subscription.endsAt = "2020-01-01T00:00:00.000Z";
      if (messageScenario === "suspended") value.effective.tenantStatus = "SUSPENDED";
    }
    if (messageScenario === "channel") value.effective.channels[0].enabled = false;
    return value;
  }
  if (messagesOnly && messageScenario === "sender" && route.endsWith("/senders")) return { items: [], page: 1, pageSize: 20, total: 0 };
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
  const contentRow = {
    id: contentTemplate,
    tenantId: tenant,
    channel: "SMS",
    templateKey: "fixture_content",
    language: "en",
    version: 3,
    registryStatus: "READY",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if ((bulkOnly || messagesOnly) && (route === `/tenants/${tenant}/senders/${smsSender}` || route === `/senders/${smsSender}`)) return submissionSender;
  if (bulkOnly && (route === `/tenants/${tenant}/senders` || route === "/senders") && url.searchParams.get("channel") === "EMAIL") return { items: [{ ...senderRow, operationalStatus: "ACTIVE", email: { ...senderRow.email, domainVerificationStatus: "VERIFIED", spfStatus: "VERIFIED", dkimStatus: "VERIFIED" } }], page, pageSize, total: 1 };
  if (route.endsWith("/content-templates"))
    return { items: [contentRow], total: 1, page, pageSize };
  if (route.endsWith(`/content-templates/${contentTemplate}`))
    return {
      ...contentRow,
      body: "Synthetic content for {{name}}",
      subject: null,
      parameters: ["name"],
    };
  if (route.endsWith("/templates")) return { items: [], total: 0, page, pageSize };
  if (route === `/tenants/${tenant}/applications` || route === "/applications")
    return { items: [submissionApp], page, pageSize, total: 1 };
  if (
    route === `/tenants/${tenant}/applications/${application}` ||
    route === `/applications/${application}`
  )
    return submissionApp;
  if (
    (route === `/tenants/${tenant}/senders` || route === "/senders") &&
    url.searchParams.get("channel") === "SMS"
  )
    return { items: [submissionSender], page, pageSize, total: 1 };
  if (
    submissionFixture &&
    (route === "/subscription" || route === `/tenants/${tenant}/subscription`)
  )
    return activeSubmissionPolicy();
  if (route === "/auth/me")
    return {
      userId: actor,
      name: "Fixture operator",
      tenantName: role === "PLATFORM_SUPER_ADMIN" ? null : tenantRow.name,
      role,
      status: "ACTIVE",
      tenantId: role === "PLATFORM_SUPER_ADMIN" ? null : tenant,
    };
  if (route === "/tenants") return { items: [tenantRow], page, pageSize, total: 1 };
  if (route === `/tenants/${tenant}`) return tenantRow;
  if (route === `/tenants/${tenant}/message-history/${message}/provider-attempts`)
    return {
      messageId: message,
      messageStatus: "UNKNOWN",
      providerChanged: false,
      attempts: [
        {
          attemptNumber: 1,
          state: "UNKNOWN",
          errorCategory: "UNKNOWN_OUTCOME",
          startedAt: timestamp,
          finishedAt: timestamp,
          providerAccountId: provider,
          providerAccountCode: "fixture-account",
          providerRouteId: null,
          senderProviderBindingId: null,
        },
      ],
    };
  if (
    route === `/tenants/${tenant}/message-history/${message}` ||
    route === `/message-history/${message}`
  )
    return {
      id: message,
      applicationId: application,
      channel: "SMS",
      status: "UNKNOWN",
      acceptedAt: timestamp,
      queuedAt: timestamp,
      senderIdentityId: sender,
      templateId: null,
      correlationId: null,
      contentPurgedAt: null,
      recipientNormalized: "+15550000000",
      attempts: [
        {
          attemptNumber: 1,
          state: "UNKNOWN",
          errorCategory: null,
          startedAt: timestamp,
          finishedAt: timestamp,
        },
      ],
    };
  if (route === "/subscription" || route === `/tenants/${tenant}/subscription`)
    return {
      subscription: null,
      effective: {
        tenantId: tenant,
        tenantStatus: "ACTIVE",
        subscriptionId: null,
        planId: null,
        configured: false,
        operational: false,
        blockers: ["SUBSCRIPTION_MISSING"],
        quotaPolicy: null,
        quotaPolicySource: null,
        tpsLimit: null,
        tpsSource: null,
        features: [],
        channels: ["SMS", "EMAIL", "WHATSAPP"].map((channel) => ({
          channel,
          enabled: false,
          monthlyQuota: null,
          tpsLimit: null,
          quotaSource: "unavailable",
          tpsSource: "unavailable",
          ignoredOverride: false,
        })),
      },
    };
  if (route === "/platform/api-credentials")
    return {
      items: [
        {
          id: actor,
          tenantId: tenant,
          tenantName: tenantRow.name,
          applicationId: application,
          applicationName: "Fixture application Alpha",
          clientId: "fixture-public-client",
          status: "ACTIVE",
          effectiveStatus: "ACTIVE",
          expiresAt: null,
          lastUsedAt: null,
          createdAt: timestamp,
          rateLimitPerSecondOverride: null,
        },
      ],
      page,
      pageSize,
      total: 1,
    };
  if (route === "/provider-health")
    return {
      items: [
        providerRow,
        {
          ...providerRow,
          providerAccountId: taqnyatEmailProvider,
          code: "fixture-taqnyat-email",
          channel: "EMAIL",
          transport: "TAQNYAT_EMAIL",
        },
      ],
      nextCursor: null,
    };
  if (route === `/provider-accounts/${taqnyatEmailProvider}`)
    return {
      id: taqnyatEmailProvider,
      code: "fixture-taqnyat-email",
      channel: "EMAIL",
      transport: "TAQNYAT_EMAIL",
      status: "ACTIVE",
      keyVersion: 1,
    };
  if (route === `/provider-accounts/${taqnyatEmailProvider}/health`)
    return {
      ...providerRow,
      providerAccountId: taqnyatEmailProvider,
      code: "fixture-taqnyat-email",
      channel: "EMAIL",
      transport: "TAQNYAT_EMAIL",
    };
  if (
    route === `/provider-accounts/${taqnyatEmailProvider}/health-checks` ||
    route === "/sender-provider-bindings"
  )
    return { items: [], nextCursor: null };
  if (route === "/sms-pilot-controls") return { submissionsEnabled: false };
  if (route === "/platform/audit-retention")
    return {
      retentionDays: 365,
      updatedAt: timestamp,
      complianceConfirmationPending: true,
      deletionEnabled: false,
    };
  if (route === `/tenants/${tenant}/senders`)
    return { items: [senderRow], page, pageSize, total: 1 };
  if (route === `/tenants/${tenant}/senders/${sender}`) return senderRow;
  if (route === `/tenants/${tenant}/senders/${sender}/email-evidence`)
    return {
      current: { senderId: sender, tenantId: tenant, domain: "fixture.example", ...readiness },
      items: [],
      page,
      pageSize,
      total: 0,
    };
  const bulkRow = {
    id: bulkJob,
    tenantId: tenant,
    tenantName: tenantRow.name,
    applicationId: application,
    applicationName: "Fixture app",
    channel: "SMS",
    mode: "SHARED",
    status: "PROCESSING",
    result: "OPEN",
    itemCount: 2,
    pendingCount: 1,
    acceptedCount: 1,
    invalidCount: 0,
    skippedCount: 0,
    failedCount: 0,
    createdAt: timestamp,
    completedAt: null,
    cancelledAt: null,
  };
  if (route.endsWith("/bulk-job-history")) return { items: [bulkRow], page, pageSize, total: 1 };
  if (route.endsWith(`/bulk-job-history/${bulkJob}`)) return bulkRow;
  if (route.endsWith(`/bulk-job-history/${bulkJob}/items`))
    return {
      items: [
        { rowNumber: 1, state: "ACCEPTED", messageId: message, errorCode: null },
        { rowNumber: 2, state: "PENDING", messageId: null, errorCode: null },
      ],
      page,
      pageSize,
      total: 2,
    };
  if (route === "/dashboard")
    return {
      scope: "platform",
      tenantId: null,
      messages: { total: 12, delivered: 2, pending: 3, failed: 1, submitted: 4, unknown: 2 },
      trend: [{ date: timestamp.slice(0, 10), delivered: 2, pending: 3, failed: 1 }],
      channels: [{ channel: "SMS", count: 12 }],
      usage: {
        periodStart: timestamp.slice(0, 7) + "-01",
        channels: [],
        aggregate: { committedCount: 0, reservedCount: 0, monthlyQuota: null },
      },
    };
  if (route === "/dashboard/messages") return { scope: "platform", tenantId: null, items: [] };
  if (route === "/dashboard/quota")
    return {
      scope: "platform",
      tenantId: null,
      periodStart: timestamp.slice(0, 7) + "-01",
      counts: { atOrAbove80: 0, atOrAbove90: 0, atOrAbove100: 0, unconfigured: 0 },
    };
  unknown.push(route);
  return undefined;
}

async function waitFor(fn, label, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await delay(150);
  }
  throw new Error(`Timed out: ${label}`);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function browserBinary() {
  for (const candidate of [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* Try the next installed browser. */
    }
  }
  throw new Error("No installed Chromium browser found");
}

const root = path.resolve(import.meta.dirname, "../..");
const origin = `http://127.0.0.1:${await freePort()}`;
const issuer = `${origin}/fixture-issuer`;
const profile = await mkdtemp(path.join(os.tmpdir(), "dolf-browser-profile-"));
const artifacts = await mkdtemp(path.join(os.tmpdir(), "dolf-browser-artifacts-"));
const downloads = path.join(artifacts, "downloads");
await mkdir(downloads);
let vite, chrome, socket;
let notificationBridge;
try {
  if (notificationsOnly) {
    const backendRequire = createRequire(path.resolve(root,'../dolf-connect-engine/package.json'));
    notificationBridge = await backendRequire('./test/integration/notifications-browser-fixtures.cjs').createNotificationBrowserFixtures({tenant,actor,approved:process.argv.includes('--approved-local-notifications')});
  }
  vite = await createServer({
    root,
    clearScreen: false,
    logLevel: "error",
    server: { host: "127.0.0.1", port: Number(new URL(origin).port), strictPort: true },
    plugins: [
      {
        name: "dolf-read-only-browser-fixtures",
        enforce: "pre",
        load(id) {
          if (id.replaceAll("\\", "/").split("?")[0].endsWith("/src/lib/config/read-env.ts"))
            return `export function readClientEnv(){return ${JSON.stringify({ DEV: true, PROD: false, VITE_API_MODE: "live", VITE_API_BASE_URL: `${origin}/fixture-api/api/v1`, VITE_OIDC_ISSUER: issuer, VITE_OIDC_CLIENT_ID: "browser-fixture", VITE_OIDC_REDIRECT_URI: `${origin}/auth/callback`, VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `${origin}/login` })}}`;
        },
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = new URL(req.url, origin);
            if (!url.pathname.startsWith("/fixture-api/")) return next();
            const authorized = req.headers.authorization === `Bearer ${token}`;
            requests.push({ path: url.pathname, method: req.method, authorized });
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            if (!authorized) {
              res.statusCode = 401;
              return res.end(JSON.stringify({ message: "Fixture authentication required" }));
            }
            if (notificationsOnly && (/\/notifications(?:\/|$)/.test(url.pathname) || url.pathname.endsWith('/auth/me'))) {
              void notificationBridge.handle(req,res,url).catch(()=>{res.statusCode=500;res.end(JSON.stringify({message:'Local validation failed'}));exceptions.push('Notification bridge failure');});
              return;
            }
            if (req.method !== "GET") {
              if (messagesOnly && messageScenario === "success" && req.method === "POST" && url.pathname === `/fixture-api/api/v1/tenants/${tenant}/applications/${application}/messages`) {
                // Synthetic receipt only: never forwarded to a backend or provider.
                req.resume();
                return res.end(JSON.stringify({id:message,channel:"SMS",status:"ACCEPTED",acceptedAt:timestamp,queuedAt:null,replay:false}));
              }
              res.statusCode = 405;
              return res.end(JSON.stringify({ message: "Fixture harness forbids writes" }));
            }
            if (
              (messagesOnly && messageScenario === "failure" && url.pathname.endsWith("/subscription")) ||
              (messagesOnly && messageScenario === "provider-unavailable" && url.pathname.endsWith("/provider-health")) ||
              (credentialFailure && url.pathname.endsWith("/platform/api-credentials")) ||
              (providerAttemptFailure && url.pathname.endsWith("/provider-attempts"))
            ) {
              res.statusCode = 500;
              return res.end(
                JSON.stringify({
                  statusCode: 500,
                  message: "Fixture failure",
                  error: "Internal Server Error",
                }),
              );
            }
            const body = fixture(url);
            res.statusCode = body === undefined ? 500 : 200;
            res.end(JSON.stringify(body ?? { message: "Missing read fixture" }));
          });
        },
      },
    ],
  });
  await vite.listen();
  chrome = spawn(
    await browserBinary(),
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-default-apps",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  chrome.on("error", () => {});
  const port = await waitFor(
    async () => {
      try {
        return Number(
          (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0],
        );
      } catch {
        return false;
      }
    },
    "isolated browser startup",
    20000,
  );
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0,
    session;
  const pending = new Map();
  function send(method, params = {}, targetSession = session) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`DevTools command timed out: ${method}`));
      }, 15000);
      timer.unref();
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(targetSession ? { sessionId: targetSession } : {}),
        }),
      );
    });
  }
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task?.reject(new Error(message.error.message));
      else task?.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      const local =
        request.url.startsWith(`${origin}/`) ||
        request.url.startsWith("data:") ||
        request.url.startsWith("blob:");
      if (!local) blocked.push(new URL(request.url).origin);
      void send(
        local ? "Fetch.continueRequest" : "Fetch.failRequest",
        local ? { requestId } : { requestId, errorReason: "BlockedByClient" },
        message.sessionId,
      ).catch(() => {});
    } else if (message.method === "Runtime.exceptionThrown")
      exceptions.push(message.params.exceptionDetails.text);
  });
  const target = await send("Target.createTarget", { url: "about:blank" }, null);
  session = (
    await send("Target.attachToTarget", { targetId: target.targetId, flatten: true }, null)
  ).sessionId;
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads }, null);
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if(location.origin===${JSON.stringify(origin)}){sessionStorage.setItem(${JSON.stringify(`oidc.user:${issuer}:browser-fixture`)},JSON.stringify({id_token:"fixture",access_token:${JSON.stringify(token)},token_type:"Bearer",scope:"openid",profile:{sub:${JSON.stringify(actor)},iss:${JSON.stringify(issuer)},aud:"browser-fixture"},expires_at:Math.floor(Date.now()/1000)+3600}));if(!localStorage.getItem("dc.locale"))localStorage.setItem("dc.locale","en");}`,
  });
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error("Browser evaluation failed");
    return response.result.value;
  }
  const text = () => evaluate("document.body?.innerText??''");
  async function contains(value) {
    return waitFor(async () => (await text()).includes(value), value);
  }
  async function navigate(route) {
    await send("Page.navigate", { url: origin + route });
  }
  async function click(expression) {
    const box = await evaluate(
      `(()=>{const element=${expression};if(!element)throw Error('Missing target');element.scrollIntoView({block:'center',inline:'center'});const r=element.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...box,
      button: "left",
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...box,
      button: "left",
      clickCount: 1,
    });
  }
  const button = (label) =>
    `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  const combo = (label) =>
    `[...document.querySelectorAll('[role=combobox]')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)})`;
  const option = (prefix) =>
    `[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.startsWith(${JSON.stringify(prefix)}))`;
  async function screenshot(name) {
    await evaluate(
      "Promise.allSettled(document.getAnimations().filter(a=>a.playState==='running'&&a.effect.getComputedTiming().endTime<=1000).map(a=>a.finished))",
    );
    const result = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(path.join(artifacts, `${name}.png`), Buffer.from(result.data, "base64"));
  }
  function passed(name) {
    checks.push(name);
    console.log(`PASS ${name}`);
  }

  if (notificationsOnly) {
    const {runNotificationChecks}=await import('./notification-checks.mjs');
    await runNotificationChecks({evaluate,click,navigate,contains,button,send,screenshot,passed,waitFor,en,ar,bridge:notificationBridge}).catch(async error=>{await screenshot('notification-failure');await writeFile(path.join(artifacts,'notification-failure-text.txt'),await text());throw error;});
  } else if (messagesOnly) {
    submissionFixture = true;
    const { runMessageAcceptanceChecks } = await import("./message-acceptance-checks.mjs");
    await runMessageAcceptanceChecks({ evaluate, click, navigate, contains, button, combo, option, send, screenshot, passed, waitFor, tenant, en, ar, setScenario: (value) => { messageScenario = value; }, setRole: (value) => { role = value; } }).catch(async (error) => {
      await screenshot("message-failure");
      await writeFile(path.join(artifacts, "message-failure-text.txt"), await text());
      throw error;
    });
  } else if (bulkOnly) {
    submissionFixture = true;
    const { runBulkJobsChecks } = await import("./bulk-jobs-checks.mjs");
    await runBulkJobsChecks({ evaluate, click, navigate, contains, button, combo, option, send, screenshot, passed, waitFor, artifacts, downloads, tenant, en, ar, setRole: (next) => { role = next; } }).catch(async (error) => { await screenshot("bulk-failure"); throw error; });
  } else {
  await navigate("/platform/api-clients");
  await contains("fixture-public-client");
  await contains(tenantRow.name);
  assert.ok(!(await text()).includes(en["mode.liveBanner"]));
  passed("live credential metadata and tenant/application identification");
  await click("document.querySelector('#credential-monitor-application')");
  await send("Input.insertText", { text: "invalid" });
  await contains(en["monitorCred.invalidApplication"]);
  assert.equal(await evaluate(`${button(en["monitorCred.apply"])}.disabled`), true);
  passed("invalid application filter blocks submission");
  await navigate(`/platform/channels?tenantId=${tenant}`);
  await contains(en["ten.noCurrentSubscription"]);
  assert.equal(await evaluate("document.querySelectorAll('[role=switch]').length"), 0);
  passed("live-mode entitlement rendering without a global toggle");
  await navigate("/platform/config");
  await contains(en["pilotState.closed"]);
  await contains(en["liveAudit.retention"]);
  passed("configuration policy metadata and recorded gate");
  await navigate("/platform/health");
  await contains("fixture-account");
  await contains(en["providerTransport.TAQNYAT_SMS"]);
  await contains(en["providerTransport.TAQNYAT_EMAIL"]);
  await contains(en["pilotState.closed"]);
  await screenshot("platform-health-en");
  passed("stored provider health and read-only pilot state");
  await navigate(`/platform/providers?providerId=${taqnyatEmailProvider}`);
  await contains(en["providerAccounts.taqnyatSetup"]);
  assert.equal(await evaluate(`${button(en["providerAccounts.replace"])}.disabled`), false);
  assert.ok(!(await text()).includes(en["providerAccounts.callbackConfigure"]));
  await screenshot("taqnyat-email-protocol-en");
  await click(button(en["providerAccounts.replace"]));
  await waitFor(
    () => evaluate("document.querySelector('#provider-account-token') !== null"),
    "Taqnyat bearer input",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#provider-account-username') === null && document.querySelector('#provider-account-secret') === null",
    ),
    true,
  );
  assert.equal(await evaluate(`${button(en["providerAccounts.confirm"])}.disabled`), true);
  passed("Taqnyat Email is distinct from SMTP and Meta credential controls");
  await navigate("/platform/providers");
  await contains(en["providerAccounts.create"]);
  await click(button(en["providerAccounts.create"]));
  await click("document.querySelector('#provider-account-channel')");
  await click(option(en["channel.email"]));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=option]').length === 0"),
    "provider channel menu closes",
  );
  assert.equal(
    await evaluate(
      `document.querySelector('#provider-account-transport').textContent.includes(${JSON.stringify(en["providerTransport.TURBO_SMTP"])})`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('#provider-account-username') !== null && document.querySelector('#provider-account-token') === null",
    ),
    true,
  );
  await screenshot("turbo-smtp-default-en");
  passed("Email configuration defaults to TurboSMTP without submitting credentials");
  await navigate(`/sender-identities?tenantId=${tenant}`);
  await contains("Fixture email sender");
  await click("document.querySelector('tbody tr')");
  await contains(en["emailEvidence.title"]);
  await click(button(en["emailEvidence.record"]));
  await contains(en["emailEvidence.confirm"]);
  assert.equal(await evaluate(`${button(en["emailEvidence.confirmRecord"])}.disabled`), true);
  await screenshot("email-review-en");
  await click(button(en["common.cancel"]));
  passed("email evidence review mounts and requires a reviewed reference");
  await navigate(`/templates?tenantId=${tenant}`);
  await contains(en["content.title"]);
  await click(button(en["content.title"]));
  await contains("fixture_content");
  await click(button("fixture_content"));
  await contains("Synthetic content for {{name}}");
  assert.equal(await evaluate(`${button(en["content.render"])}.disabled`), true);
  await click("document.querySelector('#content-param-name')");
  await send("Input.insertText", { text: "Synthetic fixture" });
  await waitFor(
    () => evaluate(`!${button(en["content.render"])}.disabled`),
    "exact named preview value supplied",
  );
  await screenshot("content-version-preview-controls");
  passed("content versions and named preview controls mount without rendering or mutating");
  await navigate(`/messages/${message}?historyTenantId=${tenant}`);
  await contains(en["unknownResolve.title"]);
  await contains(en["providerAttempts.title"]);
  await contains(en["providerAttempts.noChange"]);
  await contains("fixture-account");
  passed("platform recorded provider targets do not imply failover from an unknown attempt");
  await click(button(en["unknownResolve.open"]));
  await contains(en["unknownResolve.confirmNote"]);
  assert.equal(await evaluate(`${button(en["unknownResolve.confirm"])}.disabled`), true);
  await click("document.querySelector('#unknown-reason')");
  await send("Input.insertText", { text: "Fixture reviewed uncertainty" });
  await click("document.querySelector('#unknown-evidence')");
  await send("Input.insertText", { text: "ticket:FIXTURE" });
  assert.equal(await evaluate(`${button(en["unknownResolve.confirm"])}.disabled`), true);
  await click("document.querySelector('#unknown-ack')");
  await waitFor(
    () => evaluate(`!${button(en["unknownResolve.confirm"])}.disabled`),
    "resolution confirmation enabled after explicit acknowledgement",
  );
  await screenshot("unknown-resolution-en");
  await click(button(en["common.cancel"]));
  passed("platform UNKNOWN SMS review validates evidence and acknowledgement without submitting");
  await navigate("/messages/send");
  await contains(en["msg.selectTenantTitle"]);
  passed("platform human acceptance requires a selected tenant");
  submissionFixture = true;
  await navigate(`/messages/send?tenantId=${tenant}`);
  await contains(en["humanSend.title"]);
  await contains(en["humanSend.chooseApplication"]);
  assert.equal(await evaluate(`${button(en["humanSend.review"])}.disabled`), true);
  await click(combo(en["common.application"]));
  await waitFor(
    () => evaluate(`!!${option("Fixture submission application")}`),
    "actual submission application option",
  );
  await click(option("Fixture submission application"));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=option]').length===0"),
    "submission application menu closed",
  );
  await contains(en["humanSend.chooseSender"]);
  await click(combo(en["msg.senderIdentity"]));
  await waitFor(() => evaluate(`!!${option("Fixture SMS sender")}`), "actual SMS sender option");
  await click(option("Fixture SMS sender"));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=option]').length===0"),
    "submission sender menu closed",
  );
  await click("document.querySelector('#human-message-recipient')");
  await waitFor(
    () => evaluate("document.activeElement.id==='human-message-recipient'"),
    "recipient focused",
  );
  await send("Input.insertText", { text: "+15550000000" });
  await click("document.querySelector('#human-message-body')");
  await waitFor(
    () => evaluate("document.activeElement.id==='human-message-body'"),
    "message body focused",
  );
  await send("Input.insertText", { text: "Synthetic browser fixture content; never submitted" });
  await writeFile(
    path.join(artifacts, "human-form-state.json"),
    JSON.stringify(
      await evaluate(
        "({recipientLength:document.querySelector('#human-message-recipient').value.length,bodyLength:document.querySelector('#human-message-body').value.length,choices:[...document.querySelectorAll('[role=combobox]')].map(e=>e.textContent),errors:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})",
      ),
      null,
      2,
    ),
  );
  await waitFor(
    () => evaluate(`!${button(en["humanSend.review"])}.disabled`),
    "valid human request review",
  );
  await click(button(en["humanSend.review"]));
  await contains(en["humanSend.confirmNote"]);
  await contains("Synthetic browser fixture content; never submitted");
  assert.equal(await evaluate(`${button(en["humanSend.accept"])}.disabled`), true);
  await click("document.querySelector('#human-message-ack')");
  await waitFor(
    () => evaluate(`!${button(en["humanSend.accept"])}.disabled`),
    "explicit human acceptance acknowledgement",
  );
  await screenshot("human-message-review-en");
  await click(button(en["common.cancel"]));
  submissionFixture = false;
  passed(
    "human acceptance uses real paginated fixture choices and explicit review without submitting",
  );
  submissionFixture = true;
  await navigate(`/messages/bulk?tenantId=${tenant}`);
  await contains(en["humanBulk.title"]);
  await click(button(en["humanBulk.title"]));
  await contains(en["humanBulk.note"]);
  assert.equal(await evaluate(`${button(en["humanSend.review"])}.disabled`), true);
  await click(combo(en["common.application"]));
  await waitFor(
    () => evaluate(`!!${option("Fixture submission application")}`),
    "bulk application",
  );
  await click(option("Fixture submission application"));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=option]').length===0"),
    "bulk application menu closed",
  );
  await click(combo(en["msg.senderIdentity"]));
  await waitFor(() => evaluate(`!!${option("Fixture SMS sender")}`), "bulk sender");
  await click(option("Fixture SMS sender"));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=option]').length===0"),
    "bulk sender menu closed",
  );
  await click("document.querySelector('#human-message-recipient')");
  await send("Input.insertText", { text: "+15550000000\n+15550000001" });
  await click("document.querySelector('#human-message-body')");
  await send("Input.insertText", { text: "Synthetic shared bulk fixture; never submitted" });
  await waitFor(() => evaluate(`!${button(en["humanSend.review"])}.disabled`), "valid bulk review");
  await click(button(en["humanSend.review"]));
  await contains(en["humanBulk.confirmNote"]);
  assert.equal(await evaluate(`${button(en["humanBulk.create"])}.disabled`), true);
  await click("document.querySelector('#human-message-ack')");
  await waitFor(
    () => evaluate(`!${button(en["humanBulk.create"])}.disabled`),
    "bulk acknowledgement",
  );
  await screenshot("human-bulk-review-en");
  await click(button(en["common.cancel"]));
  submissionFixture = false;
  passed("human bulk shared-content review and acknowledgement without creating a job");
  submissionFixture = true;
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=dialog]').length===0"),
    "bulk review dialog closed before CSV selection",
  );
  await waitFor(
    () => evaluate("document.querySelector('#human-bulk-csv')?.disabled===false"),
    "CSV selection unlocked",
  );
  await click("document.querySelector('#human-bulk-csv')");
  await contains(en["humanBulk.csvHint"]);
  assert.equal(await evaluate(`${button(en["humanSend.review"])}.disabled`), true);
  const csvFixturePath = path.join(artifacts, "personalized-recipient-fixture.csv");
  await writeFile(
    csvFixturePath,
    'recipient,body\n+15550000000,"First, synthetic fixture"\n+15550000001,Second fixture',
  );
  const documentRoot = await send("DOM.getDocument");
  const fileNode = await send("DOM.querySelector", {
    nodeId: documentRoot.root.nodeId,
    selector: 'input[type="file"]',
  });
  await send("DOM.setFileInputFiles", { nodeId: fileNode.nodeId, files: [csvFixturePath] });
  await waitFor(
    () => evaluate(`!${button(en["humanSend.review"])}.disabled`),
    "CSV file ready for review",
  );
  await click(button(en["humanSend.review"]));
  await contains("First, synthetic fixture");
  await contains(en["humanBulk.personalized"]);
  assert.equal(await evaluate(`${button(en["humanBulk.create"])}.disabled`), true);
  await screenshot("human-bulk-personalized-csv-review");
  await click(button(en["common.cancel"]));
  submissionFixture = false;
  passed("personalized CSV upload stays local and requires explicit review without creating a job");
  await navigate("/");
  await contains(en["dashOps.healthHint"]);
  await click(button(en["dashOps.export"]));
  const csv = await waitFor(async () => {
    try {
      return await readFile(path.join(downloads, "dolf-dashboard-platform.csv"), "utf8");
    } catch {
      return false;
    }
  }, "summary CSV download");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"submitted","4"'));
  assert.ok(csv.includes('"delivered_and_read","2"'));
  passed("real browser loaded-summary CSV download");
  role = "CLIENT_ADMIN";
  await navigate("/settings");
  await contains(en["livePolicy.preferences"]);
  await click("document.querySelector('#portal-language')");
  await waitFor(
    () =>
      evaluate(
        `[...document.querySelectorAll('[role=option]')].some(e=>e.textContent.trim()===${JSON.stringify(en["livePolicy.arabic"])})`,
      ),
    "Arabic locale option",
  );
  await click(
    `[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.trim()===${JSON.stringify(en["livePolicy.arabic"])})`,
  );
  await contains(ar["livePolicy.preferences"]);
  await waitFor(
    () => evaluate("document.documentElement.dir==='rtl'"),
    "Arabic document direction",
    5000,
  );
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=option]').length===0"),
    "locale menu closed",
    5000,
  );
  await screenshot("settings-ar");
  await send("Page.reload");
  await contains(ar["livePolicy.preferences"]);
  await waitFor(
    () => evaluate("document.documentElement.dir==='rtl'"),
    "persisted Arabic document direction",
    5000,
  );
  passed("Arabic preferences, RTL and browser-local persistence");
  role = "PLATFORM_SUPER_ADMIN";
  submissionFixture = true;
  await navigate(`/messages/send?tenantId=${tenant}`);
  await contains(ar["humanSend.title"]);
  assert.ok(!(await text()).includes(ar["humanSend.note"]));
  await waitFor(
    () => evaluate("document.documentElement.dir==='rtl'"),
    "Arabic human acceptance direction",
  );
  assert.equal(await evaluate(`${button(ar["humanSend.review"])}.disabled`), true);
  await screenshot("human-message-ar");
  submissionFixture = false;
  passed("Arabic human message form, validation and RTL without a mutation");
  await navigate(`/messages/${message}?historyTenantId=${tenant}`);
  await contains(ar["unknownResolve.title"]);
  await contains(ar["providerAttempts.title"]);
  await click(button(ar["unknownResolve.open"]));
  await contains(ar["unknownResolve.confirmNote"]);
  await waitFor(
    () => evaluate("document.documentElement.dir==='rtl'"),
    "Arabic resolution direction",
  );
  assert.equal(await evaluate(`${button(ar["unknownResolve.confirm"])}.disabled`), true);
  await screenshot("unknown-resolution-ar");
  await click(button(ar["common.cancel"]));
  passed("Arabic UNKNOWN resolution review and RTL without a mutation");
  await evaluate('localStorage.setItem("dc.locale","en")');
  await navigate(`/messages/bulk?tenantId=${tenant}`);
  await contains(bulkJob);
  await click(button(bulkJob));
  await contains(en["bulkCancel.action"]);
  await click(button(en["bulkCancel.action"]));
  await contains(en["bulkCancel.description"]);
  assert.equal(await evaluate(`${button(en["bulkCancel.confirm"])}.disabled`), true);
  await click("document.querySelector('#bulk-cancel-ack')");
  await waitFor(
    () => evaluate(`${button(en["bulkCancel.confirm"])}.disabled===false`),
    "bulk cancellation acknowledgement",
  );
  await screenshot("bulk-cancellation-confirmation");
  passed("platform bulk cancellation requires acknowledgement without submitting");
  role = "VIEWER";
  await navigate("/messages/bulk");
  await contains(en["bulkHistory.title"]);
  await contains(en["bulkHistory.description"]);
  assert.equal(await evaluate(`${button(en["humanBulk.title"])}===undefined`), true);
  await contains(bulkJob);
  await click(button(bulkJob));
  assert.equal(await evaluate(`${button(en["bulkCancel.action"])}===undefined`), true);
  assert.ok(requests.some((row) => row.path.endsWith("/bulk-job-history")));
  assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"), 0);
  passed("viewer bulk monitoring has no upload control");
  const beforeDeniedSubmission = requests.filter((row) =>
    row.path.includes("/applications"),
  ).length;
  await navigate("/messages/send");
  await contains(en["common.forbiddenTitle"]);
  assert.equal(
    requests.filter((row) => row.path.includes("/applications")).length,
    beforeDeniedSubmission,
  );
  passed("viewer cannot open human acceptance or request its application choices");
  const targetRequestsBeforeViewer = requests.filter((row) =>
    row.path.endsWith("/provider-attempts"),
  ).length;
  await navigate(`/messages/${message}`);
  await contains("+15550000000");
  assert.ok(!(await text()).includes(en["unknownResolve.title"]));
  assert.ok(!(await text()).includes(en["providerAttempts.title"]));
  assert.equal(
    requests.filter((row) => row.path.endsWith("/provider-attempts")).length,
    targetRequestsBeforeViewer,
  );
  passed("tenant viewer message detail has no platform resolution control");
  const before = requests.filter((row) => row.path.endsWith("/platform/api-credentials")).length;
  await navigate("/platform/api-clients");
  await contains(en["common.forbiddenTitle"]);
  assert.equal(
    requests.filter((row) => row.path.endsWith("/platform/api-credentials")).length,
    before,
  );
  passed("viewer platform denial before monitoring request");
  role = "PLATFORM_SUPER_ADMIN";
  credentialFailure = true;
  await navigate("/platform/api-clients");
  await contains(en["common.errorTitle"]);
  assert.ok(!(await text()).includes("fixture-public-client"));
  passed("live API failure stays an error without mock fallback");
  providerAttemptFailure = true;
  await navigate(`/messages/${message}?historyTenantId=${tenant}`);
  await contains(en["providerAttempts.title"]);
  await contains(en["common.errorTitle"]);
  assert.ok(!(await text()).includes("fixture-account"));
  passed("failed provider history remains an error without fake targets");
  }
  assert.ok(requests.every((row) => row.authorized && (row.method === "GET" || (notificationsOnly && row.method==='PATCH' && (/\/notifications\/[0-9a-f-]+\/read$/.test(row.path)||row.path.endsWith('/notifications/read-all'))) || (messagesOnly && row.method === "POST" && row.path === `/fixture-api/api/v1/tenants/${tenant}/applications/${application}/messages`))));
  assert.deepEqual(unknown, []);
  assert.deepEqual(exceptions, []);
  await writeFile(
    path.join(artifacts, "results.json"),
    JSON.stringify(
      {
        browser: version.Browser,
        fixtureOnly: !notificationsOnly,
        syntheticAuthentication: true,
        realIssuerVerified: false,
        realPersistenceVerified: notificationsOnly,
        checks,
        readRequests: requests.filter(row=>row.method==='GET').length,
        externalOriginsBlocked: [...new Set(blocked)],
        mutationRequests: requests.filter((row) => row.method !== "GET").length,
        mutationsAreSyntheticReceiptsOnly: messagesOnly,
        notificationsUseRealLocalPostgres: notificationsOnly,
      },
      null,
      2,
    ),
  );
  console.log(`Artifacts: ${artifacts}`);
  await Promise.race([send("Browser.close", {}, null).catch(() => {}), delay(2000)]);
} catch (error) {
  await writeFile(
    path.join(artifacts, "failure.json"),
    JSON.stringify(
      {
        fixtureOnly: true,
        checks,
        requests,
        unknown,
        exceptions,
        blockedOrigins: [...new Set(blocked)],
      },
      null,
      2,
    ),
  );
  console.error(
    `Fixture browser checks failed: ${error instanceof Error ? error.message : "unknown"}`,
  );
  console.error(`Fixture artifacts: ${artifacts}`);
  process.exitCode = 1;
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    const stopped = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill();
    await Promise.race([stopped, delay(3000)]);
  }
  await vite?.close();
  await notificationBridge?.close();
  const resolved = path.resolve(profile);
  if (
    path.dirname(resolved).toLowerCase() !== path.resolve(os.tmpdir()).toLowerCase() ||
    !path.basename(resolved).startsWith("dolf-browser-profile-")
  )
    throw new Error("Unsafe browser profile cleanup path");
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
