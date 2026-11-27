"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialRow } from "@/components/auth/SocialRow";
import { SignupPlansCard } from "@/components/subscription/SignupPlansCard";
import { useI18n } from "@/components/i18n/I18nProvider";

// صفحة التسجيل — نفس بطاقة الدخول معكوسة (اللوح الأزرق يميناً مع الميلانة
// على اليمين)، بنصوص القاموس حسب لغة الجلسة وألوان ثابتة فاتحة مستقلة
// عن وضع الثيم.
// نفس عقد الواجهة السابق: أنشئ العيادة (POST /api/auth/signup) ثم اعرض
// رمز الاسترداد الاحتياطي مرة واحدة، ثم ادخل إلى صفحة الإعداد.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

export default function SignupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({
    clinicName: "",
    name: "",
    phone: "",
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ recoveryCode: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as {
        error?: string;
        recoveryCode?: string;
      };
      if (!res.ok || !data.recoveryCode) {
        setError(data.error ?? t("auth.signup.failed"));
        return;
      }
      setCreated({ recoveryCode: data.recoveryCode });
    } catch {
      setError(t("auth.error.server"));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <AuthShell
        flip
        greetingTitle={t("auth.signup.clinicCreated")}
        greetingSubtitle={t("auth.signup.recoveryShownHere")}
        ctaLabel={t("auth.signIn")}
        ctaHref="/login"
      >
        <section aria-labelledby="recovery-code-title">
          <h1
            id="recovery-code-title"
            className="text-center text-[28px] font-bold leading-tight text-[#16181d]"
          >
            {t("auth.signup.clinicReady")}
          </h1>

          <div className="mt-6 rounded-2xl border-2 border-[#c9d0f5] bg-[#eef0fb] p-6">
            <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-[#3a4bc4]">
              <KeyRound size={18} aria-hidden />
              {t("auth.signup.recoveryTitle")}
            </h2>
            <p
              dir="ltr"
              className="numeric mt-4 select-all text-center text-2xl font-bold tracking-[0.25em] text-[#16181d]"
            >
              {created.recoveryCode}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#3a4bc4]">
              {t("auth.signup.recoverySaveBefore")}
              <strong>{t("auth.signup.recoverySaveOnce")}</strong>
              {t("auth.signup.recoverySaveAfter")}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                router.push("/setup");
                router.refresh();
              }}
              className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90"
              style={{ background: "#5B6CE4" }}
            >
              {t("auth.signup.continueSetup")}
            </button>
            <a
              href="/login"
              className="text-center text-[13px] text-[#3d4152] hover:underline"
            >
              {t("auth.signup.signinLater")}
            </a>
          </div>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      flip
      greetingTitle={t("auth.greeting")}
      greetingSubtitle={t("auth.haveAccount")}
      ctaLabel={t("auth.login")}
      ctaHref="/login"
    >
      <section aria-labelledby="signup-title">
        <h1
          id="signup-title"
          className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
        >
          {t("auth.signup.title")}
        </h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            id="clinicName"
            name="clinicName"
            type="text"
            required
            aria-label={t("auth.signup.clinicName")}
            autoComplete="organization"
            className={INPUT_CLS}
            placeholder={t("auth.signup.clinicName")}
            value={form.clinicName}
            onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
          />

          <input
            id="name"
            name="name"
            type="text"
            required
            aria-label={t("auth.signup.doctorName")}
            autoComplete="name"
            className={INPUT_CLS}
            placeholder={t("auth.signup.doctorName")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            required
            aria-label={t("auth.signup.phone")}
            autoComplete="tel"
            className={`${INPUT_CLS} text-left`}
            placeholder={t("auth.signup.phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <input
            id="username"
            name="username"
            type="text"
            dir="ltr"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_.\-]+"
            aria-label={t("auth.signup.username")}
            autoComplete="username"
            className={`${INPUT_CLS} text-left`}
            placeholder={t("auth.signup.username")}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              dir="ltr"
              autoComplete="new-password"
              aria-label={t("auth.signup.password")}
              className={`${INPUT_CLS} pr-12`}
              placeholder={t("auth.signup.password")}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-3 my-auto flex h-7 w-7 items-center justify-center rounded text-[#25293c] hover:text-[#16181d]"
            >
              {showPassword ? (
                <EyeOff aria-hidden size={18} />
              ) : (
                <Eye aria-hidden size={18} />
              )}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[#f3c8c8] bg-[#fdeeee] px-3 py-2.5 text-sm text-[#b23a3a]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting || undefined}
            className="h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "#5B6CE4" }}
          >
            {t("auth.signup.title")}
          </button>
        </form>

        <SocialRow caption={t("auth.social.orSignup")} />

        {/* العرض مرئي أثناء التسجيل نفسه — الدفع متاح من أول يوم */}
        <SignupPlansCard />

        {/* بديل لوح الترحيب على الشاشات الصغيرة — اللوح مخفي دون lg */}
        <p className="mt-6 text-center text-sm text-[#3d4152] lg:hidden">
          {t("auth.haveAccount")}{" "}
          <a href="/login" className="font-semibold text-[#4a5cd9] hover:underline">
            {t("auth.login")}
          </a>
        </p>
      </section>
    </AuthShell>
  );
}
