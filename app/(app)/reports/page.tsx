import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getClinicUsdRate } from "@/lib/services/account";
import { toDateInputValue } from "@/lib/dates";
import ReportsBoard from "@/components/reports/ReportsBoard";

// صفحة التقارير — تقارير الفترة والرسوم اليومية والمصاريف، محمية
// بالجلسة والبيانات من واجهة برمجة العيادة حصراً. سعر الصرف من الإعدادات
// لعرض العملة المزدوجة في كل مبالغ التقرير.
export default async function ReportsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const usdRate = await getClinicUsdRate(ctx);

  return (
    <div className={pageWrapClass("wide")}>
      <ReportsBoard initialDate={toDateInputValue(new Date())} usdRate={usdRate} />
    </div>
  );
}
