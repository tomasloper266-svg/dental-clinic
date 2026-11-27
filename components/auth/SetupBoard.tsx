"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  MailCheck,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

// لوحة الإعداد بعد التسجيل: استكمال بيانات العيادة والطبيب، وربط بريد
// موثق برمز تحقق، وتوضيح حالة قنوات إرسال الرموز (SMS/بريد) بشفافية.

type Overview = {
  name: string;
  clinicName: string;
  email: string | null;
  emailVerified: boolean;
  channels: { smsConfigured: boolean; emailConfigured: boolean };
};

export default function SetupBoard() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/account");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setLoadError(t("settings.accountLoadFailed"));
        return;
      }
      setOverview((await res.json()) as Overview);
    } catch {
      setLoadError(t("errors.serverRefresh"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="rounded-panel border border-danger-100 bg-danger-50 p-6 text-center text-sm text-danger-700">
        {loadError}
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="animate-pulse space-y-4" aria-label={t("common.loadingShort")}>
        <div className="h-24 rounded-panel bg-warm-100" />
        <div className="h-40 rounded-panel bg-warm-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[25px] font-normal leading-[1.45] text-ink-900">{t("setup.clinicSetup")}</h1>
        <p className="mt-2 text-sm text-warm-600">
          {t("setup.twoStepsLeft")}
        </p>
      </header>

      <ProfileCard overview={overview} onSaved={load} />
      <EmailCard overview={overview} onVerified={load} />
      <ChannelNotice channels={overview.channels} />

      <div className="flex justify-end">
        <Link
          href="/dashboard"
          className="rounded-field bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          {t("notFound.goToDashboard")}
        </Link>
      </div>
    </div>
  );
}

// ─── بطاقة البيانات: اسم الطبيب واسم العيادة ────────────────────────────────

function ProfileCard({
  overview,
  onSaved,
}: {
  overview: Overview;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(overview.name);
  const [clinicName, setClinicName] = useState(overview.clinicName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, clinicName }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("common.saveFailedRetry"));
        return;
      }
      setSaved(true);
      onSaved();
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-panel bg-surface-raised p-6 ring-1 ring-warm-200"
      aria-label={t("setup.doctorClinicData")}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <Stethoscope size={18} className="text-primary-700" aria-hidden />
        {t("setup.doctorClinicData")}
      </h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label={t("staff.doctorName")} htmlFor="su-name">
          <Input
            id="su-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label={t("settings.clinicName")}
          htmlFor="su-clinic"
          hint={t("setup.nameShownOnDocs")}
        >
          <Input
            id="su-clinic"
            required
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="mt-4 text-sm text-primary-700">
          {t("common.savedToast")}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" loading={saving}>
          {t("settings.saveData")}
        </Button>
        <span className="text-xs text-warm-500">
          {t("api.account.phoneImmutable")}
        </span>
      </div>
    </form>
  );
}

// ─── بطاقة البريد الموثق: OTP ثم تأكيد ──────────────────────────────────────

function EmailCard({
  overview,
  onVerified,
}: {
  overview: Overview;
  onVerified: () => void;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState(overview.email ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const verified = overview.emailVerified;

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      fallbackCode?: string;
    };
    return { res, data };
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { res, data } = await post({ action: "request", email });
      if (!res.ok) {
        setError(data.error ?? t("api.otp.sendFailed"));
        return;
      }
      setFallbackCode(
        typeof data.fallbackCode === "string" ? data.fallbackCode : null,
      );
      setStep("code");
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setSaving(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { res, data } = await post({ action: "verify", email, code });
      if (!res.ok) {
        setError(data.error ?? t("api.otp.verifyFailed"));
        return;
      }
      setStep("idle");
      setCode("");
      onVerified();
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-panel bg-surface-raised p-6 ring-1 ring-warm-200"
      aria-label={t("auth.verifiedEmail")}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <MailCheck size={18} className="text-primary-700" aria-hidden />
        {t("auth.verifiedEmail")}
      </h2>
      <p className="mt-2 text-sm text-warm-600">
        {t("settings.emailRecoveryShort")}
      </p>

      {verified ? (
        <p className="mt-4 flex items-center gap-2 rounded-field bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
          <BadgeCheck size={16} aria-hidden />
          {t("settings.linkedAndVerified")} <span dir="ltr">{overview.email}</span>
        </p>
      ) : step === "code" ? (
        <form onSubmit={onVerify} className="mt-4 space-y-4" aria-label={t("settings.verifyEmailCode")}>
          {fallbackCode && (
            <p className="rounded-field border border-warm-300 bg-warm-100 px-3 py-2.5 text-sm text-warm-800">
              {t("settings.noEmailService")}{" "}
              <strong dir="ltr" className="numeric tracking-widest">
                {fallbackCode}
              </strong>
            </p>
          )}
          <Field label={t("common.verificationCode")} htmlFor="su-code">
            <Input
              id="su-code"
              inputMode="numeric"
              dir="ltr"
              required
              maxLength={6}
              className="numeric text-center text-lg tracking-[0.4em]"
              placeholder="••••••"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </Field>
          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}
          <Button type="submit" loading={saving}>
            {t("settings.verifyEmail")}
          </Button>
        </form>
      ) : (
        <form onSubmit={onRequest} className="mt-4 space-y-4" aria-label={t("settings.linkVerifiedEmail")}>
          <Field label={t("common.email")} htmlFor="su-email">
            <Input
              id="su-email"
              type="email"
              dir="ltr"
              required
              className="text-left"
              placeholder="doctor@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}
          <Button type="submit" loading={saving}>
            {t("settings.sendCode")}
          </Button>
        </form>
      )}
    </section>
  );
}

// ─── حالة قنوات الإرسال — شفافية كاملة عن ما هو مربوط ───────────────────────

function ChannelNotice({
  channels,
}: {
  channels: { smsConfigured: boolean; emailConfigured: boolean };
}) {
  const { t } = useI18n();
  const label = (ok: boolean) => (ok ? t("settings.channelsLinked") : t("settings.channelsNotLinked"));
  return (
    <p className="flex items-start gap-2 rounded-field border border-warm-300 bg-warm-100 px-3 py-2.5 text-sm text-warm-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        {t("settings.codesViaSms")} {label(channels.smsConfigured)} {t("setup.emailSuffix")}{" "}
        {label(channels.emailConfigured)}{t("settings.providerEnvHint")}
      </span>
    </p>
  );
}
