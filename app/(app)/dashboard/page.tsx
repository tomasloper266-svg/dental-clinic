import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getDailyReport } from "@/lib/services/reports";
import { listAppointments } from "@/lib/services/appointments";
import { listWaitlist } from "@/lib/services/waitlist";
import { lowStockMaterials } from "@/lib/services/inventory";
import { listPatients } from "@/lib/services/patients";
import { dayStart } from "@/lib/dates";
import {
  appointmentsWithin,
  countDistinctPatients,
  selectUpcomingAppointments,
} from "@/lib/dashboard-view";
import { formatDayLabel } from "@/lib/appointment-ui";
import { DailySummaryStrip } from "@/components/dashboard/DailySummaryStrip";
import { AppointmentsTimeline } from "@/components/dashboard/AppointmentsTimeline";
import {
  LowStockPanel,
  RecentPatientsPanel,
  UpcomingAppointmentsPanel,
} from "@/components/dashboard/AlertsPanels";
import { QuickActions } from "@/components/dashboard/QuickActions";

// لوحة الطبيب — أول شاشة بعد الدخول: تجمع أرقام اليوم ومواعيده وتنبيهاته من
// خدمات القائمة حصراً (لا إعادة حساب لأي منطق عمل). نافذة جلب واحدة تغطي
// اليوم وأسبوعه القادم: منها مواعيد اليوم والمواعيد القادمة معاً.
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

  const [report, weekAppointments, waitlist, lowStock, patients] =
    await Promise.all([
      getDailyReport(ctx, now),
      listAppointments(ctx, fetchWindowStart, fetchWindowEnd),
      listWaitlist(ctx),
      lowStockMaterials(ctx),
      listPatients(ctx),
    ]);

  const todaysAppointments = appointmentsWithin(
    weekAppointments,
    fetchWindowStart,
    fetchWindowEnd,
  );
  const upcoming = selectUpcomingAppointments(weekAppointments, 5);

  return (
    <div className={pageWrapClass("wide")}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-xl font-semibold">
            مرحباً، {session.name}
          </h1>
          <p className="text-warm-500 mt-1 text-sm">{formatDayLabel(now)}</p>
        </div>
        <QuickActions />
      </header>

      <div className="mt-5">
        <DailySummaryStrip
          netSyp={report.netSyp}
          collectedSyp={report.collectedSyp}
          expensesSyp={report.expensesSyp}
          patientsToday={countDistinctPatients(todaysAppointments)}
          waitlistCount={waitlist.length}
        />
      </div>

      {/* تخطيط غير متماثل: الخط الزمني عريض وعمود التنبيهات جانبي */}
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-3">
        <section className="rounded-panel border-warm-200 bg-surface-raised border lg:col-span-2">
          <h2 className="border-warm-200 text-ink-900 border-b px-5 py-4 text-base font-semibold">
            مواعيد اليوم
          </h2>
          <AppointmentsTimeline
            appointments={todaysAppointments}
            emptyAction={
              <a
                href="/appointments"
                className="rounded-field border-warm-300 bg-surface-raised text-ink-900 hover:bg-surface-hover active:bg-surface-sunken inline-flex h-8 items-center border px-3 text-xs font-medium transition-colors"
              >
                اذهب إلى المواعيد
              </a>
            }
          />
        </section>

        <div className="flex flex-col gap-4">
          <UpcomingAppointmentsPanel appointments={upcoming} />
          <LowStockPanel materials={lowStock} />
          <RecentPatientsPanel patients={patients} />
        </div>
      </div>
    </div>
  );
}
