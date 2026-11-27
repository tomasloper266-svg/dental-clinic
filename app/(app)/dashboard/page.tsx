import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getDailyReport } from "@/lib/services/reports";
import { listAppointments } from "@/lib/services/appointments";
import { lowStockMaterials } from "@/lib/services/inventory";
import { listPatients } from "@/lib/services/patients";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import { dayStart, formatWeekdayDateCell } from "@/lib/dates";
// تسمية اليوم الطويلة لعنوان بطاقة مواعيد اليوم داخل المحتوى
import { formatDayLabel } from "@/lib/appointment-ui";
import {
  appointmentsWithin,
  greetingForDate,
} from "@/lib/dashboard-view";
import { outstandingDuesUsd } from "@/lib/finance-view";
import {
  currentMonthRevenue,
  dailyRevenueDual,
  monthlyRevenueDual,
} from "@/lib/revenue-views";
import { localDayOf } from "@/lib/local-day";
import { getClinicUsdRate } from "@/lib/services/account";
import { formatDualFromUsd } from "@/lib/currency";
import { CalendarDays, Coins, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { AppointmentsTimeline } from "@/components/dashboard/AppointmentsTimeline";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { LowStockPanel } from "@/components/dashboard/AlertsPanels";
import { QuickActions } from "@/components/dashboard/QuickActions";

// لوحة الطبيب — الهيكل المرجعي: شريط إجراءات وتاريخ، ثم بطاقات إحصاء بأعلى،
// ثم صف (مواعيد اليوم عريضة + رسم الدخل الحالي بجانبها)، ثم صف (آخر
// العمليات + تنبيهات المخزون). كل الأرقام من خدمات العيادة القائمة حصراً —
// لا إعادة حساب لأي منطق عمل.
export default async function DashboardPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const now = new Date();
  const fetchWindowStart = dayStart(now);
  const fetchWindowEnd = new Date(
    fetchWindowStart.getTime() + 8 * 24 * 60 * 60 * 1000,
  );

  const [
    report,
    weekAppointments,
    lowStock,
    patients,
    clinicEntries,
    usdRate,
  ] = await Promise.all([
    getDailyReport(ctx, now),
    listAppointments(ctx, fetchWindowStart, fetchWindowEnd),
    lowStockMaterials(ctx),
    listPatients(ctx),
    listClinicLedgerEntries(ctx),
    getClinicUsdRate(ctx),
  ]);

  const todaysAppointments = appointmentsWithin(
    weekAppointments,
    fetchWindowStart,
    fetchWindowEnd,
  );
  const duesUsd = outstandingDuesUsd(clinicEntries);
  const recentPayments = clinicEntries
    .filter((entry) => entry.type === "PAYMENT")
    .slice(0, 5);

  // عرضات الإيراد — من قيود العيادة المجلوبة أصلاً: بطاقة الشهر بالتعريفين،
  // وسلسلتا الرسم (أيام/أشهر) بمبدّلَي النافذة والمقياس داخل الرسم نفسه.
  const todayKey = localDayOf(now);
  const monthRevenue = currentMonthRevenue(clinicEntries, now);
  const dailySeries = dailyRevenueDual(clinicEntries, now, 7);
  const monthlySeries = monthlyRevenueDual(clinicEntries, todayKey, 6);

  return (
    <div className={pageWrapClass("wide")}>
      <PageHeader
        title={`${greetingForDate(now)}، ${session.name}`}
        description={formatWeekdayDateCell(now)}
        actions={<QuickActions />}
      />

      {/* صف بطاقات الإحصاء — المرضى، موعد اليوم، دخل اليوم، المستحقات */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={String(patients.length)}
          label="إجمالي المرضى"
          icon={Users}
        />
        <StatCard
          value={String(todaysAppointments.length)}
          label="موعد اليوم"
          icon={CalendarDays}
        />
        <StatCard
          value={formatDualFromUsd(report.collectedUsd, usdRate)}
          label="دخل اليوم"
          icon={Coins}
        />
        <StatCard
          value={formatDualFromUsd(monthRevenue.collectedUsd, usdRate)}
          label="إيراد هذا الشهر (تحصيل)"
          subLabel={`رسوم الشهر: ${formatDualFromUsd(monthRevenue.chargesUsd, usdRate)}`}
          icon={Coins}
        />
        <StatCard
          value={formatDualFromUsd(duesUsd, usdRate)}
          label="مستحقات غير مسددة"
          icon={Wallet}
          tone="danger"
        />
      </div>

      {/* صف المواعيد والرسم — مواعيد اليوم عريضة أولاً (يمين) والرسم بجانبها */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[5fr_4fr]">
        <Card>
          <CardHeader>
            <CardTitle>مواعيد اليوم — {formatDayLabel(now)}</CardTitle>
          </CardHeader>
          <CardBody>
            <AppointmentsTimeline
              appointments={todaysAppointments}
              emptyAction={
                <a
                  href="/appointments"
                  className="inline-flex h-8 items-center rounded-full border border-warm-300 bg-surface-raised px-3 text-xs font-medium text-ink-900 transition-colors hover:bg-surface-hover active:bg-surface-sunken"
                >
                  اذهب إلى المواعيد
                </a>
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الإيراد — مبدّل نافذة ومقياس</CardTitle>
          </CardHeader>
          <CardBody>
            <RevenueChart daily={dailySeries} monthly={monthlySeries} />
          </CardBody>
        </Card>
      </div>

      {/* صف العمليات والمخزون — آخر المدفوعات عريضة أولاً (يمين) وتنبيهات المخزون بجانبها */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[5fr_4fr]">
        <Card>
          <CardHeader>
            <CardTitle>آخر العمليات</CardTitle>
          </CardHeader>
          <CardBody>
            <RecentPayments entries={recentPayments} />
          </CardBody>
        </Card>

        <LowStockPanel materials={lowStock} />
      </div>
    </div>
  );
}
