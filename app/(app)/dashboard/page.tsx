import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getDailyReport, getDailySeries } from "@/lib/services/reports";
import { listAppointments } from "@/lib/services/appointments";
import { lowStockMaterials } from "@/lib/services/inventory";
import { listPatients } from "@/lib/services/patients";
import { listClinicLedgerEntries } from "@/lib/services/ledger";
import { dayStart } from "@/lib/dates";
import {
  appointmentsWithin,
  greetingForDate,
} from "@/lib/dashboard-view";
import { outstandingDuesSyp } from "@/lib/finance-view";
import { formatDayLabel } from "@/lib/appointment-ui";
import { formatSyp } from "@/lib/utils";
import { CalendarDays, Coins, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { AppointmentsTimeline } from "@/components/dashboard/AppointmentsTimeline";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { LowStockPanel } from "@/components/dashboard/AlertsPanels";
import { QuickActions } from "@/components/dashboard/QuickActions";

// لوحة الطبيب — الهيكل المرجعي: بطاقات إحصاء بأعلى، ثم صف (رسم المدخول
// + مواعيد اليوم)، ثم صف (آخر المدفوعات + تنبيهات المخزون). كل الأرقام
// من خدمات العيادة القائمة حصراً — لا إعادة حساب لأي منطق عمل.
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
    series,
    clinicEntries,
  ] = await Promise.all([
    getDailyReport(ctx, now),
    listAppointments(ctx, fetchWindowStart, fetchWindowEnd),
    lowStockMaterials(ctx),
    listPatients(ctx),
    getDailySeries(ctx, now, 7),
    listClinicLedgerEntries(ctx),
  ]);

  const todaysAppointments = appointmentsWithin(
    weekAppointments,
    fetchWindowStart,
    fetchWindowEnd,
  );
  const duesSyp = outstandingDuesSyp(clinicEntries);
  const weekCollectedSyp = series.reduce(
    (sum, point) => sum + point.collectedSyp,
    0,
  );
  const recentPayments = clinicEntries
    .filter((entry) => entry.type === "PAYMENT")
    .slice(0, 5);

  return (
    <div className={pageWrapClass("wide")}>
      <PageHeader
        title={`${greetingForDate(now)}، ${session.name}`}
        description={formatDayLabel(now)}
        actions={<QuickActions />}
      />

      {/* صف بطاقات الإحصاء — مواعيد اليوم، مدخول الأسبوع، المستحقات، المرضى */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          value={String(todaysAppointments.length)}
          label="مواعيد اليوم"
          icon={CalendarDays}
        />
        <StatCard
          value={formatSyp(weekCollectedSyp)}
          label="إجمالي المدخول (7 أيام)"
          icon={Coins}
        />
        <StatCard
          value={formatSyp(duesSyp)}
          label="مستحقات غير مسددة"
          icon={Wallet}
          tone="danger"
        />
        <StatCard
          value={String(patients.length)}
          label="عدد المرضى"
          icon={Users}
        />
      </div>

      {/* صف الرسم والمواعيد — الرسم عريض ومواعيد اليوم بجانبه */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>المدخول — آخر 7 أيام</CardTitle>
          </CardHeader>
          <CardBody>
            <RevenueChart points={series} />
            <p className="mt-3 text-xs text-warm-400">
              المدفوعات المجمّعة اليومية — صافي اليوم {formatSyp(report.netSyp)}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>مواعيد اليوم</CardTitle>
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
      </div>

      {/* صف المدفوعات وتنبيهات المخزون — لوحة المخزون تحمل عنوانها وحدودها بنفسها */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>آخر المدفوعات</CardTitle>
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
