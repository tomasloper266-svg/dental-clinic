import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import FinanceBoard from "@/components/finance/FinanceBoard";

// صفحة الدفتر المالي — قيود العيادة الموحّدة، محمية بالجلسة والبيانات
// من واجهة برمجة العيادة حصراً.
export default async function FinancePage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("full")}>
      <FinanceBoard />
    </div>
  );
}
