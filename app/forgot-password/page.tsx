"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FallbackCodeNotice } from "@/components/auth/FallbackCodeNotice";
import { SupportPhoneCard } from "@/components/auth/SupportPhoneCard";
import { useI18n } from "@/components/i18n/I18nProvider";

// مسار «نسيت كلمة المرور» — ثلاثة تبويبات:
// «Send a Code»: رمز تحقق عبر الهاتف أو البريد الموثق (ثلاث خطوات).
// «Recovery Code»: تعيين كلمة سر جديدة بحيازة رمز الاسترداد الاحتياطي
// (حيازته تثبت الملكية). «Support»: بطاقة رقم الدعم المشتركة.
// التصميم مطابق لصفحات المصادقة: حقول رمادية فاتحة بنص يسار، عنوان أسود
// عريض، زر أزرق ثابت اللون، والنصوص من قاموس لغة الجلسة.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

type Step = "identifier" | "code" | "newPassword" | "done";

type Path = "sendCode" | "recoveryCode" | "support";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [path, setPath] = useState<Path>("sendCode");
  const [step, setStep] = useState<Step>("identifier");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [destinationHint, setDestinationHint] = useState("");
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  function identifierPayload(): Record<string, string> {
    return mode === "phone" ? { phone } : { email };
  }

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string; [k: string]: unknown };
    return { res, data };
  }

  async function requestCode() {
    setError(null);
    setSubmitting(true);
    try {
      const { res, data } = await postJson(
        "/api/auth/forgot-password",
        identifierPayload(),
      );
      if (!res.ok) {
        setError(data.error ?? t("auth.error.sendCode"));
        return false;
      }
      setDestinationHint(String(data.destinationHint ?? ""));
      setFallbackCode(
        typeof data.fallbackCode === "string" ? data.fallbackCode : null,
      );
      setResendIn(RESEND_SECONDS);
      return true;
    } catch {
      setError(t("auth.error.server"));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitIdentifier(e: React.FormEvent) {
    e.preventDefault();
    if (await requestCode()) setStep("code");
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { res, data } = await postJson("/api/auth/verify-reset-code", {
        ...identifierPayload(),
        code,
      });
      if (!res.ok) {
        setError(data.error ?? t("auth.error.verifyCode"));
        return;
      }
      setStep("newPassword");
    } catch {
      setError(t("auth.error.server"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError(t("auth.error.passwordMismatch"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { res, data } = await postJson("/api/auth/reset-password", {
        ...identifierPayload(),
        code,
        newPassword,
      });
      if (!res.ok) {
        setError(data.error ?? t("auth.error.setPassword"));
        return;
      }
      setStep("done");
    } catch {
      setError(t("auth.error.server"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      greetingTitle={t("auth.greeting")}
      greetingSubtitle={t("auth.rememberedPassword")}
      ctaLabel={t("auth.login")}
      ctaHref="/login"
    >
      <div
        role="tablist"
        aria-label={t("auth.tab.recoveryMethod")}
        className="grid grid-cols-3 gap-1 rounded-[10px] bg-[#e7e9f2] p-1"
      >
        {(
          [
            ["sendCode", t("auth.tab.sendCode")],
            ["recoveryCode", t("auth.tab.recoveryCode")],
            ["support", t("auth.tab.support")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={path === value}
            onClick={() => setPath(value)}
            className={`rounded-[8px] px-1 py-2.5 text-[13px] font-medium transition-colors ${
              path === value
                ? "bg-white text-[#16181d] shadow-sm"
                : "text-[#9aa0b5] hover:text-[#25293c]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-7">
      {path === "sendCode" && (
      <>
      {step === "identifier" && (
        <section aria-labelledby="forgot-title">
          <h1
            id="forgot-title"
            className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
          >
            {t("auth.forgotPassword.title")}
          </h1>
          <p className="mt-2 text-center text-sm text-[#6a6f83]">
            {t("auth.forgotPassword.description")}
          </p>

          <form onSubmit={onSubmitIdentifier} className="mt-8 space-y-4">
            {/* اختيار القناة — تبويبان حقيقيان يغيّران الحقل أدناه */}
            <div
              role="tablist"
              aria-label={t("auth.tab.recoveryChannel")}
              className="grid grid-cols-2 gap-1 rounded-[10px] bg-[#e7e9f2] p-1"
            >
              {(
                [
                  ["phone", t("auth.field.phone")],
                  ["email", t("auth.field.verifiedEmail")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-[8px] py-2.5 text-sm font-medium transition-colors ${
                    mode === value
                      ? "bg-white text-[#16181d] shadow-sm"
                      : "text-[#9aa0b5] hover:text-[#25293c]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "phone" ? (
              <input
                id="phone"
                type="tel"
                dir="ltr"
                required
                aria-label={t("auth.field.phone")}
                className={`${INPUT_CLS} px-4 text-left`}
                placeholder="09xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            ) : (
              <input
                id="email"
                type="email"
                dir="ltr"
                required
                aria-label={t("auth.field.verifiedEmail")}
                autoComplete="email"
                className={`${INPUT_CLS} px-4 text-left`}
                placeholder={t("auth.field.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}

            {error && <FormError message={error} />}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "#5B6CE4" }}
            >
              {t("auth.forgotPassword.sendCode")}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            <Link href="/forgot-phone" className="text-[13px] text-[#3d4152] hover:underline">
              {t("auth.forgotPassword.forgotPhoneLink")}
            </Link>
            <Link href="/login" className="text-[13px] text-[#3d4152] hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </div>
        </section>
      )}

      {step === "code" && (
        <section aria-labelledby="code-title">
          <h1
            id="code-title"
            className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
          >
            {t("auth.forgotPassword.codeTitle")}
          </h1>
          <p className="mt-2 text-center text-sm text-[#6a6f83]">
            {destinationHint
              ? t("auth.forgotPassword.codeSentTo", { destination: destinationHint })
              : t("auth.forgotPassword.codeSent")}{" "}
            {t("auth.forgotPassword.codeValidity")}
          </p>

          {fallbackCode && (
            <div className="mt-5">
              <FallbackCodeNotice
                code={fallbackCode}
                destinationHint={destinationHint}
              />
            </div>
          )}

          <form onSubmit={onSubmitCode} className="mt-6 space-y-4">
            <input
              id="code"
              inputMode="numeric"
              dir="ltr"
              required
              maxLength={6}
              aria-label={t("auth.field.verificationCode")}
              autoComplete="one-time-code"
              className={`${INPUT_CLS} text-center text-lg tracking-[0.4em]`}
              placeholder="••••••"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />

            {error && <FormError message={error} />}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "#5B6CE4" }}
            >
              {t("auth.forgotPassword.verifyCode")}
            </button>

            <div className="flex items-center justify-between text-[13px]">
              <button
                type="button"
                onClick={requestCode}
                disabled={resendIn > 0 || submitting}
                className="font-medium text-[#4a5cd9] hover:underline disabled:text-[#9aa0b5] disabled:hover:no-underline"
              >
                {resendIn > 0
                  ? t("auth.forgotPassword.resendIn", { seconds: resendIn })
                  : t("auth.forgotPassword.resend")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("identifier");
                  setError(null);
                }}
                className="text-[#3d4152] hover:underline"
              >
                {t("auth.forgotPassword.editDetails")}
              </button>
            </div>
          </form>
        </section>
      )}

      {step === "newPassword" && (
        <section aria-labelledby="newpass-title">
          <h1
            id="newpass-title"
            className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
          >
            {t("auth.forgotPassword.newPasswordTitle")}
          </h1>
          <p className="mt-2 text-center text-sm text-[#6a6f83]">
            {t("auth.forgotPassword.newPasswordDescription")}
          </p>

          <form onSubmit={onSubmitNewPassword} className="mt-8 space-y-4">
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                dir="ltr"
                autoComplete="new-password"
                aria-label={t("auth.field.newPassword")}
                className={`${INPUT_CLS} pl-12 pr-12 text-left`}
                placeholder={t("auth.field.newPassword")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                aria-pressed={showNewPassword}
                className="absolute inset-y-0 left-3 my-auto flex h-7 w-7 items-center justify-center rounded text-[#25293c] hover:text-[#16181d]"
              >
                {showNewPassword ? (
                  <EyeOff aria-hidden size={18} />
                ) : (
                  <Eye aria-hidden size={18} />
                )}
              </button>
            </div>

            <div className="relative">
              <input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                dir="ltr"
                autoComplete="new-password"
                aria-label={t("auth.field.confirmPassword")}
                className={`${INPUT_CLS} pl-12 pr-12 text-left`}
                placeholder={t("auth.field.confirmPassword")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                aria-pressed={showConfirm}
                className="absolute inset-y-0 left-3 my-auto flex h-7 w-7 items-center justify-center rounded text-[#25293c] hover:text-[#16181d]"
              >
                {showConfirm ? (
                  <EyeOff aria-hidden size={18} />
                ) : (
                  <Eye aria-hidden size={18} />
                )}
              </button>
            </div>

            {error && <FormError message={error} />}

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "#5B6CE4" }}
            >
              {t("auth.forgotPassword.setPassword")}
            </button>
          </form>
        </section>
      )}

      {step === "done" && (
        <section className="rounded-2xl bg-white px-6 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eceefc]">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="#4a5cd9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-bold text-[#16181d]">
            {t("auth.forgotPassword.doneTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6a6f83]">
            {t("auth.forgotPassword.doneDescription")}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block h-12 w-full rounded-[10px] px-4 text-[15px] font-semibold leading-[48px] text-white transition-colors hover:opacity-90"
            style={{ background: "#5B6CE4" }}
          >
            {t("auth.login")}
          </Link>
        </section>
      )}
      </>
      )}
      {path === "recoveryCode" && <RecoveryCodeResetPath />}
      {path === "support" && <SupportPhoneCard />}
      </div>
    </AuthShell>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-[#f3c8c8] bg-[#fdeeee] px-3 py-2.5 text-sm text-[#b23a3a]"
    >
      {message}
    </p>
  );
}

// ─── تبويب رمز الاسترداد — تعيين كلمة سر جديدة بحيازة الرمز ──────────────

function RecoveryCodeResetPath() {
  const { t } = useI18n();
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError(t("auth.error.passwordMismatch"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password/recovery-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCode, newPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.error.setPassword"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("auth.error.server"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-2xl bg-white px-6 py-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eceefc]">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="#4a5cd9"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-[#16181d]">
          {t("auth.forgotPassword.doneTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#6a6f83]">
          {t("auth.forgotPassword.doneDescription")}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block h-12 w-full rounded-[10px] px-4 text-[15px] font-semibold leading-[48px] text-white transition-colors hover:opacity-90"
          style={{ background: "#5B6CE4" }}
        >
          {t("auth.login")}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="rc-reset-title">
      <h1
        id="rc-reset-title"
        className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
      >
        {t("auth.tab.recoveryCode")}
      </h1>
      <p className="mt-2 text-center text-sm text-[#6a6f83]">
        {t("auth.forgotPassword.recoveryDescription")}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          id="rc-reset"
          dir="ltr"
          required
          aria-label={t("auth.field.recoveryCode")}
          className={`${INPUT_CLS} px-4 text-left tracking-widest`}
          placeholder="XXXX-XXXX-XXXX"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
        />

        <div className="relative">
          <input
            id="rc-newPassword"
            type={showNewPassword ? "text" : "password"}
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            aria-label={t("auth.field.newPassword")}
            className={`${INPUT_CLS} pl-12 pr-12 text-left`}
            placeholder={t("auth.field.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            aria-label={showNewPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            aria-pressed={showNewPassword}
            className="absolute inset-y-0 left-3 my-auto flex h-7 w-7 items-center justify-center rounded text-[#25293c] hover:text-[#16181d]"
          >
            {showNewPassword ? (
              <EyeOff aria-hidden size={18} />
            ) : (
              <Eye aria-hidden size={18} />
            )}
          </button>
        </div>

        <div className="relative">
          <input
            id="rc-confirm"
            type={showConfirm ? "text" : "password"}
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            aria-label={t("auth.field.confirmPassword")}
            className={`${INPUT_CLS} pl-12 pr-12 text-left`}
            placeholder={t("auth.field.confirmPassword")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
            aria-pressed={showConfirm}
            className="absolute inset-y-0 left-3 my-auto flex h-7 w-7 items-center justify-center rounded text-[#25293c] hover:text-[#16181d]"
          >
            {showConfirm ? (
              <EyeOff aria-hidden size={18} />
            ) : (
              <Eye aria-hidden size={18} />
            )}
          </button>
        </div>

        {error && <FormError message={error} />}

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
          className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "#5B6CE4" }}
        >
          {t("auth.forgotPassword.setPassword")}
        </button>
      </form>
    </section>
  );
}
