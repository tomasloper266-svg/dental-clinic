import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { toDateInputValue } from "@/lib/dates";
import WaitlistBoard from "@/components/waitlist/WaitlistBoard";

// صفحة قائمة الانتظار — مرضى طالبو موعداً وفجوات جدول اليوم، محمية
// بالجلسة والبيانات من واجهة برمجة العيادة حصراً.
export default async function WaitlistPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("full")}>
      <WaitlistBoard initialDate={toDateInputValue(new Date())} />
    </div>
  );
}
