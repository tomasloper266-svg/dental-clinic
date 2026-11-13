"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

// صفحة الدخول — أول انطباع عن النظام. نفس عقد الواجهة السابق
// (POST /api/auth/login ثم توجيه إلى لوحة القيادة) مع «تذكرني»
// وروابط الاستعادة الثلاثة.

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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
        body: JSON.stringify({ phone, password, rememberMe }),
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
    <AuthShell>
      <section aria-labelledby="login-title">
        <h1 id="login-title" className="font-display text-[25px] font-normal leading-[1.45] text-ink-900">
          تسجيل الدخول
        </h1>
        <p className="mt-2 text-sm text-warm-600">
          أدخل بيانات حسابك للوصول إلى عيادتك
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
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

          <div className="space-y-2">
            <Field label="كلمة السر" htmlFor="password">
              <PasswordInput
                id="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-warm-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-primary-600"
                />
                تذكرني
              </label>
              <Link href="/forgot-password" className="link-quiet">
                نسيت كلمة المرور؟
              </Link>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full py-3">
            دخول
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-sm">
          <p className="text-warm-600">
            ليس لديك عيادة بعد؟{" "}
            <Link href="/signup" className="font-semibold text-primary-700 hover:text-primary-800">
              إنشاء حساب عيادة جديدة
            </Link>
          </p>
          <Link href="/forgot-phone" className="link-quiet">
            نسيت رقم الهاتف المسجل؟
          </Link>
        </div>
      </section>
    </AuthShell>
  );
}
