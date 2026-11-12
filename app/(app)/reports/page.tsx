import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { toDateInputValue } from "@/lib/dates";
import ReportsBoard from "@/components/reports/ReportsBoard";

// صفحة التقارير — تقارير الفترة والرسوم اليومية والمصاريف، محمية
// بالجلسة والبيانات من واجهة برمجة العيادة حصراً.
export default async function ReportsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("wide")}>
      <ReportsBoard initialDate={toDateInputValue(new Date())} />
    </div>
  );
}
