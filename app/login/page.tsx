"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialRow } from "@/components/auth/SocialRow";
import { Field, Input } from "@/components/ui/Field";

// صفحة الدخول — بطاقة مقسومة بلوح ترحيبي أزرق وفورم بالأيقونات.
// نفس عقد الواجهة السابق (POST /api/auth/login ثم توجيه إلى لوحة
// القيادة). حقل «تذكرني» أُسقط من الواجهة لمطابقة التصميم المرجعي؛
// يُرسل rememberMe=false دائماً.

const INPUT_CLS =
  "h-11 rounded-lg border-0 bg-[#eceef6] text-sm text-ink-900 placeholder:text-warm-400 focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
        setError(data.error ?? "حدث خطأ غير متوقع");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      greetingTitle="أهلاً بك!"
      greetingSubtitle="ليس لديك عيادة بعد؟"
      ctaLabel="إنشاء حساب"
      ctaHref="/signup"
    >
      <section aria-labelledby="login-title">
        <h1 id="login-title" className="text-center text-3xl font-bold text-ink-900">
          تسجيل الدخول
        </h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="رقم الهاتف" htmlFor="phone">
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                dir="ltr"
                required
                className={`${INPUT_CLS} pr-4 pl-11 text-left`}
                placeholder="09xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <User
                aria-hidden
                size={17}
                className="pointer-events-none absolute inset-y-0 right-4 my-auto h-[17px] w-[17px] text-warm-400"
              />
            </div>
          </Field>

          <Field label="كلمة السر" htmlFor="password">
            <div className="relative">
              <input
                id="password"
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                className={`${INPUT_CLS} w-full px-4 py-2.5 text-left`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock
                aria-hidden
                size={17}
                className="pointer-events-none absolute inset-y-0 left-4 my-auto h-[17px] w-[17px] text-warm-400"
              />
            </div>
          </Field>

          <p className="text-center">
            <Link href="/forgot-password" className="text-xs text-[#8a8da3] hover:text-ink-700">
              نسيت كلمة المرور؟
            </Link>
          </p>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting || undefined}
            className="h-11 w-full rounded-lg text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "#5B6CE4" }}
          >
            دخول
          </button>
        </form>

        <SocialRow />

        {/* بديل لوح الترحيب على الشاشات الصغيرة — اللوح مخفي دون lg */}
        <p className="mt-6 text-center text-sm text-warm-600 lg:hidden">
          ليس لديك عيادة بعد؟{" "}
          <Link href="/signup" className="font-semibold text-[#4a5cd9] hover:text-[#3a4bc4]">
            إنشاء حساب
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
