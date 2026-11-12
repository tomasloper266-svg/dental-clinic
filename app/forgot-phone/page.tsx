"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FallbackCodeNotice } from "@/components/auth/FallbackCodeNotice";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

// مسار «نسيت رقم الهاتف» — ثلاثة أبواب حقيقية:
// بريد موثق (OTP) أو رمز الاسترداد الاحتياطي أو طلب دعم للتحقق من الملكية.

type Path = "email" | "recoveryCode" | "support";

type RecoveredAccount = { clinicName: string; phone: string };

export default function ForgotPhonePage() {
  const [path, setPath] = useState<Path>("email");

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-ink-900">نسيت رقم الهاتف؟</h1>
      <p className="mt-2 text-sm text-warm-600">
        اختر طريقة استعادة حسابك — لا يمكن تغيير رقم الهاتف دون إثبات ملكية
        الحساب.
      </p>

      <div
        role="tablist"
        aria-label="طريقة الاستعادة"
        className="mt-6 grid grid-cols-3 gap-1 rounded-field bg-surface-sunken p-1"
      >
        {(
          [
            ["email", "البريد الموثق"],
            ["recoveryCode", "رمز الاسترداد"],
            ["support", "الدعم"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={path === value}
            onClick={() => setPath(value)}
            className={`rounded-[6px] py-2 text-xs font-medium transition-colors sm:text-sm ${
              path === value
                ? "bg-surface-raised text-ink-900 shadow-sm"
                : "text-warm-500 hover:text-ink-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-7">
        {path === "email" && <EmailPath />}
        {path === "recoveryCode" && <RecoveryCodePath />}
        {path === "support" && <SupportPath />}
      </div>

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="link-quiet">
          نسيت كلمة المرور؟
        </Link>
        <Link href="/login" className="link-quiet">
          العودة إلى تسجيل الدخول
        </Link>
      </div>
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
      const data = (await res.json()) as { error?: string; fallbackCode?: string; destinationHint?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذر إرسال الرمز، حاول مرة أخرى");
        return;
      }
      setDestinationHint(data.destinationHint ?? "");
      setFallbackCode(typeof data.fallbackCode === "string" ? data.fallbackCode : null);
      setResendIn(60);
      setStep("code");
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
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
        setError(data.error ?? "تعذر التحقق من الرمز");
        return;
      }
      setAccounts(data.accounts);
      setStep("revealed");
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "revealed") {
    return (
      <section aria-label="أرقام الهواتف المستعادة">
        <p className="text-sm text-warm-600">
          تم إثبات ملكية البريد — هذه الأرقام المسجلة به:
        </p>
        <ul className="mt-4 space-y-3">
          {accounts.map((a) => (
            <li
              key={`${a.clinicName}-${a.phone}`}
              className="flex items-center justify-between rounded-panel bg-surface-raised px-4 py-3 ring-1 ring-warm-200"
            >
              <span className="text-sm font-medium text-ink-900">
                {a.clinicName}
              </span>
              <span dir="ltr" className="numeric text-sm text-ink-700">
                {a.phone}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/login"
          className="mt-6 inline-block w-full rounded-field bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          تسجيل الدخول بهذا الرقم
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={step === "email" ? (e) => { e.preventDefault(); requestCode(); } : onSubmitCode}
      className="space-y-5"
      aria-label={step === "email" ? "إرسال رمز إلى البريد الموثق" : "إدخال رمز التحقق"}
    >
      {step === "email" ? (
        <Field label="البريد الإلكتروني الموثق" htmlFor="fp-email">
          <Input
            id="fp-email"
            type="email"
            dir="ltr"
            required
            className="text-left"
            placeholder="doctor@clinic.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      ) : (
        <>
          <p className="text-sm text-warm-600">
            أرسلنا رمز تحقق إلى {destinationHint || "بريدك"} — صالح لعشر دقائق.
          </p>
          {fallbackCode && (
            <FallbackCodeNotice code={fallbackCode} destinationHint={destinationHint} />
          )}
          <Field label="رمز التحقق" htmlFor="fp-code">
            <Input
              id="fp-code"
              inputMode="numeric"
              dir="ltr"
              required
              maxLength={6}
              className="numeric text-center text-lg tracking-[0.4em]"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </Field>
        </>
      )}

      {error && <FormError message={error} />}

      {step === "email" ? (
        <Button type="submit" loading={submitting} className="w-full py-3">
          إرسال رمز التحقق
        </Button>
      ) : (
        <>
          <Button type="submit" loading={submitting} className="w-full py-3">
            تحقق وأظهر الرقم
          </Button>
          <button
            type="button"
            onClick={requestCode}
            disabled={resendIn > 0 || submitting}
            className="text-sm font-medium text-primary-700 disabled:text-warm-400"
          >
            {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ثانية` : "إعادة إرسال الرمز"}
          </button>
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
        setError(data.error ?? "تعذر التحقق من الرمز");
        return;
      }
      setAccount(data.account);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  if (account) {
    return (
      <section aria-label="الرقم المستعاد">
        <p className="text-sm text-warm-600">
          رمز الاسترداد صحيح — رقم هاتفك المسجل في {account.clinicName}:
        </p>
        <p
          dir="ltr"
          className="numeric mt-4 rounded-panel bg-surface-raised px-4 py-4 text-center text-xl font-bold text-ink-900 ring-1 ring-warm-200"
        >
          {account.phone}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block w-full rounded-field bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          تسجيل الدخول
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label="استعادة برمز الاسترداد">
      <Field
        label="رمز الاسترداد الاحتياطي"
        htmlFor="rc"
        hint="الرمز المكون من 12 حرفاً الذي عُرض عند إنشاء العيادة"
      >
        <Input
          id="rc"
          dir="ltr"
          required
          className="numeric text-left tracking-widest"
          placeholder="XXXX-XXXX-XXXX"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
        />
      </Field>

      {error && <FormError message={error} />}

      <Button type="submit" loading={submitting} className="w-full py-3">
        تحقق وأظهر الرقم
      </Button>
    </form>
  );
}

// ─── المسار 3: طلب دعم — يُخزَّن ويُعالج من فريق الدعم ──────────────────────

function SupportPath() {
  const [form, setForm] = useState({
    clinicName: "",
    contactEmail: "",
    contactPhone: "",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذر إرسال الطلب، حاول مرة أخرى");
        return;
      }
      setDone(data.message ?? "تم إرسال طلبك");
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section
        role="status"
        className="rounded-panel border border-primary-100 bg-primary-50 p-5 text-center"
      >
        <LifeBuoy size={26} className="mx-auto text-primary-700" aria-hidden />
        <p className="mt-3 text-sm font-medium text-primary-900">{done}</p>
        <p className="mt-2 text-xs text-primary-700">
          جهّز ما يثبت ملكيتك للعيادة (وثائق التسجيل، آخر فواتير الاشتراك).
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label="طلب دعم">
      <Field label="اسم العيادة" htmlFor="sp-clinic">
        <Input
          id="sp-clinic"
          required
          value={form.clinicName}
          onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
          placeholder="مثال: عيادة الابتسامة"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="بريد للتواصل (اختياري)" htmlFor="sp-email">
          <Input
            id="sp-email"
            type="email"
            dir="ltr"
            className="text-left"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            placeholder="doctor@clinic.com"
          />
        </Field>
        <Field label="هاتف للتواصل (اختياري)" htmlFor="sp-phone">
          <Input
            id="sp-phone"
            type="tel"
            dir="ltr"
            className="text-left"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder="09xxxxxxxx"
          />
        </Field>
      </div>
      <Field
        label="وصف الحالة"
        htmlFor="sp-message"
        hint="اذكر اسم العيادة واسم الطبيب وآخر معلومة تتذكرها عن الحساب"
      >
        <Textarea
          id="sp-message"
          required
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </Field>

      {error && <FormError message={error} />}

      <Button type="submit" loading={submitting} className="w-full py-3">
        إرسال طلب إلى الدعم
      </Button>
    </form>
  );
}
