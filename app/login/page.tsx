"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialRow } from "@/components/auth/SocialRow";
import { useI18n } from "@/components/i18n/I18nProvider";

// صفحة الدخول — نسخة طبق الأصل من التصميم المرجعي:
// عنوان Login أسود عريض، حقول رمادية فاتحة بنص يسار وأيقونة يمين
// (بلا تداخل)، كلمة السر مع زر إظهار/إخفاء، زر Login أزرق.
// نفس عقد الواجهة السابق (POST /api/auth/login ثم توجيه إلى لوحة
// القيادة). حقل «تذكرني» أُسقط لمطابقة المرجع؛ يُرسل rememberMe=false.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, rememberMe: false }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.login.failed"));
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("auth.error.server"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      greetingTitle={t("auth.greeting")}
      greetingSubtitle={t("auth.noAccount")}
      ctaLabel={t("auth.register")}
      ctaHref="/signup"
    >
      <section aria-labelledby="login-title">
        <h1 id="login-title" className="text-center text-[32px] font-bold leading-tight text-[#16181d]">
          {t("auth.login.title")}
        </h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="relative">
            <input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              required
              aria-label={t("auth.login.username")}
              autoComplete="username"
              className={`${INPUT_CLS} pl-4 pr-12 text-left`}
              placeholder={t("auth.login.username")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <User
              aria-hidden
              size={18}
              className="pointer-events-none absolute inset-y-0 right-4 my-auto h-[18px] w-[18px] text-[#25293c]"
            />
          </div>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              dir="ltr"
              autoComplete="current-password"
              aria-label={t("auth.login.password")}
              className={`${INPUT_CLS} pl-12 pr-12 text-left`}
              placeholder={t("auth.login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
              aria-pressed={showPassword}
              className="absolute inset-y-0 left-3 my-auto flex h-7 w-7 items-center justify-center rounded text-[#25293c] hover:text-[#16181d]"
            >
              {showPassword ? (
                <EyeOff aria-hidden size={18} />
              ) : (
                <Eye aria-hidden size={18} />
              )}
            </button>
            <Lock
              aria-hidden
              size={18}
              className="pointer-events-none absolute inset-y-0 right-4 my-auto h-[18px] w-[18px] text-[#25293c]"
            />
          </div>

          <p className="pt-1 text-center">
            <a href="/forgot-password" className="text-[13px] text-[#3d4152] hover:underline">
              {t("auth.forgotPasswordQuestion")}
            </a>
          </p>

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
            {t("auth.login.title")}
          </button>
        </form>

        <SocialRow caption={t("auth.social.orLogin")} />

        {/* بديل لوح الترحيب على الشاشات الصغيرة — اللوح مخفي دون lg */}
        <p className="mt-6 text-center text-sm text-[#3d4152] lg:hidden">
          {t("auth.noAccount")}{" "}
          <a href="/signup" className="font-semibold text-[#4a5cd9] hover:underline">
            {t("auth.register")}
          </a>
        </p>
      </section>
    </AuthShell>
  );
}
