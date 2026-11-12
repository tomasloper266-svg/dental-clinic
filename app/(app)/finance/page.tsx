import { cookies } from "next/headers";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <FinanceBoard />
    </div>
  );
}
