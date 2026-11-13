"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { FallbackCodeNotice } from "@/components/auth/FallbackCodeNotice";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

// مسار «نسيت كلمة المرور» — ثلاث خطوات: تحديد الهوية، رمز التحقق، كلمة السر.
// الرمز لا يُستهلك إلا عند التعيين النهائي، والرسائل صريحة عند الانتهاء أو الخطأ.

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
        setError(data.error ?? "تعذر إرسال الرمز، حاول مرة أخرى");
        return false;
      }
      setDestinationHint(String(data.destinationHint ?? ""));
      setFallbackCode(
        typeof data.fallbackCode === "string" ? data.fallbackCode : null,
      );
      setResendIn(RESEND_SECONDS);
      return true;
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
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
        setError(data.error ?? "تعذر التحقق من الرمز");
        return;
      }
      setStep("newPassword");
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("كلمتا السر غير متطابقتين");
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
        setError(data.error ?? "تعذر تعيين كلمة السر");
        return;
      }
      setStep("done");
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {step === "identifier" && (
        <section aria-labelledby="forgot-title">
          <h1 id="forgot-title" className="font-display text-[25px] font-normal leading-[1.45] text-ink-900">
            استعادة كلمة المرور
          </h1>
          <p className="mt-2 text-sm text-warm-600">
            أدخل رقم هاتفك أو بريدك الإلكتروني الموثق، وسنرسل لك رمز تحقق.
          </p>

          <form onSubmit={onSubmitIdentifier} className="mt-8 space-y-5">
            {/* اختيار القناة — تبويبان حقيقيان يغيّران الحقل أدناه */}
            <div
              role="tablist"
              aria-label="قناة الاستعادة"
              className="grid grid-cols-2 gap-1 rounded-field bg-surface-sunken p-1"
            >
              {(
                [
                  ["phone", "رقم الهاتف"],
                  ["email", "البريد الموثق"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-[6px] py-2 text-sm font-medium transition-colors ${
                    mode === value
                      ? "bg-surface-raised text-ink-900 shadow-sm"
                      : "text-warm-500 hover:text-ink-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "phone" ? (
              <Field label="رقم الهاتف" htmlFor="phone">
                <Input
                  id="phone"
                  type="tel"
                  dir="ltr"
                  required
                  className="text-left"
                  placeholder="09xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="البريد الإلكتروني الموثق" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  required
                  className="text-left"
                  placeholder="doctor@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            )}

            {error && <FormError message={error} />}

            <Button type="submit" loading={submitting} className="w-full py-3">
              إرسال رمز التحقق
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-sm">
            <Link href="/forgot-phone" className="link-quiet">
              نسيت رقم الهاتف المسجل؟
            </Link>
            <Link href="/login" className="link-quiet">
              العودة إلى تسجيل الدخول
            </Link>
          </div>
        </section>
      )}

      {step === "code" && (
        <section aria-labelledby="code-title">
          <h1 id="code-title" className="font-display text-[25px] font-normal leading-[1.45] text-ink-900">
            أدخل رمز التحقق
          </h1>
          <p className="mt-2 text-sm text-warm-600">
            {destinationHint
              ? `أرسلنا رمزاً من 6 أرقام إلى ${destinationHint}`
              : "أرسلنا رمزاً من 6 أرقام"}{" "}
            — صالح لعشر دقائق.
          </p>

          {fallbackCode && (
            <div className="mt-5">
              <FallbackCodeNotice
                code={fallbackCode}
                destinationHint={destinationHint}
              />
            </div>
          )}

          <form onSubmit={onSubmitCode} className="mt-6 space-y-5">
            <Field label="رمز التحقق" htmlFor="code">
              <Input
                id="code"
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

            {error && <FormError message={error} />}

            <Button type="submit" loading={submitting} className="w-full py-3">
              تحقق من الرمز
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={requestCode}
                disabled={resendIn > 0 || submitting}
                className="font-medium text-primary-700 disabled:text-warm-400"
              >
                {resendIn > 0
                  ? `إعادة الإرسال بعد ${resendIn} ثانية`
                  : "إعادة إرسال الرمز"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("identifier");
                  setError(null);
                }}
                className="text-warm-600 hover:text-ink-700"
              >
                تعديل البيانات
              </button>
            </div>
          </form>
        </section>
      )}

      {step === "newPassword" && (
        <section aria-labelledby="newpass-title">
          <h1 id="newpass-title" className="font-display text-[25px] font-normal leading-[1.45] text-ink-900">
            كلمة السر الجديدة
          </h1>
          <p className="mt-2 text-sm text-warm-600">
            اختر كلمة سر قوية — وسيتم تسجيل خروجك من كل الأجهزة الأخرى.
          </p>

          <form onSubmit={onSubmitNewPassword} className="mt-8 space-y-5">
            <Field label="كلمة السر الجديدة" htmlFor="newPassword" hint="8 أحرف على الأقل">
              <PasswordInput
                id="newPassword"
                required
                minLength={8}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>

            <Field label="تأكيد كلمة السر" htmlFor="confirm">
              <PasswordInput
                id="confirm"
                required
                minLength={8}
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>

            {error && <FormError message={error} />}

            <Button type="submit" loading={submitting} className="w-full py-3">
              تعيين كلمة السر
            </Button>
          </form>
        </section>
      )}

      {step === "done" && (
        <section className="rounded-panel bg-surface-raised p-8 text-center shadow-sm ring-1 ring-warm-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="var(--color-primary-600)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-bold text-ink-900">
            تم تعيين كلمة السر الجديدة
          </h1>
          <p className="mt-2 text-sm text-warm-600">
            أُبطلت كل الجلسات القديمة على جميع الأجهزة — سجّل الدخول بكلمة
            السر الجديدة.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-field bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            تسجيل الدخول
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
      className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
    >
      {message}
    </p>
  );
}
