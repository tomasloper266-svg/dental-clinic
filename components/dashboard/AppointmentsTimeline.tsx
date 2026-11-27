import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { STATUS_META } from "@/lib/appointment-ui";
import { formatTime, getLocale, getT } from "@/lib/i18n";
import type { AppointmentDto } from "@/lib/services/appointments";
// خط زمني لمواعيد اليوم — صف لكل موعد بألوان الحالة المعتمدة عبر النظام
// (STATUS_META) مع تسمية نصية صريحة حتى لا يعتمد التمييز على اللون وحده.
// كل موعد يفتح ملف مريضه. على الموبايل تتحول الأعمدة إلى بطاقات مكدسة.

type AppointmentsTimelineProps = {
  appointments: AppointmentDto[];
  /** نصوص الفراغ — لعيادة جديدة بلا مواعيد بعد */
  emptyAction?: React.ReactNode;
};

export async function AppointmentsTimeline({
  appointments,
  emptyAction,
}: AppointmentsTimelineProps) {
  const locale = await getLocale();
  const t = getT(locale);
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t("timeline.noAppointmentsToday")}
        description={t("timeline.emptyDesc")}
        action={emptyAction}
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {appointments.map((appt, index) => {
        const meta = STATUS_META[appt.status];
        return (
          <li
            key={appt.id}
            className={cn(
              "flex items-start gap-4 px-5 py-3",
              index > 0 && "border-warm-100 border-t",
            )}
          >
            {/* عمود الوقت — ثابت العرض بأرقام تبويبية */}
            <time
              dateTime={appt.startsAt.toISOString()}
              className="numeric text-warm-600 w-16 shrink-0 pt-0.5 text-sm font-medium whitespace-nowrap"
            >
              {formatTime(appt.startsAt, locale)}
            </time>

            {/* خط الحالة — تظليل جانبي بلون شارة الحالة */}
            <span
              aria-hidden
              className={cn(
                "mt-1 h-10 w-1 shrink-0 rounded-full",
                statusBarTone[appt.status],
              )}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a
                  href={`/patients/${encodeURIComponent(appt.patientId)}/odontogram`}
                  className="text-ink-900 hover:text-primary-700 truncate text-sm font-semibold hover:underline"
                >
                  {appt.patientName}
                </a>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                    meta.chip,
                  )}
                >
                  {t(meta.labelKey)}
                </span>
              </div>
              <p className="text-warm-500 mt-0.5 truncate text-xs">
                {t("timeline.duration", { minutes: appt.durationMin })}
                {appt.reason ? ` — ${appt.reason}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// الشريط اللوني لكل حالة — نفس بيانات العرض في STATUS_META (نقطة النبرة).
const statusBarTone: Record<AppointmentDto["status"], string> = {
  SCHEDULED: STATUS_META.SCHEDULED.dot,
  CONFIRMED: STATUS_META.CONFIRMED.dot,
  IN_TREATMENT: STATUS_META.IN_TREATMENT.dot,
  COMPLETED: STATUS_META.COMPLETED.dot,
  CANCELLED: STATUS_META.CANCELLED.dot,
  NO_SHOW: STATUS_META.NO_SHOW.dot,
};
