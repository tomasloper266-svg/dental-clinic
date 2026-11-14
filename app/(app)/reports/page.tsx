import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getClinicUsdRate } from "@/lib/services/account";
import { formatWeekdayDateCell } from "@/lib/dates";
import { localDayOf } from "@/lib/local-day";
import ReportsBoard from "@/components/reports/ReportsBoard";

// صفحة التقارير — تقرير فترة كامل (خيارات جاهزة ومدى مخصص من/إلى وتصدير
// CSV)، محمية بالجلسة وبياناتها من واجهة العيادة حصراً. سعر الصرف من
// الإعدادات لعرض مبالغ الدولار، والتاريخ من الخادم لتثبيت الترويسة.
export default async function ReportsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const usdRate = await getClinicUsdRate(ctx);
  const now = new Date();
  // «اليوم» بتوقيت العيادة (دمشق) لا UTC — خيارات الفترة والمدى المخصص
  // ينبغي أن ينتهيا بيوم دمشق الحالي مهما كان توقيت الخادم
  const todayValue = localDayOf(now);

  return (
    <div className={pageWrapClass("wide")}>
      <ReportsBoard
        todayValue={todayValue}
        todayLabel={formatWeekdayDateCell(now, "Asia/Damascus")}
        usdRate={usdRate}
      />
    </div>
  );
}
