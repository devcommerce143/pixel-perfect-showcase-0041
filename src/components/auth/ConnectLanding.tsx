import {
  ArrowRight,
  ArrowDown,
  Globe2,
  Mail,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  AppWindow,
  Layers3,
  LoaderCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n";

export function ConnectLanding({
  onSignIn,
  busy,
  disabled,
  children,
}: {
  onSignIn: () => void;
  busy: boolean;
  disabled: boolean;
  children?: ReactNode;
}) {
  const { t, locale, setLocale } = useI18n();
  const signIn = (compact = false) => (
    <Button
      onClick={onSignIn}
      disabled={disabled}
      size={compact ? "default" : "lg"}
      className="rounded-full px-6"
    >
      {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {t(busy ? "auth.signingIn" : "auth.signIn")}
      {!busy && <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />}
    </Button>
  );
  return (
    <main className="min-h-svh bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <img src="/logo-light.png" alt={t("app.name")} className="h-14 w-48 object-contain sm:h-16 sm:w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            aria-label={t("header.language")}
          >
            <Globe2 className="size-4" aria-hidden="true" />
            {locale === "en" ? "العربية" : "English"}
          </Button>
          {signIn(true)}
        </div>
      </header>

      <section className="relative isolate overflow-hidden px-6 pb-16 pt-12 text-center sm:pt-20 lg:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-10 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-primary/10 blur-3xl"
        />
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-xs font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {t("landing.eyebrow")}
        </p>
        <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          {t("landing.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {t("landing.description")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {signIn()}
          <a
            href="#channels"
            className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t("landing.explore")}
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </div>
        {children && <div className="mx-auto mt-6 max-w-xl text-start">{children}</div>}

        <div
          id="channels"
          className="mx-auto mt-16 max-w-5xl scroll-mt-8 rounded-3xl border bg-card p-6 shadow-panel sm:p-10"
        >
          <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-sidebar px-6 py-4 text-sidebar-foreground">
            <Layers3 className="size-6 text-sidebar-primary" aria-hidden="true" />
            <span className="font-semibold">{t("app.name")}</span>
          </div>
          <div aria-hidden="true" className="mx-auto h-8 w-px bg-border" />
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                {
                  icon: MessageSquareText,
                  channel: "channel.sms",
                  detail: "landing.sms",
                  tone: "text-channel-sms",
                },
                {
                  icon: Mail,
                  channel: "channel.email",
                  detail: "landing.email",
                  tone: "text-channel-email",
                },
                {
                  icon: MessageCircle,
                  channel: "channel.whatsapp",
                  detail: "landing.whatsapp",
                  tone: "text-channel-whatsapp",
                },
              ] as const
            ).map(({ icon: Icon, channel, detail, tone }) => (
              <div key={channel} className="rounded-2xl border bg-background p-6 text-start">
                <Icon className={`size-7 ${tone}`} aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold">{t(channel)}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(detail)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-20 sm:grid-cols-3 lg:px-10">
        {(
          [
            { icon: AppWindow, title: "landing.workspace", body: "landing.workspaceBody" },
            { icon: ShieldCheck, title: "landing.access", body: "landing.accessBody" },
            { icon: Layers3, title: "landing.integrate", body: "landing.integrateBody" },
          ] as const
        ).map(({ icon: Icon, title, body }) => (
          <div key={title} className="border-t pt-6">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">{t(title)}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(body)}</p>
          </div>
        ))}
      </section>
      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        {t("app.name")} · {t("auth.footer")}
      </footer>
    </main>
  );
}
