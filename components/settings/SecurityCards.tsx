"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useState } from "react";
import { KeyRound, MailCheck, RadioTower, ShieldCheck } from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useToast } from "@/components/ui/Toast";

// بطاقات «الحساب والأمان»: تغيير كلمة السر، إدارة البريد الموثق، وشفافية
// حالة قنوات الإرسال. كلها تعمل عبر واجهات برمجة الحساب بمعرف الجلسة.

type ChannelStatus = { smsConfigured: boolean; emailConfigured: boolean };
type ChannelDetail = ChannelStatus & {
  requiredEnvKeys: Record<"SMS" | "EMAIL", string[]>;
};

export type SecurityOverview = {
  email: string | null;
  emailVerified: boolean;
  channels: ChannelDetail;
};

// ─── تغيير كلمة السر ────────────────────────────────────────────────────────

export function PasswordCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mismatch =
    confirm.length > 0 && newPassword !== confirm ? t("api.auth.confirmationMismatch") : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(t("api.auth.confirmationMismatch"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string; otherSessionsRevoked?: number };
      if (!res.ok) {
        setError(data.error ?? t("api.auth.passwordChangeFailed"));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      const revoked = data.otherSessionsRevoked ?? 0;
      toast(
        revoked > 0
          ? `تم تغيير كلمة السر — وتم إبطال ${revoked} جلسة على أجهزة أخرى`
          : t("api.auth.passwordChanged"),
      );
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
      aria-label={t("settings.changePassword")}
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <KeyRound size={18} className="text-primary-700" aria-hidden />
        {t("settings.changePassword")}
      </h3>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label={t("settings.currentPassword")} htmlFor="sec-current">
          <PasswordInput
            id="sec-current"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>
        <Field
          label={t("settings.newPassword")}
          htmlFor="sec-new"
          hint={t("auth.min8")}
          error={mismatch}
        >
          <PasswordInput
            id="sec-new"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-invalid={mismatch ? true : undefined}
          />
        </Field>
        <Field label={t("settings.newPasswordConfirm")} htmlFor="sec-confirm" error={undefined}>
          <PasswordInput
            id="sec-confirm"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch ? true : undefined}
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

      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" loading={saving} disabled={Boolean(mismatch)}>
          {t("settings.updatePassword")}
        </Button>
        <span className="text-xs text-warm-500">
          {t("settings.otherSessionsRevoked")}
        </span>
      </div>
    </form>
  );
}

// ─── البريد الموثق — إضافة أو تغيير ─────────────────────────────────────────

type EmailStep = "idle" | "code";

export function EmailCard({
  overview,
  onVerified,
}: {
  overview: SecurityOverview;
  onVerified: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(overview.email ?? "");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<EmailStep>("idle");
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
      setEditing(false);
      onVerified();
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setSaving(false);
    }
  }

  const showForm = editing || !verified;

  return (
    <section
      className="rounded-panel bg-surface-raised p-6 ring-1 ring-warm-200"
      aria-label={t("auth.verifiedEmail")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <MailCheck size={18} className="text-primary-700" aria-hidden />
          {t("auth.verifiedEmail")}
        </h3>
        {verified ? (
          <Badge tone="success">{t("settings.verified")}</Badge>
        ) : (
          <Badge tone="warning">{t("settings.notVerifiedYet")}</Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-warm-600">
        {t("settings.emailRecoveryHint")}
      </p>

      {verified && !showForm ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-field bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} aria-hidden />
            {t("settings.linkedAndVerified")} <span dir="ltr">{overview.email}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {t("settings.changeEmail")}
          </Button>
        </div>
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
          <Field label={t("common.verificationCode")} htmlFor="sec-code" hint={`أُرسل إلى ${email}`}>
            <Input
              id="sec-code"
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
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              {t("settings.verifyEmail")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep("idle");
                setCode("");
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={onRequest} className="mt-4 space-y-4" aria-label={t("settings.linkVerifiedEmail")}>
          <Field
            label={t("common.email")}
            htmlFor="sec-email"
            hint={verified ? t("settings.newEmailHint") : undefined}
          >
            <Input
              id="sec-email"
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
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              {t("settings.sendCode")}
            </Button>
            {verified && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

// ─── شفافية قنوات الإرسال ───────────────────────────────────────────────────

function ChannelRow({
  label,
  configured,
  envKeys,
}: {
  label: string;
  configured: boolean;
  envKeys: string[];
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-warm-200 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-ink-900">
        <RadioTower size={16} className="text-warm-500" aria-hidden />
        {label}
      </span>
      <span className="flex items-center gap-2">
        {configured ? (
          <StatusPill tone="success">{t("settings.channelsLinkedAuto")}</StatusPill>
        ) : (
          <StatusPill tone="warning">{t("settings.channelsUnlinked")}</StatusPill>
        )}
        <code dir="ltr" className="hidden text-xs text-warm-500 sm:inline">
          {envKeys.join(" + ")}
        </code>
      </span>
    </div>
  );
}

export function ChannelsCard({ channels }: { channels: ChannelDetail }) {
  const { t } = useI18n();
  return (
    <section
      className="rounded-panel bg-surface-raised p-6 ring-1 ring-warm-200"
      aria-label={t("settings.channelsStatus")}
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink-900">
        <RadioTower size={18} className="text-primary-700" aria-hidden />
        {t("settings.channels")}
      </h3>
      <p className="mt-2 text-sm text-warm-600">
        {t("settings.linkingServerOnly")}
      </p>
      <div className="mt-4 space-y-2">
        <ChannelRow
          label={t("settings.sms")}
          configured={channels.smsConfigured}
          envKeys={channels.requiredEnvKeys.SMS}
        />
        <ChannelRow
          label={t("common.email")}
          configured={channels.emailConfigured}
          envKeys={channels.requiredEnvKeys.EMAIL}
        />
      </div>
    </section>
  );
}
