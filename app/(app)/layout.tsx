import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { UNLOCK_COOKIE, isUnlocked } from "@/lib/auth/app-lock";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { listWaitlist } from "@/lib/services/waitlist";
import { lowStockMaterials } from "@/lib/services/inventory";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import { outstandingDuesSyp } from "@/lib/finance-view";
import {
  getClinicCurrency,
  getClinicName,
  getClinicUsdRate,
} from "@/lib/services/account";
import { AppShell } from "@/components/shell/AppShell";
import { LockScreen } from "@/components/shell/LockScreen";
import { CurrencyProvider } from "@/components/ui/CurrencyContext";

// غلاف الصفحات المحمية — الجلسة من الكوكي، والشارات والمستحقات من خدمات
// العيادة حصراً. المستحقات = مجمع أرصدة المرضى الموجبة (لا يُعاد حسابها هنا).
// تفعيل قفل الحساب يحول كل شيء لشاشة قفل كاملة الشاشة حتى إدخال الرمز الرقمي.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionUser(sessionToken);
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const [waitlist, lowStock, ledgerEntries, usdRate, clinicName, currency] =
    await Promise.all([
      listWaitlist(ctx),
      lowStockMaterials(ctx),
      listClinicLedgerEntries(ctx),
      getClinicUsdRate(ctx),
      getClinicName(ctx),
      getClinicCurrency(ctx),
    ]);

  const locked =
    session.lockEnabled &&
    !isUnlocked(sessionToken, cookieStore.get(UNLOCK_COOKIE)?.value);
  if (locked) {
    return (
      <LockScreen
        userName={session.name}
        clinicName={clinicName}
      />
    );
  }

  return (
    <CurrencyProvider currency={currency} usdRate={usdRate}>
      <AppShell
        userName={session.name}
        clinicName={clinicName}
        badges={{ waitlist: waitlist.length, lowStock: lowStock.length }}
        outstandingDuesSyp={outstandingDuesSyp(ledgerEntries)}
        usdRate={usdRate}
        lockEnabled={session.lockEnabled}
      >
        {children}
      </AppShell>
    </CurrencyProvider>
  );
}
