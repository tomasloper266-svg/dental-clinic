"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FallbackCodeNotice } from "@/components/auth/FallbackCodeNotice";
import { SupportPhoneCard } from "@/components/auth/SupportPhoneCard";

// «نسيت رقم الهاتف» — ثلاثة أبواب: بريد موثق (رمز تحقق)، رمز الاسترداد
// الاحتياطي (الرمز من 12 حرفاً الذي عُرض عند إنشاء العيادة)، أو الدعم
// (رقم هاتف مباشر). التصميم مطابق لصفحات المصادقة: ألوان ثابتة فاتحة
// وإنكليزي بالكامل، فلا تنكسر في الوضع الداكن. المنطق ونقاط الـAPI كما كانت.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

type Path = "email" | "recoveryCode" | "support";

type RecoveredAccount = { clinicName: string; phone: string };

export default function ForgotPhonePage() {
  const [path, setPath] = useState<Path>("email");

  return (
    <AuthShell
      greetingTitle="Hello, Welcome!"
      greetingSubtitle="Don't have an account?"
      ctaLabel="Register"
      ctaHref="/signup"
    >
      <section aria-labelledby="forgot-phone-title">
        <h1
          id="forgot-phone-title"
          className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
        >
          Forgot Your Phone Number?
        </h1>
        <p className="mt-2 text-center text-sm text-[#6a6f83]">
          Choose how to recover your account — the phone number can&apos;t
          change without proving you own the account.
        </p>

        <div
          role="tablist"
          aria-label="Recovery method"
          className="mt-7 grid grid-cols-3 gap-1 rounded-[10px] bg-[#e7e9f2] p-1"
        >
          {(
            [
              ["email", "Verified Email"],
              ["recoveryCode", "Recovery Code"],
              ["support", "Support"],
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
      </section>

      <div className="mt-7">
        {path === "email" && <EmailPath />}
        {path === "recoveryCode" && <RecoveryCodePath />}
        {path === "support" && <SupportPhoneCard />}
      </div>

      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link
          href="/forgot-password"
          className="text-[13px] text-[#3d4152] hover:underline"
        >
          Forgot your password?
        </Link>
        <Link
          href="/login"
          className="text-[13px] text-[#3d4152] hover:underline"
        >
          Back to login
        </Link>
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

const PRIMARY_BTN_CLS =
  "h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

// ─── المسار 1: بريد موثق + OTP ──────────────────────────────────────────────

function EmailPath() {
  const [step, setStep] = useState<"email" | "code" | "revealed">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [destinationHint, setDestinationHint] = useState("");
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<RecoveredAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function requestCode() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        error?: string;
        fallbackCode?: string;
        destinationHint?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the code — please try again");
        return;
      }
      setDestinationHint(data.destinationHint ?? "");
      setFallbackCode(
        typeof data.fallbackCode === "string" ? data.fallbackCode : null,
      );
      setResendIn(60);
      setStep("code");
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as {
        error?: string;
        accounts?: RecoveredAccount[];
      };
      if (!res.ok || !data.accounts) {
        setError(data.error ?? "Couldn't verify the code");
        return;
      }
      setAccounts(data.accounts);
      setStep("revealed");
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "revealed") {
    return (
      <section aria-label="Recovered phone numbers">
        <p className="text-sm text-[#6a6f83]">
          Your email is verified — here are the phone numbers registered with
          it:
        </p>
        <ul className="mt-4 space-y-3">
          {accounts.map((a) => (
            <li
              key={`${a.clinicName}-${a.phone}`}
              className="flex items-center justify-between rounded-xl bg-[#f7f8fb] px-4 py-3"
            >
              <span className="text-sm font-medium text-[#16181d]">
                {a.clinicName}
              </span>
              <span dir="ltr" className="text-sm text-[#25293c]">
                {a.phone}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/login"
          className={`${PRIMARY_BTN_CLS} mt-6 inline-block leading-[48px]`}
          style={{ background: "#5B6CE4" }}
        >
          Login with this number
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={
        step === "email"
          ? (e) => {
              e.preventDefault();
              requestCode();
            }
          : onSubmitCode
      }
      className="space-y-4"
      aria-label={
        step === "email"
          ? "Send a code to your verified email"
          : "Enter the verification code"
      }
    >
      {step === "email" ? (
        <input
          id="fp-email"
          type="email"
          dir="ltr"
          required
          autoComplete="email"
          aria-label="Verified Email"
          className={`${INPUT_CLS} px-4 text-left`}
          placeholder="doctor@clinic.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      ) : (
        <>
          <p className="text-sm text-[#6a6f83]">
            We sent a verification code to {destinationHint || "your email"} —
            valid for 10 minutes.
          </p>
          {fallbackCode && (
            <FallbackCodeNotice
              code={fallbackCode}
              destinationHint={destinationHint}
            />
          )}
          <input
            id="fp-code"
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
        </>
      )}

      {error && <FormError message={error} />}

      {step === "email" ? (
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
          className={PRIMARY_BTN_CLS}
          style={{ background: "#5B6CE4" }}
        >
          Send Verification Code
        </button>
      ) : (
        <>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting || undefined}
            className={PRIMARY_BTN_CLS}
            style={{ background: "#5B6CE4" }}
          >
            Verify and Show Number
          </button>
          <div className="text-center text-[13px]">
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
          </div>
        </>
      )}
    </form>
  );
}

// ─── المسار 2: رمز الاسترداد الاحتياطي ──────────────────────────────────────

function RecoveryCodePath() {
  const [recoveryCode, setRecoveryCode] = useState("");
  const [account, setAccount] = useState<RecoveredAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-phone/recovery-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCode }),
      });
      const data = (await res.json()) as {
        error?: string;
        account?: RecoveredAccount;
      };
      if (!res.ok || !data.account) {
        setError(data.error ?? "Couldn't verify the code");
        return;
      }
      setAccount(data.account);
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (account) {
    return (
      <section aria-label="Recovered number">
        <p className="text-sm text-[#6a6f83]">
          Recovery code verified — the phone number registered with{" "}
          {account.clinicName}:
        </p>
        <p
          dir="ltr"
          className="mt-4 rounded-[10px] bg-[#f7f8fb] px-4 py-4 text-center text-xl font-bold text-[#16181d]"
        >
          {account.phone}
        </p>
        <Link
          href="/login"
          className={`${PRIMARY_BTN_CLS} mt-6 inline-block leading-[48px]`}
          style={{ background: "#5B6CE4" }}
        >
          Login
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Recover with recovery code">
      <div className="rounded-xl bg-[#f7f8fb] p-4 text-sm leading-6 text-[#4a4e63]">
        The <strong className="font-semibold text-[#16181d]">recovery code</strong>{" "}
        is the 12-character code (like{" "}
        <span dir="ltr" className="text-[#25293c]">XXXX-XXXX-XXXX</span>) shown
        once when your clinic account was created. Saved it? Enter it here to
        see your registered phone number. Lost it? Use the{" "}
        <strong className="font-semibold text-[#16181d]">Support</strong> tab.
      </div>
      <input
        id="rc"
        dir="ltr"
        required
        aria-label="Backup recovery code (12 characters, shown when your clinic was created)"
        className={`${INPUT_CLS} px-4 text-left tracking-widest`}
        placeholder="XXXX-XXXX-XXXX"
        value={recoveryCode}
        onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
      />

      {error && <FormError message={error} />}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting || undefined}
        className={PRIMARY_BTN_CLS}
        style={{ background: "#5B6CE4" }}
      >
        Verify and Show Number
      </button>
    </form>
  );
}

// ─── المسار 3: الدعم — بطاقة الرقم المشتركة ────────────────────────────────
