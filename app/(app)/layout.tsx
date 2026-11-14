import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { listWaitlist } from "@/lib/services/waitlist";
import { lowStockMaterials } from "@/lib/services/inventory";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import { outstandingDuesSyp } from "@/lib/finance-view";
import { getClinicName, getClinicUsdRate } from "@/lib/services/account";
import { AppShell } from "@/components/shell/AppShell";

// غلاف الصفحات المحمية — الجلسة من الكوكي، والشارات والمستحقات من خدمات
// العيادة حصراً. المستحقات = مجمع أرصدة المرضى الموجبة (لا يُعاد حسابها هنا).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const [waitlist, lowStock, ledgerEntries, usdRate, clinicName] =
    await Promise.all([
      listWaitlist(ctx),
      lowStockMaterials(ctx),
      listClinicLedgerEntries(ctx),
      getClinicUsdRate(ctx),
      getClinicName(ctx),
    ]);

  return (
    <AppShell
      userName={session.name}
      clinicName={clinicName}
      badges={{ waitlist: waitlist.length, lowStock: lowStock.length }}
      outstandingDuesSyp={outstandingDuesSyp(ledgerEntries)}
      usdRate={usdRate}
    >
      {children}
    </AppShell>
  );
}
