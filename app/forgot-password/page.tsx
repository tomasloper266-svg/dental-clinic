"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FallbackCodeNotice } from "@/components/auth/FallbackCodeNotice";

// مسار «نسيت كلمة المرور» — ثلاث خطوات: تحديد الهوية، رمز التحقق، كلمة السر.
// الرمز لا يُستهلك إلا عند التعيين النهائي. التصميم مطابق لصفحتي الدخول
// والتسجيل: حقول رمادية فاتحة بنص يسار، عنوان أسود عريض، زر أزرق ثابت
// اللون، وإنكليزي بالكامل. المنطق ونقاط الـAPI كما كانت دون تغيير.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

type Step = "identifier" | "code" | "newPassword" | "done";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
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
        setError(data.error ?? "Couldn't send the code — please try again");
        return false;
      }
      setDestinationHint(String(data.destinationHint ?? ""));
      setFallbackCode(
        typeof data.fallbackCode === "string" ? data.fallbackCode : null,
      );
      setResendIn(RESEND_SECONDS);
      return true;
    } catch {
      setError("Couldn't reach the server, please try again");
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
        setError(data.error ?? "Couldn't verify the code");
        return;
      }
      setStep("newPassword");
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords don't match");
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
        setError(data.error ?? "Couldn't set the new password");
        return;
      }
      setStep("done");
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      greetingTitle="Hello, Welcome!"
      greetingSubtitle="Remember your password?"
      ctaLabel="Login"
      ctaHref="/login"
    >
      {step === "identifier" && (
        <section aria-labelledby="forgot-title">
          <h1
            id="forgot-title"
            className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
          >
            Forgot Password
          </h1>
          <p className="mt-2 text-center text-sm text-[#6a6f83]">
            Enter your registered phone number or verified email and we&apos;ll
            send you a verification code.
          </p>

          <form onSubmit={onSubmitIdentifier} className="mt-8 space-y-4">
            {/* اختيار القناة — تبويبان حقيقيان يغيّران الحقل أدناه */}
            <div
              role="tablist"
              aria-label="Recovery channel"
              className="grid grid-cols-2 gap-1 rounded-[10px] bg-[#e7e9f2] p-1"
            >
              {(
                [
                  ["phone", "Phone Number"],
                  ["email", "Verified Email"],
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
                aria-label="Phone Number"
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
                aria-label="Verified Email"
                autoComplete="email"
                className={`${INPUT_CLS} px-4 text-left`}
                placeholder="doctor@clinic.com"
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
              Send Verification Code
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            <Link href="/forgot-phone" className="text-[13px] text-[#3d4152] hover:underline">
              Forgot your registered phone number?
            </Link>
            <Link href="/login" className="text-[13px] text-[#3d4152] hover:underline">
              Back to login
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
            Enter Verification Code
          </h1>
          <p className="mt-2 text-center text-sm text-[#6a6f83]">
            {destinationHint
              ? `We sent a 6-digit code to ${destinationHint}`
              : "We sent a 6-digit code"}{" "}
            — valid for 10 minutes.
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
              aria-label="Verification Code"
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
              Verify Code
            </button>

            <div className="flex items-center justify-between text-[13px]">
              <button
                type="button"
                onClick={requestCode}
                disabled={resendIn > 0 || submitting}
                className="font-medium text-[#4a5cd9] hover:underline disabled:text-[#9aa0b5] disabled:hover:no-underline"
              >
                {resendIn > 0
                  ? `Resend code in ${resendIn}s`
                  : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("identifier");
                  setError(null);
                }}
                className="text-[#3d4152] hover:underline"
              >
                Edit details
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
            New Password
          </h1>
          <p className="mt-2 text-center text-sm text-[#6a6f83]">
            Choose a strong password — you&apos;ll be signed out of all other
            devices.
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
                aria-label="New Password (at least 8 characters)"
                className={`${INPUT_CLS} pl-12 pr-12 text-left`}
                placeholder="New Password (at least 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
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
                aria-label="Confirm Password"
                className={`${INPUT_CLS} pl-12 pr-12 text-left`}
                placeholder="Confirm Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
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
              Set New Password
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
            Your password has been updated
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6a6f83]">
            All old sessions were signed out on every device — sign in with
            your new password.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block h-12 w-full rounded-[10px] px-4 text-[15px] font-semibold leading-[48px] text-white transition-colors hover:opacity-90"
            style={{ background: "#5B6CE4" }}
          >
            Login
          </Link>
        </section>
      )}
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
