import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { cn } from "@/components/ui/cn";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { addDays } from "@/lib/dates";
import RemindersBoard from "@/components/reminders/RemindersBoard";
import LogoutButton from "@/components/LogoutButton";

// صفحة التذكير اليومي — مواعيد الغد بأرقامها وأزرار واتساب لكل مريض.
export default async function RemindersPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const tomorrow = addDays(new Date(), 1);
  const label = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(tomorrow);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className={cn(pageWrapClass("wide"), "flex flex-col gap-4")}>
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-800">
            تذكير الغد — {label}
          </h1>
          <div className="flex items-center gap-3 text-xs">
            <a href="/appointments" className="text-teal-700 underline">
              المواعيد
            </a>
            <a href="/dashboard" className="text-teal-700 underline">
              لوحة الطبيب
            </a>
            <LogoutButton />
          </div>
        </header>
        <RemindersBoard />
      </div>
    </main>
  );
}
