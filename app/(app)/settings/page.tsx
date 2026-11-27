import { getServerT } from "@/lib/i18n";
import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import {
  getSubscriptionState,
  subscriptionProgress,
} from "@/lib/billing/state";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import SettingsBoard from "@/components/settings/SettingsBoard";
import { SubscriptionStatusCard } from "@/components/subscription/SubscriptionStatusCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatWeekdayDateCell } from "@/lib/dates";

// صفحة الإعدادات — بيانات العيادة والطبيب والحساب والأمان، محمية بالجلسة،
// وبياناتها من واجهة برمجة الحساب المرتبطة بالعيادة حصراً. قسم الاشتراك
// يظهر أعلى اللوحة: الحالة والخطط وشام كاش ورفع الحوالة (الدفع المبكر).
export default async function SettingsPage() {
  const t = await getServerT();
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const [subscription, pending, lastApproved] = await Promise.all([
    getSubscriptionState(session.clinicId),
    prisma.subscriptionPayment.findFirst({
      where: { clinicId: session.clinicId, status: "PENDING" },
      select: { id: true },
    }),
    // باقة آخر اعتماد لتحديد طول فترة شريط التقدم المدفوع
    prisma.subscriptionPayment.findFirst({
      where: { clinicId: session.clinicId, status: "APPROVED" },
      orderBy: { decidedAt: "desc" },
      select: { plan: true },
    }),
  ]);

  const shamCashAccount = process.env.SHAM_CASH_ACCOUNT?.trim() || null;
  const paidPlan = lastApproved ? SUBSCRIPTION_PLANS[lastApproved.plan] : null;
  const progress = subscription
    ? subscriptionProgress(subscription, paidPlan?.durationDays)
    : null;

  return (
    <div className={pageWrapClass("wide")}>
      {/* الترويسة أولاً ككل الصفحات، ثم بطاقة الاشتراك، ثم اللوحة نفسها */}
      <PageHeader title={t("nav.settings")} description={formatWeekdayDateCell(new Date())} />
      {subscription && progress && (
        <div className="mb-8">
          <SubscriptionStatusCard
            daysLeft={subscription.daysLeft}
            totalDays={progress.totalDays}
            pct={progress.pct}
            isTrial={subscription.isTrial}
            shamCashAccount={shamCashAccount}
            hasPendingRequest={Boolean(pending)}
          />
        </div>
      )}
      <SettingsBoard />
    </div>
  );
}
