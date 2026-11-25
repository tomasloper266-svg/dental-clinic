"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialRow } from "@/components/auth/SocialRow";

// صفحة الدخول — نسخة طبق الأصل من التصميم المرجعي:
// عنوان Login أسود عريض، حقول رمادية فاتحة بنص يسار وأيقونة يمين
// (بلا تداخل)، كلمة السر مع زر إظهار/إخفاء، زر Login أزرق.
// نفس عقد الواجهة السابق (POST /api/auth/login ثم توجيه إلى لوحة
// القيادة). حقل «تذكرني» أُسقط لمطابقة المرجع؛ يُرسل rememberMe=false.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

export default function LoginPage() {
  const router = useRouter();
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
        setError(data.error ?? "Sign in failed — check your phone number and password");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      greetingTitle="Hello, Welcome!"
      greetingSubtitle="Don't have an account?"
      ctaLabel="Register"
      ctaHref="/signup"
    >
      <section aria-labelledby="login-title">
        <h1 id="login-title" className="text-center text-[32px] font-bold leading-tight text-[#16181d]">
          Login
        </h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="relative">
            <input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              required
              aria-label="Username"
              autoComplete="username"
              className={`${INPUT_CLS} pl-4 pr-12 text-left`}
              placeholder="Username"
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
              aria-label="Password"
              className={`${INPUT_CLS} pl-12 pr-12 text-left`}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
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
              Forgot Password?
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
            Login
          </button>
        </form>

        <SocialRow caption="or login with social platforms" />

        {/* بديل لوح الترحيب على الشاشات الصغيرة — اللوح مخفي دون lg */}
        <p className="mt-6 text-center text-sm text-[#3d4152] lg:hidden">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-semibold text-[#4a5cd9] hover:underline">
            Register
          </a>
        </p>
      </section>
    </AuthShell>
  );
}
