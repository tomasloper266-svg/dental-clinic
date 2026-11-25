"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialRow } from "@/components/auth/SocialRow";
import { Field, Input } from "@/components/ui/Field";
import { SignupPlansCard } from "@/components/subscription/SignupPlansCard";

// صفحة التسجيل — نفس بطاقة الدخول معكوسة: لوح ترحيبي أزرق يميناً
// وزر انتقال لصفحة الدخول. أنشئ العيادة ثم اعرض رمز الاسترداد
// الاحتياطي مرة واحدة بتحذير واضح، ثم ادخل إلى صفحة الإعداد
// (الجلسة تُفتح تلقائياً).

const INPUT_CLS =
  "h-11 rounded-lg border-0 bg-[#eceef6] text-sm text-ink-900 placeholder:text-warm-400 focus:outline-2 focus:outline-offset-0 focus:outline-[#5b6ce4]";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clinicName: "",
    name: "",
    phone: "",
    password: "",
  });
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
        setError(data.error ?? "حدث خطأ غير متوقع");
        return;
      }
      setCreated({ recoveryCode: data.recoveryCode });
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <AuthShell
        greetingTitle="تم إنشاء العيادة"
        greetingSubtitle="رمز الاسترداد يظهر في هذه الصفحة مرة واحدة"
        ctaLabel="تسجيل الدخول"
        ctaHref="/login"
      >
        <section aria-labelledby="recovery-code-title">
          <h1 id="recovery-code-title" className="text-center text-3xl font-bold text-ink-900">
            تم إنشاء عيادتك
          </h1>

          <div className="mt-6 rounded-2xl border-2 border-[#c9d0f5] bg-[#eef0fb] p-6">
            <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-[#3a4bc4]">
              <KeyRound size={18} aria-hidden />
              رمز الاسترداد الاحتياطي
            </h2>
            <p
              dir="ltr"
              className="numeric mt-4 select-all text-center text-2xl font-bold tracking-[0.25em] text-ink-900"
            >
              {created.recoveryCode}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#3a4bc4]">
              احفظه الآن في مكان آمن — يُعرض <strong>مرة واحدة فقط</strong>{" "}
              ولن نستطيع استرجاعه. إن ضاع رقم هاتفك ولا يوجد بريد موثق، فهذا
              الرمز هو طريقك الوحيد لاستعادة الحساب دون مراجعة الدعم.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                router.push("/setup");
                router.refresh();
              }}
              className="h-11 w-full rounded-lg text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ background: "#5B6CE4" }}
            >
              متابعة إلى إعداد العيادة
            </button>
            <Link href="/login" className="text-center text-xs text-[#8a8da3] hover:text-ink-700">
              الدخول لاحقاً من صفحة تسجيل الدخول
            </Link>
          </div>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      flip
      greetingTitle="أهلاً بعودتك!"
      greetingSubtitle="لديك حساب بالفعل؟"
      ctaLabel="تسجيل الدخول"
      ctaHref="/login"
    >
      <section aria-labelledby="signup-title">
        <h1 id="signup-title" className="text-center text-3xl font-bold text-ink-900">
          إنشاء حساب
        </h1>
        <p className="mt-2 text-center text-sm text-warm-600">
          أنشئ مساحة عيادتك الخاصة وابدأ بإدارة المرضى والمواعيد
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="اسم العيادة" htmlFor="clinicName">
            <Input
              id="clinicName"
              required
              className={INPUT_CLS}
              placeholder="مثال: عيادة الابتسامة"
              value={form.clinicName}
              onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
            />
          </Field>

          <Field label="اسم الطبيب" htmlFor="name">
            <Input
              id="name"
              required
              className={INPUT_CLS}
              placeholder="د. محمد"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="رقم الهاتف" htmlFor="phone" hint="سيكون معرّف دخولك">
            <Input
              id="phone"
              type="tel"
              dir="ltr"
              required
              className={`${INPUT_CLS} text-left`}
              placeholder="09xxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>

          <Field label="كلمة السر" htmlFor="password" hint="8 أحرف على الأقل">
            <input
              id="password"
              type="password"
              required
              minLength={8}
              dir="ltr"
              autoComplete="new-password"
              className={`${INPUT_CLS} w-full px-4 py-2.5 text-left`}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

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
            إنشاء العيادة
          </button>
        </form>

        <SocialRow />

        {/* العرض مرئي أثناء التسجيل نفسه — الدفع متاح من أول يوم */}
        <SignupPlansCard />

        {/* بديل لوح الترحيب على الشاشات الصغيرة — اللوح مخفي دون lg */}
        <p className="mt-6 text-center text-sm text-warm-600 lg:hidden">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-semibold text-[#4a5cd9] hover:text-[#3a4bc4]">
            تسجيل الدخول
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
