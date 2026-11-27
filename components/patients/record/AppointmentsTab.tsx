"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, Pencil } from "lucide-react";
import type { AppointmentDto } from "@/lib/services/appointments";
import { STATUS_META as APPT_STATUS_META } from "@/lib/appointment-ui";
import { formatDate, formatTime } from "@/lib/i18n/format";
import type { AppointmentJson } from "@/components/appointments/AppointmentDetailsDrawer";
import { AppointmentDetailsDrawer } from "@/components/appointments/AppointmentDetailsDrawer";
import { useI18n } from "@/components/i18n/I18nProvider";
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
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<AppointmentJson | null>(null);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays size={16} aria-hidden className="text-warm-400" />
          {t("apptTab.all")}
          <span className="text-warm-400 numeric text-xs font-normal">
            ({appointments.length})
          </span>
        </CardTitle>
        <Button onClick={onNewAppointment} className="h-8 px-3 text-xs">
          <CalendarPlus size={14} aria-hidden />
          {t("appt.new")}
        </Button>
      </CardHeader>
      {appointments.length === 0 ? (
        <p className="text-warm-500 p-5 text-sm">{t("apptTab.empty")}</p>
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>{t("apptTab.col.date")}</TH>
              <TH>{t("apptTab.col.time")}</TH>
              <TH className="hidden md:table-cell">
                {t("apptTab.col.service")}
              </TH>
              <TH>{t("apptTab.col.value")}</TH>
              <TH>{t("apptTab.col.status")}</TH>
              <TH aria-label={t("patients.col.actions")} />
            </TRow>
          </THead>
          <tbody>
            {appointments.map((a) => {
              const meta = APPT_STATUS_META[a.status];
              return (
                <TRow key={a.id}>
                  <TD>
                    <span className="text-ink-900 text-sm font-medium">
                      {formatDate(a.startsAt, locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </TD>
                  <TD>
                    <span className="numeric text-warm-700 text-sm">
                      {formatTime(a.startsAt, locale)}
                      <span className="text-warm-400 text-xs">
                        {" "}
                        · {t("record.minShort", { minutes: a.durationMin })}
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
                      {t(meta.labelKey)}
                    </span>
                  </TD>
                  <TD>
                    <IconAction
                      icon={Pencil}
                      label={t("apptTab.editAria")}
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
