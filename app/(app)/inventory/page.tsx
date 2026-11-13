import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getClinicUsdRate } from "@/lib/services/account";
import InventoryBoard from "@/components/inventory/InventoryBoard";

// صفحة المخزون — مواد العيادة وكمياتها وحدود تنبيهها، محمية بالجلسة
// والبيانات من واجهة برمجة العيادة حصراً. سعر الصرف من الإعدادات لعرض
// العملة المزدوجة في عمود التكلفة.
export default async function InventoryPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const usdRate = await getClinicUsdRate(ctx);

  return (
    <div className={pageWrapClass("full")}>
      <InventoryBoard usdRate={usdRate} />
    </div>
  );
}
