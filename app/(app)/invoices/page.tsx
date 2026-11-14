import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getClinicUsdRate } from "@/lib/services/account";
import InvoicesBoard from "@/components/finance/InvoicesBoard";

// صفحة الفواتير والمدفوعات — مشتقة من دفتر العيادة، محمية بالجلسة والبيانات
// من واجهة العيادة حصراً. سعر الصرف من الإعدادات لعرض المبالغ بالدولار.
export default async function InvoicesPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const usdRate = await getClinicUsdRate(ctx);

  return (
    <div className={pageWrapClass("full")}>
      <InvoicesBoard usdRate={usdRate} />
    </div>
  );
}
