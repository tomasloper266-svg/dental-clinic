import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { toDateInputValue } from "@/lib/dates";
import AppointmentsBoard from "@/components/AppointmentsBoard";
import LogoutButton from "@/components/LogoutButton";

// صفحة المواعيد — جدول يومي/أسبوعي موبايل-أولاً مع حجز موعد جديد.
export default async function AppointmentsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const today = toDateInputValue(new Date());

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-800">المواعيد</h1>
          <div className="flex items-center gap-3 text-xs">
            <a href="/dashboard" className="text-teal-700 underline">
              لوحة الطبيب
            </a>
            <LogoutButton />
          </div>
        </header>
        <AppointmentsBoard initialDate={today} />
      </div>
    </main>
  );
}
