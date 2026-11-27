"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { StaffMemberDto } from "@/lib/services/staff";
import { doctorDisplayName } from "@/lib/staff-name";
import { STATUS_META, formatTime, timeRangeLabel } from "@/lib/appointment-ui";
import { addDays, toDateInputValue } from "@/lib/dates";
import {
  dayDateLabel,
  groupByDay,
  groupByStartHour,
  headerDateLabel,
  hourToTimeInput,
  timeGridWindow,
  weekDays,
  weekRangeLabel,
  weekdayHeaders,
} from "@/lib/calendar-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/Badge";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Locale, TranslationKey } from "@/lib/i18n/core";
import { cn } from "@/components/ui/cn";
import BookingModal from "./BookingModal";
import {
  AppointmentDetailsDrawer,
  type AppointmentJson,
} from "./AppointmentDetailsDrawer";

// لوحة المواعيد على شكل المرجع: عرضان فقط (يومي/أسبوعي)، شريط بطاقات أيام
// الأسبوع بعدّاد المواعيد، أجندة يومية بصف لكل ساعة، وشبكة أسبوعية بأعمدة
// بطاقات مكدّسة بلا محور ساعات. تصفية الطبيب تُطبَّق على العرض بعد التحميل.

type CalendarView = "day" | "week";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; appointments: AppointmentJson[] };

const VIEW_LABELS: Record<CalendarView, TranslationKey> = {
  day: "appt.viewDay",
  week: "appt.viewWeek",
};

