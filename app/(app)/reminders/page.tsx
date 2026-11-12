import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { addDays } from "@/lib/dates";
import RemindersBoard from "@/components/reminders/RemindersBoard";

// صفحة التذكير اليومي — لوحة عمليات عريضة: مواعيد الغد بأرقامها وأزرار
// واتساب لكل مريض. التنقل والخروج من السايدبار لا من الصفحة، والهوية
// من الـ tokens لا من ألوان خام.
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
    <div className={pageWrapClass("full")}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-primary-800 text-xl font-semibold">
          تذكير الغد — {label}
        </h1>
        <p className="text-warm-500 text-xs">
          لوحة عمليات: أرسل التذكير لكل مريض بواتساب أو انسخ نصّه
        </p>
      </header>
      <div className="mt-5">
        <RemindersBoard />
      </div>
    </div>
  );
}
