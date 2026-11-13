import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import RemindersBoard from "@/components/reminders/RemindersBoard";

// صفحة التذكير اليومي — لوحة عمليات عريضة: الترويسة وزر التجهيز وبطاقات
// الإحصاء من المكوّن المشترك (RemindersBoard). التنقل والخروج من السايدبار
// لا من الصفحة، والهوية من الـ tokens لا من ألوان خام.
export default async function RemindersPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("full")}>
      <RemindersBoard />
    </div>
  );
}
