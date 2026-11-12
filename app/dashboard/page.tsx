import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import LogoutButton from "@/components/LogoutButton";

// لوحة مؤقتة محمية — تثبت الجلسة وتُستبدل بلوحة الطبيب الكاملة في وحدات النطاق.
export default async function DashboardPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
        <h1 className="text-xl font-bold text-teal-800">
          مرحباً، {session.name}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          جلسة آمنة عاملة — وحدات الأودوغرام والحسابات والمخزون قادمة.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href="/patients"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            المرضى
          </a>
          <a
            href="/appointments"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            المواعيد وقائمة الانتظار
          </a>
          <a
            href="/reminders"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            تذكير الغد
          </a>
          <a
            href="/instructions"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            قوالب التعليمات
          </a>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