export default function AppointmentsCalendar({
  initialDate,
}: {
  initialDate: string;
}) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<CalendarView>("day");
  const [dateValue, setDateValue] = useState(initialDate);
  const [staffFilter, setStaffFilter] = useState("");
  const [staff, setStaff] = useState<StaffMemberDto[]>([]);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selected, setSelected] = useState<AppointmentJson | null>(null);
  const [booking, setBooking] = useState<{ open: boolean; time: string }>({
    open: false,
    time: "09:00",
  });

  const load = useCallback(async (date: string, currentView: CalendarView) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/appointments?date=${date}&view=${currentView}`,
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { appointments: AppointmentJson[] };
      setState({ kind: "loaded", appointments: data.appointments });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load(dateValue, view);
  }, [dateValue, view, load]);

  // قائمة الأطباء النشطين — لمصفية «كل الأطباء» وتلوين حواف البطاقات.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/staff");
        if (!res.ok) return;
        const data = (await res.json()) as { staff: StaffMemberDto[] };
        // الأطباء فقط — فلتر «كل الأطباء» كما في المرجع.
        if (alive) {
          setStaff(
            data.staff.filter((s) => s.isActive && s.role === "DENTIST"),
          );
        }
      } catch {
        // بلا قائمة أطباء تبقى الصفحة تعمل بلا تصفية ولا تلوين حواف.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const appointments = state.kind === "loaded" ? state.appointments : null;

  // تصفية الطبيب على العميل — النطاق محمّل كاملاً لكل عرض.
  const filtered = useMemo(() => {
    if (!appointments) return null;
    return staffFilter
      ? appointments.filter((a) => a.staffId === staffFilter)
      : appointments;
  }, [appointments, staffFilter]);

  /** التنقل: يوم ±1، أسبوع ±7. */
  function navigate(direction: 1 | -1) {
    setDateValue((d) =>
      toDateInputValue(
        addDays(
          new Date(`${d}T00:00:00`),
          direction * (view === "week" ? 7 : 1),
        ),
      ),
    );
  }

  function openBooking(time = "09:00") {
    setBooking({ open: true, time });
  }

  const today = toDateInputValue(new Date());
  const rangeLabel = useMemo(() => {
    if (view === "week") return weekRangeLabel(weekDays(dateValue));
    return dayDateLabel(dateValue, today, locale);
  }, [view, dateValue, today, locale]);

  // لون حافة الطبيب — من لون التمييز إن وُجد، وإلا حدّ أساسي هادئ.
  const staffColor = useCallback(
    (staffId: string | null) =>
      staffId ? (staff.find((s) => s.id === staffId)?.colorHex ?? null) : null,
    [staff],
  );

  return (
    <>
      <PageHeader
        title={t("appt.title")}
        description={headerDateLabel(dateValue, locale)}
        actions={
          <Button shape="pill" onClick={() => openBooking()}>
            <Plus size={16} aria-hidden />
            {t("appt.new")}
          </Button>
        }
      />

      {/* شريط الأدوات: يمين (تنقّل + تسمية) — يسار (مبدّل العرض + تصفية الطبيب) */}
      <div className="mt-5 flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
            aria-label={t("appt.prevPeriod")}
          >
            <ChevronRight size={16} aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDateValue(toDateInputValue(new Date()))}
          >
            {t("appt.today")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(1)}
            aria-label={t("appt.nextPeriod")}
          >
            <ChevronLeft size={16} aria-hidden />
          </Button>
          <span className="text-ink-900 min-w-40 text-sm font-semibold">
            {rangeLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
          <div
            role="group"
            aria-label={t("appt.viewMode")}
            className="flex gap-1"
          >
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "border-primary-600 bg-primary-600/10 text-primary-800 font-semibold"
                      : "border-warm-200 bg-surface-raised text-warm-600 hover:bg-surface-hover",
                  )}
                >
                  {t(VIEW_LABELS[v])}
                </button>
              );
            })}
          </div>

          <Select
            aria-label={t("appt.doctorFilter")}
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-36"
          >
            <option value="">{t("appt.allDoctors")}</option>
            {staff.map((d) => (
              <option key={d.id} value={d.id}>
                {doctorDisplayName(d.name)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* صف بطاقات أيام الأسبوع — النشط بإطار بلون الهوية، والنقر ينقل إليه */}
      <WeekStrip
        dateValue={dateValue}
        appointments={filtered ?? []}
        onSelect={setDateValue}
      />

      <div className="mt-4">
        {state.kind === "error" ? (
          <div
            role="alert"
            className="rounded-panel border-danger-300 bg-danger-50 flex flex-col items-center gap-3 border px-6 py-10 text-center"
          >
            <p className="text-danger-700 text-sm font-medium">
              {t("appt.loadError")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load(dateValue, view)}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : filtered === null ? (
          <CalendarSkeleton />
        ) : view === "day" ? (
          <DayTimeline
            date={dateValue}
            appointments={filtered}
            staffColor={staffColor}
            onSelect={setSelected}
            onSlotClick={openBooking}
          />
        ) : (
          <WeekBoard
            dateValue={dateValue}
            appointments={filtered}
            staffColor={staffColor}
            onSelect={setSelected}
          />
        )}
      </div>

      <BookingModal
        open={booking.open}
        onClose={() => setBooking((b) => ({ ...b, open: false }))}
        dateValue={dateValue}
        initialTime={booking.time}
        onBooked={() => void load(dateValue, view)}
      />

      <AppointmentDetailsDrawer
        appointment={selected}
        onClose={() => setSelected(null)}
        onChanged={() => void load(dateValue, view)}
      />
    </>
  );
}

/* ---------- رمز السن — زخرفة الحالات الفارغة على شكل المرجع ---------- */

function ToothGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5.5c-1.5-1-3.5-1.4-5-.4C5.4 6.2 5 8.3 5.5 10.5c.4 1.8 1 3.2 1.4 5 .3 1.4.6 3.5 1.9 3.5 1.6 0 1.2-3.2 3.2-3.2s1.6 3.2 3.2 3.2c1.3 0 1.6-2.1 1.9-3.5.4-1.8 1-3.2 1.4-5 .5-2.2.1-4.3-1.5-5.4-1.5-1-3.5-.6-5 .4Z" />
    </svg>
  );
}

/* ---------- صف بطاقات أيام الأسبوع ---------- */

function WeekStrip({
  dateValue,
  appointments,
  onSelect,
}: {
  dateValue: string;
  appointments: AppointmentJson[];
  onSelect: (day: string) => void;
}) {
  const days = useMemo(() => weekDays(dateValue), [dateValue]);
  const counts = useMemo(() => groupByDay(appointments), [appointments]);
  const today = toDateInputValue(new Date());
  const { t, locale } = useI18n();
  const headers = weekdayHeaders(locale);

  return (
    <div
      role="group"
      aria-label={t("appt.weekStrip")}
      className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7"
    >
      {days.map((day, i) => {
        const active = day === dateValue;
        const count = (counts.get(day) ?? []).length;
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(day)}
            className={cn(
              "rounded-panel bg-surface-raised flex flex-col items-center gap-0.5 border px-1 py-2.5 transition-colors",
              "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
              active
                ? "border-primary-600 ring-primary-600 ring-1"
                : "border-warm-200 hover:bg-surface-hover active:bg-surface-sunken",
            )}
          >
            <span className="text-warm-500 text-[11px]">{headers[i]}</span>
            <span
              className={cn(
                "numeric text-lg font-bold",
                active
                  ? "text-primary-800"
                  : day === today
                    ? "text-primary-700"
                    : "text-ink-900",
              )}
            >
              {day.slice(8)}
            </span>
            {count > 0 ? (
              <span className="numeric text-warm-600 text-[11px]">
                {t("appt.count", { count })}
              </span>
            ) : (
              <span aria-hidden className="text-warm-300 text-[11px]">
                —
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- بطاقة موعد مشتركة — اليوم والأسبوع بنفس الشكل ---------- */

function AppointmentCard({
  appointment,
  accentColor,
  onSelect,
}: {
  appointment: AppointmentJson;
  accentColor: string | null;
  onSelect: (a: AppointmentJson) => void;
}) {
  const meta = STATUS_META[appointment.status];
  const { t, locale } = useI18n();
  const settled =
    appointment.status === "COMPLETED" || appointment.status === "CANCELLED";
  // سطر الطبيب وسطر الخدمة منفصلان كما في المرجع، وكل منهما اختياري.
  const doctorLine = appointment.staffName
    ? doctorDisplayName(appointment.staffName)
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      title={`${appointment.patientName} · ${t(meta.labelKey)}`}
      className={cn(
        "rounded-field border-warm-200 bg-surface w-full border border-s-4 px-2.5 py-2 text-start transition-colors",
        "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
        "hover:bg-surface-hover",
        settled && "opacity-70",
      )}
      style={
        accentColor
          ? { borderInlineStartColor: accentColor }
          : { borderInlineStartColor: "var(--color-primary-300)" }
      }
    >
      <span className="flex items-center justify-between gap-2">
        <span className="numeric text-ink-900 text-xs font-bold">
          {timeRangeLabel(
            appointment.startsAt,
            appointment.durationMin,
            locale,
          )}
        </span>
        <StatusPill tone={meta.tone} className="shrink-0">
          {t(meta.labelKey)}
        </StatusPill>
      </span>
      <span className="text-ink-900 mt-0.5 block truncate text-sm font-semibold">
        {appointment.patientName}
      </span>
      {doctorLine && (
        <span className="text-warm-500 block truncate text-[11px]">
          {doctorLine}
        </span>
      )}
      {appointment.reason && (
        <span className="text-warm-500 block truncate text-[11px]">
          {appointment.reason}
        </span>
      )}
    </button>
  );
}

/* ---------- عرض اليوم: أجندة صف لكل ساعة ---------- */

function DayTimeline({
  date,
  appointments,
  staffColor,
  onSelect,
  onSlotClick,
}: {
  date: string;
  appointments: AppointmentJson[];
  staffColor: (staffId: string | null) => string | null;
  onSelect: (a: AppointmentJson) => void;
  onSlotClick: (time: string) => void;
}) {
  const window_ = useMemo(() => timeGridWindow(appointments), [appointments]);
  const hours = useMemo(() => {
    const rows: number[] = [];
    for (let h = window_.startMin / 60; h < window_.endMin / 60; h++)
      rows.push(h);
    return rows;
  }, [window_]);
  const byHour = useMemo(() => groupByStartHour(appointments), [appointments]);
  const { t, locale } = useI18n();

  return (
    <div className="rounded-panel border-warm-200 bg-surface-raised overflow-hidden border">
      {hours.map((h) => {
        const items = byHour.get(h) ?? [];
        return (
          <div
            key={h}
            className="border-warm-100 flex gap-3 border-b p-3 last:border-b-0"
          >
            {/* مربع الوقت المستدير الباهت */}
            <span
              aria-hidden
              className="numeric rounded-field bg-primary-500/10 text-primary-800 grid h-9 w-14 shrink-0 place-items-center text-xs font-bold"
            >
              {hourLabel(date, h, locale)}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {items.length > 0 ? (
                items.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appointment={a}
                    accentColor={staffColor(a.staffId)}
                    onSelect={onSelect}
                  />
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => onSlotClick(hourToTimeInput(h))}
                  aria-label={t("appt.slotAria", {
                    time: hourLabel(date, h, locale),
                  })}
                  className={cn(
                    "rounded-field border-warm-200 text-warm-400 flex flex-col items-center gap-0.5 border border-dashed py-2 text-xs transition-colors",
                    "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                    "hover:bg-surface-hover hover:text-warm-500",
                  )}
                >
                  <ToothGlyph className="size-5" />
                  {t("appt.emptySlot")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** تسمية ساعة الشبكة — بنفس منسّق الوقت المستخدم في بقية الواجهة. */
function hourLabel(date: string, hour: number, locale: Locale): string {
  return formatTime(new Date(`${date}T${hourToTimeInput(hour)}:00Z`), locale);
}

/* ---------- عرض الأسبوع: أعمدة بطاقات مكدّسة على شكل المرجع ---------- */

function WeekBoard({
  dateValue,
  appointments,
  staffColor,
  onSelect,
}: {
  dateValue: string;
  appointments: AppointmentJson[];
  staffColor: (staffId: string | null) => string | null;
  onSelect: (a: AppointmentJson) => void;
}) {
  const days = useMemo(() => weekDays(dateValue), [dateValue]);
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);
  const today = toDateInputValue(new Date());
  const { t, locale } = useI18n();
  const headers = weekdayHeaders(locale);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 gap-2">
        {days.map((day, i) => {
          const items = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <section
              key={day}
              aria-label={`${headers[i]} ${day}`}
              className={cn(
                "rounded-panel bg-surface-raised flex min-h-72 flex-col overflow-hidden border",
                isToday
                  ? "border-primary-600 ring-primary-600 ring-1"
                  : "border-warm-200",
              )}
            >
              {/* ترويسة العمود: اسم اليوم + الرقم + العدد */}
              <div
                className={cn(
                  "border-warm-100 border-b px-2 py-2 text-center",
                  isToday && "bg-primary-50",
                )}
              >
                <p className="text-warm-500 text-[11px]">{headers[i]}</p>
                <p
                  className={cn(
                    "numeric text-base font-bold",
                    isToday ? "text-primary-800" : "text-ink-900",
                  )}
                >
                  {day.slice(8)}
                </p>
                {items.length > 0 ? (
                  <p className="numeric text-warm-600 text-[11px]">
                    {t("appt.count", { count: items.length })}
                  </p>
                ) : (
                  <p aria-hidden className="text-warm-300 text-[11px]">
                    —
                  </p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.length > 0 ? (
                  items.map((a) => (
                    <AppointmentCard
                      key={a.id}
                      appointment={a}
                      accentColor={staffColor(a.staffId)}
                      onSelect={onSelect}
                    />
                  ))
                ) : (
                  <div
                    role="presentation"
                    className="text-warm-300 flex flex-1 flex-col items-center justify-center gap-1 py-6"
                  >
                    <ToothGlyph className="size-8" />
                    <span className="text-xs">{t("appt.none")}</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- هيكل التحميل ---------- */

function CalendarSkeleton() {
  return (
    <div
      aria-busy="true"
      className="rounded-panel border-warm-200 bg-surface-raised flex flex-col gap-2 border p-4"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-field bg-warm-100 h-14 animate-pulse"
          aria-hidden
        />
      ))}
    </div>
  );
}
