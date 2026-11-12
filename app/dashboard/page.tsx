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
          جلسة آمنة عاملة — وحدات المرضى والمواعيد والأودوغرام والحسابات قادمة.
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
