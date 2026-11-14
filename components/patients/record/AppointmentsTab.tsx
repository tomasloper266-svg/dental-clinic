"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, Pencil } from "lucide-react";
import type { AppointmentDto } from "@/lib/services/appointments";
import {
  STATUS_META as APPT_STATUS_META,
  formatDayLabel,
  formatTime,
} from "@/lib/appointment-ui";
import type { AppointmentJson } from "@/components/appointments/AppointmentDetailsDrawer";
import { AppointmentDetailsDrawer } from "@/components/appointments/AppointmentDetailsDrawer";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { IconAction } from "@/components/ui/TableActions";

// تبويب «المواعيد» — جدول واحد لكافة المواعيد (قادمة وسابقة) بأعمدة
// التاريخ/الوقت/الخدمة أو الطبيب/القيمة/الحالة وقلم تعديل لكل صف كالمرجع.
// القيمة غير موجودة على الموعد في المخطط — العمود موجود ويعرض «—» حتى
// تُربط المواعيد بالتسعير لاحقاً.

type Props = {
  appointments: AppointmentDto[];
  onNewAppointment: () => void;
};

/** سطر «الخدمة أو الطبيب» — سبب الزيارة أو اسم الطبيب المسند */
function serviceOrDoctor(a: AppointmentDto): string {
  if (a.reason && a.staffName) return `${a.reason} · ${a.staffName}`;
  return a.reason ?? a.staffName ?? "—";
}

export default function AppointmentsTab({
  appointments,
  onNewAppointment,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<AppointmentJson | null>(null);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays size={16} aria-hidden className="text-warm-400" />
          كافة المواعيد
          <span className="text-warm-400 numeric text-xs font-normal">
            ({appointments.length})
          </span>
        </CardTitle>
        <Button onClick={onNewAppointment} className="h-8 px-3 text-xs">
          <CalendarPlus size={14} aria-hidden />
          موعد جديد
        </Button>
      </CardHeader>
      {appointments.length === 0 ? (
        <p className="text-warm-500 p-5 text-sm">
          لا مواعيد مسجلة — احجز موعداً من زر «موعد جديد».
        </p>
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>التاريخ</TH>
              <TH>الوقت</TH>
              <TH className="hidden md:table-cell">الخدمة أو الطبيب</TH>
              <TH>القيمة</TH>
              <TH>الحالة</TH>
              <TH aria-label="إجراءات" />
            </TRow>
          </THead>
          <tbody>
            {appointments.map((a) => {
              const meta = APPT_STATUS_META[a.status];
              return (
                <TRow key={a.id}>
                  <TD>
                    <span className="text-ink-900 text-sm font-medium">
                      {formatDayLabel(a.startsAt)}
                    </span>
                  </TD>
                  <TD>
                    <span className="numeric text-warm-700 text-sm">
                      {formatTime(a.startsAt)}
                      <span className="text-warm-400 text-xs">
                        {" "}
                        · {a.durationMin}د
                      </span>
                    </span>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <span className="text-warm-700 max-w-48 truncate text-sm">
                      {serviceOrDoctor(a)}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-warm-400 numeric text-sm">—</span>
                  </TD>
                  <TD>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                  </TD>
                  <TD>
                    <IconAction
                      icon={Pencil}
                      label="تعديل الموعد"
                      onClick={() =>
                        setEditing({
                          id: a.id,
                          patientId: a.patientId,
                          patientName: a.patientName,
                          startsAt: new Date(a.startsAt).toISOString(),
                          durationMin: a.durationMin,
                          status: a.status,
                          reason: a.reason,
                          note: a.note,
                          staffId: a.staffId,
                          staffName: a.staffName,
                        })
                      }
                    />
                  </TD>
                </TRow>
              );
            })}
          </tbody>
        </Table>
      )}

      <AppointmentDetailsDrawer
        appointment={editing}
        onClose={() => setEditing(null)}
        onChanged={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </Card>
  );
}
