"use client";

import { CalendarDays, ClipboardList } from "lucide-react";
import type { AppointmentDto } from "@/lib/services/appointments";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import { parseMedicalNotes } from "@/lib/medical-notes";
import { planTotals } from "@/lib/treatment-plan-view";
import { splitAppointments } from "@/lib/patient-profile";
import { formatSyp } from "@/lib/utils";
import {
  STATUS_META as APPT_STATUS_META,
  formatDayLabel,
  formatTime,
} from "@/lib/appointment-ui";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// تبويب «نظرة عامة» في ملف المريض — الملاحظات الطبية المهيكلة أولًا (الأخطر
// سريرياً)، ثم ملخص خطة العلاج والمواعيد القادمة كنقاط انطلاق إلى تبويبَيها.

type Props = {
  medicalNotes: string | null;
  planItems: PlanItemDto[];
  appointments: AppointmentDto[];
  onOpenPlans: () => void;
  onOpenAppointments: () => void;
};

function NoteSection({
  title,
  value,
  tone = "plain",
}: {
  title: string;
  value: string;
  tone?: "plain" | "danger";
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-xs font-semibold ${tone === "danger" ? "text-danger-700" : "text-warm-600"}`}
      >
        {title}
      </p>
      <p className="text-ink-900 mt-1 text-sm leading-6 whitespace-pre-line">
        {value}
      </p>
    </div>
  );
}

const PLAN_STATUS_LABELS = {
  PROPOSED: "مخطط",
  ACCEPTED: "مقبول",
  DONE: "منفذ",
} as const;

export default function OverviewTab({
  medicalNotes,
  planItems,
  appointments,
  onOpenPlans,
  onOpenAppointments,
}: Props) {
  const notes = parseMedicalNotes(medicalNotes);
  const hasNotes = Boolean(
    notes.allergies || notes.conditions || notes.medications || notes.other,
  );

  const totals = planTotals(planItems);
  const now = new Date();
  const { upcoming } = splitAppointments(appointments, now);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {/* ─── الملاحظات الطبية المهيكلة ─────────────────────────────── */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>الملاحظات الطبية</CardTitle>
        </CardHeader>
        {hasNotes ? (
          <div className="grid gap-5 p-5 sm:grid-cols-3">
            <NoteSection title="حساسية" value={notes.allergies} tone="danger" />
            <NoteSection title="أمراض مزمنة" value={notes.conditions} />
            <NoteSection title="أدوية حالية" value={notes.medications} />
            {notes.other && (
              <div className="sm:col-span-3">
                <NoteSection title="ملاحظات أخرى" value={notes.other} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-warm-500 p-5 text-sm">
            لا ملاحظات طبية مسجلة — تُدخل من «تحرير البيانات».
          </p>
        )}
      </Card>

      {/* ─── عمود جانبي: ملخص الخطة ثم المواعيد القادمة ─────────────── */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList size={16} aria-hidden className="text-warm-400" />
              خطة العلاج
            </CardTitle>
            <button
              type="button"
              onClick={onOpenPlans}
              className="text-primary-700 hover:text-primary-800 text-xs font-medium hover:underline"
            >
              إدارة الخطة ←
            </button>
          </CardHeader>
          {planItems.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="لا بنود علاج مسجلة"
                description="تُضاف بنود الخطة المسعّرة من تبويب خطط العلاج باختيار سن ثم إدخال الإجراء وسعره."
                action={
                  <button
                    type="button"
                    onClick={onOpenPlans}
                    className="bg-primary-600 hover:bg-primary-700 active:bg-primary-800 inline-flex h-8 items-center rounded-field px-3 text-xs font-medium text-white transition-colors"
                  >
                    افتح تبويب الخطة
                  </button>
                }
                className="border-0 bg-transparent py-4"
              />
            </div>
          ) : (
            <div className="space-y-2 p-5">
              <div className="grid grid-cols-3 gap-2">
                {(["PROPOSED", "ACCEPTED", "DONE"] as const).map((status) => {
                  const summary = totals.byStatus[status];
                  return (
                    <div
                      key={status}
                      className="border-warm-200 bg-surface rounded-panel border px-2.5 py-2 text-center"
                    >
                      <span className="text-warm-500 text-[11px]">
                        {PLAN_STATUS_LABELS[status]}
                      </span>
                      <p className="text-ink-900 numeric text-sm font-semibold">
                        {formatSyp(summary.total)}
                      </p>
                      <span className="text-warm-400 numeric text-[11px]">
                        {summary.count} بند
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-primary-200 bg-primary-50 flex items-center justify-between rounded-panel border px-3 py-2">
                <span className="text-primary-800 text-xs font-medium">
                  إجمالي الخطة
                </span>
                <span className="numeric text-primary-800 text-sm font-semibold">
                  {formatSyp(totals.grandTotal)}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays size={16} aria-hidden className="text-warm-400" />
              المواعيد القادمة
            </CardTitle>
            <button
              type="button"
              onClick={onOpenAppointments}
              className="text-primary-700 hover:text-primary-800 text-xs font-medium hover:underline"
            >
              كل المواعيد ←
            </button>
          </CardHeader>
          {upcoming.length === 0 ? (
            <p className="text-warm-500 p-5 text-sm">لا مواعيد قادمة.</p>
          ) : (
            <ul className="divide-warm-200 divide-y">
              {upcoming.slice(0, 5).map((a) => (
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
    </div>
  );
}
