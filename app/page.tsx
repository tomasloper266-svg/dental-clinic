import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">نظام إدارة عيادات الأسنان</h1>
        <p className="mx-auto mt-3 max-w-md text-lg text-neutral-600 dark:text-neutral-400">
          مرضى، مواعيد، مخطط أسنان، حسابات، مخزون وتذكيرات — لكل طبيب عيادته
          الخاصة في مكان واحد.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-xl bg-teal-600 px-8 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
        >
          تسجيل عيادة جديدة
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-neutral-300 bg-white px-8 py-4 text-lg font-semibold transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          تسجيل الدخول
        </Link>
      </div>
    </main>
  );
}
