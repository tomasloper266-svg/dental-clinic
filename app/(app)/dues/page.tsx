import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getClinicUsdRate } from "@/lib/services/account";
import DuesBoard from "@/components/dues/DuesBoard";

// شاشة المستحقات — صفحة خادمية تنسيقية فقط: الجلسة وسعر الصرف من خدمات
// العيادة القائمة، والصفوف تُبنى زبونياً نقياً من قيود الدفتر عبر
// lib/dues-view.ts (نفس مصدر /api/finance/ledger — بلا أي خدمة جديدة).
export default async function DuesPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const usdRate = await getClinicUsdRate(ctx);

  return (
    <div className={pageWrapClass("full")}>
      <DuesBoard usdRate={usdRate} />
    </div>
  );
}
