import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getClinicUsdRate } from "@/lib/services/account";
import FinanceBoard from "@/components/finance/FinanceBoard";

// صفحة الفواتير والمدفوعات — قيود العيادة الموحّدة، محمية بالجلسة والبيانات
// من واجهة برمجة العيادة حصراً. سعر الصرف من الإعدادات لعرض العملة المزدوجة.
export default async function FinancePage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const usdRate = await getClinicUsdRate(ctx);

  return (
    <div className={pageWrapClass("full")}>
      <FinanceBoard usdRate={usdRate} />
    </div>
  );
}
