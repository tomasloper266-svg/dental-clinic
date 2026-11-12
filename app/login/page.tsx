"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: "", password: "" });
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
        body: JSON.stringify(form),
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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold text-teal-800">
          تسجيل الدخول
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          أدخل بيانات حسابك للوصول إلى عيادتك
        </p>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-md"
        >
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
            {submitting ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          ليس لديك عيادة بعد؟{" "}
          <Link href="/signup" className="font-semibold text-teal-700">
            سجّل عيادتك
          </Link>
        </p>
      </div>
    </main>
  );
}
