"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    clinicName: "",
    name: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ غير متوقع");
        return;
      }
      setSuccess(true);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
          <h1 className="text-xl font-bold text-teal-800">تم إنشاء العيادة</h1>
          <p className="mt-2 text-sm text-gray-600">
            أصبح حسابك جاهزاً — سجّل الدخول للبدء.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white"
          >
            تسجيل الدخول
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold text-teal-800">
          تسجيل عيادة جديدة
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          أنشئ مساحة عيادتك الخاصة وابدأ بإدارة المرضى والمواعيد
        </p>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-md"
        >
          <div>
            <label htmlFor="clinicName" className="mb-1 block text-sm font-medium">
              اسم العيادة
            </label>
            <input
              id="clinicName"
              type="text"
              required
              value={form.clinicName}
              onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-600 focus:outline-none"
              placeholder="مثال: عيادة الابتسامة"
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              اسم الطبيب
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-600 focus:outline-none"
              placeholder="د. محمد"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium">
              رقم الهاتف
            </label>
            <input
              id="phone"
              type="tel"
              dir="ltr"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left focus:border-teal-600 focus:outline-none"
              placeholder="09xxxxxxxx"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              كلمة السر
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal-600 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "جارٍ الإنشاء..." : "إنشاء العيادة"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          لديك عيادة مسجلة؟{" "}
          <Link href="/login" className="font-semibold text-teal-700">
            سجّل الدخول
          </Link>
        </p>
      </div>
    </main>
  );
}
