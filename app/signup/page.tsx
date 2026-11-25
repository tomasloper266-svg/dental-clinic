"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialRow } from "@/components/auth/SocialRow";
import { SignupPlansCard } from "@/components/subscription/SignupPlansCard";

// صفحة التسجيل — نفس بطاقة الدخول معكوسة (اللوح الأزرق يميناً مع الميلانة
// على اليمين)، بنسخة إنكليزية وألوان ثابتة فاتحة مستقلة عن وضع الثيم.
// نفس عقد الواجهة السابق: أنشئ العيادة (POST /api/auth/signup) ثم اعرض
// رمز الاسترداد الاحتياطي مرة واحدة، ثم ادخل إلى صفحة الإعداد.

const INPUT_CLS =
  "h-12 w-full rounded-[10px] border-0 bg-[#f1f2f6] text-[15px] text-[#25293c] placeholder:text-[#9aa0b5] focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clinicName: "",
    name: "",
    phone: "",
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
        setError(data.error ?? "Sign up failed — check the entered details");
        return;
      }
      setCreated({ recoveryCode: data.recoveryCode });
    } catch {
      setError("Couldn't reach the server, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <AuthShell
        flip
        greetingTitle="Clinic created!"
        greetingSubtitle="The recovery code is shown on this page only"
        ctaLabel="Sign in"
        ctaHref="/login"
      >
        <section aria-labelledby="recovery-code-title">
          <h1
            id="recovery-code-title"
            className="text-center text-[28px] font-bold leading-tight text-[#16181d]"
          >
            Your clinic is ready
          </h1>

          <div className="mt-6 rounded-2xl border-2 border-[#c9d0f5] bg-[#eef0fb] p-6">
            <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-[#3a4bc4]">
              <KeyRound size={18} aria-hidden />
              Backup recovery code
            </h2>
            <p
              dir="ltr"
              className="numeric mt-4 select-all text-center text-2xl font-bold tracking-[0.25em] text-[#16181d]"
            >
              {created.recoveryCode}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#3a4bc4]">
              Save it now somewhere safe — it is shown <strong>once only</strong>{" "}
              and we cannot recover it for you. If you lose your phone number
              and have no verified email, this code is your only way back into
              the account without contacting support.
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
              Continue to clinic setup
            </button>
            <a
              href="/login"
              className="text-center text-[13px] text-[#3d4152] hover:underline"
            >
              Sign in later from the login page
            </a>
          </div>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      flip
      greetingTitle="Hello, Welcome!"
      greetingSubtitle="Already have an account?"
      ctaLabel="Login"
      ctaHref="/login"
    >
      <section aria-labelledby="signup-title">
        <h1
          id="signup-title"
          className="text-center text-[32px] font-bold leading-tight text-[#16181d]"
        >
          Create Account
        </h1>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            id="clinicName"
            name="clinicName"
            type="text"
            required
            aria-label="Clinic Name"
            autoComplete="organization"
            className={INPUT_CLS}
            placeholder="Clinic Name"
            value={form.clinicName}
            onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
          />

          <input
            id="name"
            name="name"
            type="text"
            required
            aria-label="Doctor Name"
            autoComplete="name"
            className={INPUT_CLS}
            placeholder="Doctor Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            required
            aria-label="Phone Number"
            autoComplete="tel"
            className={`${INPUT_CLS} text-left`}
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
              aria-label="Password"
              className={`${INPUT_CLS} pr-12`}
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
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
            Create Account
          </button>
        </form>

        <SocialRow caption="or sign up with social platforms" />

        {/* العرض مرئي أثناء التسجيل نفسه — الدفع متاح من أول يوم */}
        <SignupPlansCard />

        {/* بديل لوح الترحيب على الشاشات الصغيرة — اللوح مخفي دون lg */}
        <p className="mt-6 text-center text-sm text-[#3d4152] lg:hidden">
          Already have an account?{" "}
          <a href="/login" className="font-semibold text-[#4a5cd9] hover:underline">
            Login
          </a>
        </p>
      </section>
    </AuthShell>
  );
}
