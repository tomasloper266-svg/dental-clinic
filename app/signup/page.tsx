"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

// صفحة التسجيل — أنشئ العيادة ثم اعرض رمز الاسترداد الاحتياطي مرة
// واحدة بتحذير واضح، ثم ادخل إلى صفحة الإعداد (الجلسة تُفتح تلقائياً).

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
      <AuthShell>
        <section aria-labelledby="recovery-code-title">
          <h1 id="recovery-code-title" className="text-2xl font-bold text-ink-900">
            تم إنشاء عيادتك
          </h1>

          <div className="mt-6 rounded-panel border-2 border-primary-200 bg-primary-50 p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary-900">
              <KeyRound size={18} aria-hidden />
              رمز الاسترداد الاحتياطي
            </h2>
            <p
              dir="ltr"
              className="numeric mt-4 select-all text-center text-2xl font-bold tracking-[0.25em] text-ink-900"
            >
              {created.recoveryCode}
            </p>
            <p className="mt-4 text-sm leading-6 text-primary-800">
              احفظه الآن في مكان آمن — يُعرض <strong>مرة واحدة فقط</strong>{" "}
              ولن نستطيع استرجاعه. إن ضاع رقم هاتفك ولا يوجد بريد موثق، فهذا
              الرمز هو طريقك الوحيد لاستعادة الحساب دون مراجعة الدعم.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={() => {
                router.push("/setup");
                router.refresh();
              }}
              className="w-full py-3"
            >
              متابعة إلى إعداد العيادة
            </Button>
            <Link href="/login" className="link-quiet text-center">
              الدخول لاحقاً من صفحة تسجيل الدخول
            </Link>
          </div>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <section aria-labelledby="signup-title">
        <h1 id="signup-title" className="text-2xl font-bold text-ink-900">
          تسجيل عيادة جديدة
        </h1>
        <p className="mt-2 text-sm text-warm-600">
          أنشئ مساحة عيادتك الخاصة وابدأ بإدارة المرضى والمواعيد
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <Field label="اسم العيادة" htmlFor="clinicName">
            <Input
              id="clinicName"
              required
              placeholder="مثال: عيادة الابتسامة"
              value={form.clinicName}
              onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
            />
          </Field>

          <Field label="اسم الطبيب" htmlFor="name">
            <Input
              id="name"
              required
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
              className="text-left"
              placeholder="09xxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>

          <Field label="كلمة السر" htmlFor="password" hint="8 أحرف على الأقل">
            <PasswordInput
              id="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
            >
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full py-3">
            إنشاء العيادة
          </Button>
        </form>

        <p className="mt-6 text-sm text-warm-600">
          لديك حساب بالفعل؟{" "}
          <Link
            href="/login"
            className="font-semibold text-primary-700 hover:text-primary-800"
          >
            تسجيل الدخول
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
