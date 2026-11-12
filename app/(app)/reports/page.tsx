import { cookies } from "next/headers";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <ReportsBoard initialDate={toDateInputValue(new Date())} />
    </div>
  );
}
