import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Activity, AppWindow, ArrowRight, BadgeCheck, Boxes, Eye, EyeOff, Globe2, LockKeyhole, Mail, MessageCircle, MessageSquareText, PanelsTopLeft, ShieldCheck, Zap, LoaderCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth/session";
import { useI18n, type Locale } from "@/lib/i18n/i18n";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search["returnTo"] === "string" ? search["returnTo"] : undefined,
  }),
  head: () => pageHead("Sign in", "Sign in to Dolf Connect."),
  component: LoginPage,
});

const FLOW_SOURCES = [
  { icon: AppWindow, title: "auth.flowSourceApplication", detail: "auth.flowSourceApplicationHint" },
  { icon: PanelsTopLeft, title: "auth.flowSourcePortal", detail: "auth.flowSourcePortalHint" },
  { icon: Boxes, title: "auth.flowSourceSystems", detail: "auth.flowSourceSystemsHint" },
] as const;
const FLOW_DESTINATIONS = [
  { icon: MessageCircle, title: "channel.whatsapp", detail: "auth.flowWhatsappBusiness", tone: "login-destination-whatsapp" },
  { icon: Mail, title: "channel.email", detail: "auth.flowEmailTypes", tone: "login-destination-email" },
  { icon: MessageSquareText, title: "channel.sms", detail: "auth.flowSmsCoverage", tone: "login-destination-sms" },
] as const;

function safeDestination(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || url.pathname === "/login") return "/";
  return url;
}

