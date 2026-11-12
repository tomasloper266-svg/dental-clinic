"use client";

import { CalendarDays, CalendarPlus, History } from "lucide-react";
import type { AppointmentDto } from "@/lib/services/appointments";
import { splitAppointments } from "@/lib/patient-profile";
import {
  STATUS_META as APPT_STATUS_META,
  formatDayLabel,
  formatTime,
} from "@/lib/appointment-ui";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

// تبويب «المواعيد» في ملف المريض — القائمة الكاملة قادمة وسابقة بحالاتها،
// نهاية القص المقطوع (أول 4 قادمة وأول 5 سابقة) في ملف المريض القديم.

type Props = {
  appointments: AppointmentDto[];
  onNewAppointment: () => void;
};

export default function AppointmentsTab({
  appointments,
  onNewAppointment,
}: Props) {
  const now = new Date();
  const { upcoming, past } = splitAppointments(appointments, now);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays size={16} aria-hidden className="text-warm-400" />
            المواعيد القادمة
            <span className="text-warm-400 numeric text-xs font-normal">
              ({upcoming.length})
            </span>
          </CardTitle>
          <Button
            variant="secondary"
            onClick={onNewAppointment}
            className="h-8 px-3 text-xs"
          >
            <CalendarPlus size={14} aria-hidden />
            موعد جديد
          </Button>
        </CardHeader>
        {upcoming.length === 0 ? (
          <p className="text-warm-500 p-5 text-sm">
            لا مواعيد قادمة — احجز موعداً من زر «موعد جديد».
          </p>
        ) : (
          <ul className="divide-warm-200 divide-y">
            {upcoming.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-2 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-ink-900 text-sm font-medium">
                    {formatDayLabel(a.startsAt)}
                  </p>
                  <p className="text-warm-500 numeric text-xs">
                    {formatTime(a.startsAt)} · {a.durationMin} دقيقة
                  </p>
                  {a.reason && (
                    <p className="text-warm-600 mt-0.5 truncate text-xs">
                      {a.reason}
                    </p>
                  )}
                </div>
                <span
                  className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${APPT_STATUS_META[a.status].chip}`}
                >
                  {APPT_STATUS_META[a.status].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={16} aria-hidden className="text-warm-400" />
            الزيارات السابقة
            <span className="text-warm-400 numeric text-xs font-normal">
              ({past.length})
            </span>
          </CardTitle>
        </CardHeader>
        {past.length === 0 ? (
          <p className="text-warm-500 p-5 text-sm">لا زيارات سابقة.</p>
        ) : (
          <ul className="divide-warm-200 divide-y">
            {past.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-2 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-ink-900 text-sm font-medium">
                    {formatDayLabel(a.startsAt)}
                  </p>
                  <p className="text-warm-500 numeric text-xs">
                    {formatTime(a.startsAt)} · {a.durationMin} دقيقة
                  </p>
                  {a.reason && (
                    <p className="text-warm-600 mt-0.5 truncate text-xs">
                      {a.reason}
                    </p>
                  )}
                </div>
                <span
                  className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${APPT_STATUS_META[a.status].chip}`}
                >
                  {APPT_STATUS_META[a.status].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