function LoginPage() {
  const { t, locale, setLocale } = useI18n();
  const { signIn, status } = useSession();
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"auth.invalidCredentials" | "auth.unavailable" | "">("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const updateMotionPreference = () => setMotionEnabled(motionPreference.matches);
    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);
    return () => motionPreference.removeEventListener("change", updateMotionPreference);
  }, []);

  const normalizedEmail = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const emailError = submitted && !emailValid;
  const passwordError = submitted && password.length === 0;
  const disabled = busy || status === "loading";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setError("");
    if (!emailValid || password.length === 0 || disabled) return;

    setBusy(true);
    try {
      await signIn(normalizedEmail, password, remember);
      const destination = safeDestination(search.returnTo);
      if (typeof destination === "string") {
        await navigate({ to: destination as never, replace: true });
      } else {
        const searchParams = Object.fromEntries(destination.searchParams);
        await router.navigate({
          to: destination.pathname as never,
          search: searchParams as never,
          hash: destination.hash.slice(1) as never,
          replace: true,
        } as never);
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "invalid_credentials" ? "auth.invalidCredentials" : "auth.unavailable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_18%_0%,oklch(0.93_0.035_238),transparent_48%),linear-gradient(135deg,oklch(0.96_0.018_240),var(--background)_58%)] p-3 sm:p-5 lg:p-6">
      <div className="relative mx-auto w-full max-w-[1440px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div className="grid overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_24px_80px_-32px_oklch(0.28_0.07_245/0.32)] lg:min-h-[calc(100svh-8rem)] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="login-visual-panel relative isolate flex flex-col overflow-hidden bg-sidebar p-6 text-sidebar-foreground sm:p-8 lg:justify-between xl:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(145deg,transparent_15%,oklch(0.24_0.055_245/0.88)_68%,oklch(0.18_0.045_250)),radial-gradient(ellipse_at_82%_8%,oklch(0.36_0.11_245/0.72),transparent_35%)]" aria-hidden="true" />
            <div className="relative z-10 flex items-center gap-3">
              <img src="/connect-logo.png" alt="" aria-hidden="true" className="size-11 rounded-md bg-white object-contain p-1.5 shadow-panel" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-sidebar-accent-foreground">{t("app.name")}</div>
                <div className="mt-1 text-xs text-sidebar-muted">{t("app.tagline")}</div>
              </div>
            </div>

            <div className="relative z-10 mt-7 lg:mt-0">
              <p className="text-label text-sidebar-primary">{t("auth.welcomeBack")}</p>
              <h1 className="mt-3 max-w-xl text-2xl font-semibold leading-tight text-sidebar-accent-foreground sm:text-3xl xl:text-4xl">{t("auth.welcome")}</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-sidebar-muted">{t("auth.description")}</p>
            </div>

            <div className="relative z-10 mt-7 login-scene-enter lg:mt-0">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-sidebar-primary">{t("auth.flowEyebrow")}</p>
                  <h2 className="mt-1 text-sm font-semibold text-sidebar-accent-foreground">{t("auth.flowTitle")}</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[0.625rem] text-sidebar-muted"><span className="login-activity-dot size-1.5 rounded-full bg-success" />{t("auth.flowLive")}</span>
              </div>

              <div className="login-flow-scene relative h-[300px] overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(145deg,oklch(0.19_0.03_255/0.88),oklch(0.16_0.025_258/0.7))] sm:h-[320px]">
                <div className="login-flow-labels absolute top-[3%] grid grid-cols-[34%_21%] justify-between text-[0.5625rem] font-semibold text-sidebar-muted">
                  <span>{t("auth.flowSources")}</span>
                  <span className="text-end">{t("auth.flowDestinations")}</span>
                </div>

                <svg className="login-flow-svg absolute inset-0 size-full text-sidebar-primary" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <marker id="login-flow-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3 L0 6 Z" fill="currentColor" /></marker>
                  </defs>
                  <path className="login-route-base" d="M340 65 C365 65 365 140 405 150 M340 150 C365 150 365 150 405 150 M340 235 C365 235 365 160 405 150" />
                  <path className="login-route-active" d="M340 65 C365 65 365 140 405 150 M340 150 C365 150 365 150 405 150 M340 235 C365 235 365 160 405 150" />
                  <path className="login-route-base" d="M660 150 C720 150 735 65 800 65 M660 150 C720 150 735 150 800 150 M660 150 C720 150 735 235 800 235" />
                  <path className="login-route-active" markerEnd="url(#login-flow-arrow)" d="M660 150 C720 150 735 65 800 65 M660 150 C720 150 735 150 800 150 M660 150 C720 150 735 235 800 235" />
                  <circle className="login-route-junction" cx="405" cy="150" r="4" />
                  <circle className="login-route-junction" cx="660" cy="150" r="4" />
                  {["M 340 65 C 365 65 365 140 405 150", "M 340 150 C 365 150 365 150 405 150", "M 340 235 C 365 235 365 160 405 150", "M 660 150 C 720 150 735 65 800 65", "M 660 150 C 720 150 735 150 800 150", "M 660 150 C 720 150 735 235 800 235"].map((path, index) => (
                    <circle key={path} className={`login-message-packet login-message-packet-${index + 1}`} r="4" aria-hidden="true">
                      {motionEnabled && <animateMotion dur={index < 3 ? "3.8s" : "3.2s"} begin={`${index % 3 * 0.55}s`} repeatCount="indefinite" path={path} />}
                    </circle>
                  ))}
                </svg>

                {FLOW_SOURCES.map(({ icon: Icon, title, detail }, index) => (
                  <div key={title} className="login-flow-source absolute start-0 end-[66%] flex h-[17%] items-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-2 sm:px-2.5" style={{ top: `${13 + index * 28}%` }}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-white/[0.08]"><Icon className="login-source-icon size-3.5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[0.625rem] font-semibold text-sidebar-accent-foreground sm:text-[0.6875rem]">{t(title)}</span><span className="mt-0.5 block truncate text-[0.5rem] text-sidebar-muted sm:text-[0.5625rem]">{t(detail)}</span></span>
                    <ArrowRight className="login-source-arrow size-3 shrink-0 text-sidebar-muted rtl:rotate-180" aria-hidden="true" />
                  </div>
                ))}

                <div className="login-flow-hub absolute start-[40.5%] top-[10%] flex h-[80%] w-[25.5%] flex-col justify-center rounded-lg border border-sidebar-primary/35 bg-sidebar-accent/90 p-2.5 shadow-overlay sm:p-3">
                  <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
                    <img src="/connect-logo.png" alt="" aria-hidden="true" className="size-7 rounded-sm bg-white p-1 object-contain" />
                    <span className="min-w-0"><span className="block truncate text-[0.625rem] font-semibold text-sidebar-accent-foreground sm:text-xs">{t("auth.flowHub")}</span><span className="mt-0.5 block truncate text-[0.5rem] text-sidebar-muted">{t("auth.flowHubSubtitle")}</span></span>
                  </div>
                  <div className="space-y-2 text-[0.5rem] text-sidebar-accent-foreground sm:text-[0.5625rem]">
                    <span className="flex items-center gap-1.5"><Zap className="size-3 shrink-0 text-sidebar-primary" aria-hidden="true" />{t("auth.flowSmartRouting")}</span>
                    <span className="flex items-center gap-1.5"><ShieldCheck className="size-3 shrink-0 text-channel-whatsapp" aria-hidden="true" />{t("auth.flowFailover")}</span>
                    <span className="flex items-center gap-1.5"><Activity className="size-3 shrink-0 text-channel-sms" aria-hidden="true" />{t("auth.flowTracking")}</span>
                    <span className="flex items-center gap-1.5"><LockKeyhole className="size-3 shrink-0 text-channel-email" aria-hidden="true" />{t("auth.flowCompliance")}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2">
                    <span className="text-sm font-semibold leading-none text-sidebar-accent-foreground">98.2%</span>
                    <span className="min-w-0 text-[0.5rem] leading-tight text-sidebar-muted">{t("auth.flowDeliveryRate")}</span>
                  </div>
                </div>

                {FLOW_DESTINATIONS.map(({ icon: Icon, title, detail, tone }, index) => (
                  <div key={title} className={`login-flow-destination absolute start-[79%] flex h-[17%] w-[21%] items-center gap-1.5 rounded-md border px-1.5 sm:gap-2 sm:px-2 ${tone}`} style={{ top: `${13 + index * 28}%` }}>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-white/[0.08]"><Icon className="size-3.5" aria-hidden="true" /></span>
                    <span className="min-w-0"><span className="block truncate text-[0.5625rem] font-semibold text-sidebar-accent-foreground sm:text-[0.625rem]">{t(title)}</span><span className="mt-0.5 block truncate text-[0.4375rem] text-sidebar-muted sm:text-[0.5rem]">{t(detail)}</span></span>
                    <BadgeCheck className="login-delivery-check ms-auto size-3 shrink-0" aria-hidden="true" />
                  </div>
                ))}

                <div className="absolute inset-x-3 bottom-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[0.5rem] text-sidebar-muted sm:inset-x-4 sm:text-[0.5625rem]">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate"><Activity className="size-3 shrink-0 text-sidebar-primary" aria-hidden="true" />{t("auth.flowActivity")}</span>
                  <span className="inline-flex shrink-0 items-center gap-1"><span className="login-activity-dot size-1 rounded-full bg-success" />{t("auth.flowEvent")}</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-6 flex items-center gap-3 border-t border-sidebar-border pt-4 text-[0.6875rem] leading-4 text-sidebar-muted lg:mt-5">
              <ShieldCheck className="size-5 shrink-0 text-sidebar-primary" aria-hidden="true" />
              <span className="max-w-md">{t("auth.securityNote")}</span>
              <div className="ms-auto hidden items-center gap-3 text-[0.625rem] text-sidebar-muted xl:flex">
                <span>{t("channel.sms")}</span><span>{t("channel.email")}</span><span>{t("channel.whatsapp")}</span><span>API</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col px-5 py-5 sm:px-9 sm:py-7 lg:px-10 xl:px-14 xl:py-8">
            <div className="flex justify-end">
              <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-xs" aria-label={t("header.language")}>
                <Globe2 className="ms-2 size-3.5 text-muted-foreground" aria-hidden="true" />
                {(["en", "ar"] as const).map((language) => (
                  <Button key={language} type="button" size="sm" variant={locale === language ? "secondary" : "ghost"} className="h-7 rounded-full px-3 text-xs" aria-pressed={locale === language} onClick={() => setLocale(language as Locale)}>
                    {language === "en" ? "EN" : "عربي"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-5 sm:py-7">
              <div className="mb-6">
                <p className="text-label text-primary">{t("auth.welcomeBack")}</p>
                <h2 className="mt-2 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{t("auth.panelTitle")}</h2>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{t("auth.signInDescription")}</p>
              </div>

              <form className="space-y-4" onSubmit={submit} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">{t("auth.email")}</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="login-email" type="email" autoComplete="username" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-background ps-10 text-start" aria-invalid={emailError} aria-describedby={emailError ? "login-email-error" : undefined} disabled={busy} />
                  </div>
                  {emailError && <p id="login-email-error" className="text-xs text-danger">{t(normalizedEmail ? "auth.invalidEmail" : "auth.emailRequired")}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">{t("auth.password")}</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 bg-background ps-10 pe-12 text-start" aria-invalid={passwordError} aria-describedby={passwordError ? "login-password-error" : undefined} disabled={busy} />
                    <Button type="button" variant="ghost" size="icon" className="absolute end-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setShowPassword((visible) => !visible)} aria-label={t(showPassword ? "auth.hidePassword" : "auth.showPassword")} aria-pressed={showPassword} disabled={busy}>
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                  {passwordError && <p id="login-password-error" className="text-xs text-danger">{t("auth.passwordRequired")}</p>}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  <label htmlFor="login-remember" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox id="login-remember" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} disabled={busy} />
                    {t("auth.rememberMe")}
                  </label>
                  <button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => setForgotOpen((open) => !open)}>
                    {t("auth.forgotPassword")}
                  </button>
                </div>
                {forgotOpen && <p role="status" className="rounded-md border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">{t("auth.forgotPasswordInfo")}</p>}
                {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{t(error)}</p>}

                <Button type="submit" className="h-11 w-full shadow-panel" disabled={disabled}>
                  {disabled && <LoaderCircle className="size-4 animate-spin" />}
                  {busy ? t("auth.signingIn") : status === "loading" ? t("auth.restoring") : t("auth.signIn")}
                  {!disabled && <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />}
                </Button>
              </form>

            </div>
          </section>
        </div>
        <footer className="mt-3 flex flex-wrap items-center justify-center gap-x-2 text-center text-[0.6875rem] text-muted-foreground">
          <span>© 2026 Dolftech. {t("auth.footer")}</span><span aria-hidden="true">·</span><span>{t("auth.securityNote")}</span>
        </footer>
      </div>
    </main>
  );
}