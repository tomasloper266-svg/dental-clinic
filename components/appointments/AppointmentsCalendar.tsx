"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { StaffMemberDto } from "@/lib/services/staff";
import { STATUS_META, formatTime } from "@/lib/appointment-ui";
import { addDays, toDateInputValue } from "@/lib/dates";
import {
  WEEKDAY_HEADERS,
  dayDateLabel,
  groupByDay,
  groupByStartHour,
  hourToTimeInput,
  timeGridWindow,
  weekDays,
  weekRangeLabel,
} from "@/lib/calendar-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { StatusPill } from "@/components/ui/Badge";
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

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "يومي",
  week: "أسبوعي",
};

export default function AppointmentsCalendar({
  initialDate,
}: {
  initialDate: string;
}) {
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
      const res = await fetch(`/api/appointments?date=${date}&view=${currentView}`);
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
        if (alive) setStaff(data.staff.filter((s) => s.isActive));
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
      toDateInputValue(addDays(new Date(`${d}T00:00:00`), direction * (view === "week" ? 7 : 1))),
    );
  }

  function openBooking(time = "09:00") {
    setBooking({ open: true, time });
  }

  const today = toDateInputValue(new Date());
  const rangeLabel = useMemo(() => {
    if (view === "week") return weekRangeLabel(weekDays(dateValue));
    return dayDateLabel(dateValue, today);
  }, [view, dateValue, today]);

  // لون حافة الطبيب — من لون التمييز إن وُجد، وإلا حدّ أساسي هادئ.
  const staffColor = useCallback(
    (staffId: string | null) =>
      staffId ? (staff.find((s) => s.id === staffId)?.colorHex ?? null) : null,
    [staff],
  );

  return (
    <>
      <PageHeader
        title="المواعيد"
        actions={
          <Button shape="pill" onClick={() => openBooking()}>
            <Plus size={16} aria-hidden />
            موعد جديد
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
            aria-label="الفترة السابقة"
          >
            <ChevronRight size={16} aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDateValue(toDateInputValue(new Date()))}
          >
            اليوم
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(1)}
            aria-label="الفترة التالية"
          >
            <ChevronLeft size={16} aria-hidden />
          </Button>
          <span className="min-w-40 text-sm font-semibold text-ink-900">
            {rangeLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
          <div role="group" aria-label="نمط العرض" className="flex gap-1">
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
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                    active
                      ? "border-primary-600 bg-primary-600/10 font-semibold text-primary-800"
                      : "border-warm-200 bg-surface-raised text-warm-600 hover:bg-surface-hover",
                  )}
                >
                  {VIEW_LABELS[v]}
                </button>
              );
            })}
          </div>

          <Select
            aria-label="تصفية الطبيب"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-36"
          >
            <option value="">كل الأطباء</option>
            {staff.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
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
            className="flex flex-col items-center gap-3 rounded-panel border border-danger-300 bg-danger-50 px-6 py-10 text-center"
          >
            <p className="text-sm font-medium text-danger-700">
              تعذر تحميل المواعيد — تحقق من الاتصال ثم أعد المحاولة.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load(dateValue, view)}
            >
              إعادة المحاولة
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

  return (
    <div
      role="group"
      aria-label="أيام الأسبوع"
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
              "flex flex-col items-center gap-0.5 rounded-panel border bg-surface-raised px-1 py-2.5 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
              active
                ? "border-primary-600 ring-1 ring-primary-600"
                : "border-warm-200 hover:bg-surface-hover active:bg-surface-sunken",
            )}
          >
            <span className="text-[11px] text-warm-500">{WEEKDAY_HEADERS[i]}</span>
            <span
              className={cn(
                "numeric text-lg font-bold",
                active ? "text-primary-800" : day === today ? "text-primary-700" : "text-ink-900",
              )}
            >
              {day.slice(8)}
            </span>
            {count > 0 ? (
              <span className="numeric text-[11px] text-warm-600">
                {count} موعد
              </span>
            ) : (
              <span aria-hidden className="text-[11px] text-warm-300">
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
  const settled = appointment.status === "COMPLETED" || appointment.status === "CANCELLED";
  const doctorLine = [
    appointment.staffName ? `د. ${appointment.staffName}` : null,
    appointment.reason,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      title={`${appointment.patientName} · ${meta.label}`}
      className={cn(
        "w-full rounded-field border border-s-4 border-warm-200 bg-surface px-2.5 py-2 text-start transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
        "hover:bg-surface-hover",
        settled && "opacity-70",
      )}
      style={accentColor ? { borderInlineStartColor: accentColor } : { borderInlineStartColor: "var(--color-primary-300)" }}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="numeric text-xs font-bold text-ink-900">
          {formatTime(appointment.startsAt)} · {appointment.durationMin} د
        </span>
        <StatusPill tone={meta.tone} className="shrink-0">
          {meta.label}
        </StatusPill>
      </span>
      <span className="mt-0.5 block truncate text-sm font-semibold text-ink-900">
        {appointment.patientName}
      </span>
      {doctorLine && (
        <span className="block truncate text-[11px] text-warm-500">
          {doctorLine}
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
    for (let h = window_.startMin / 60; h < window_.endMin / 60; h++) rows.push(h);
    return rows;
  }, [window_]);
  const byHour = useMemo(() => groupByStartHour(appointments), [appointments]);

  return (
    <div className="overflow-hidden rounded-panel border border-warm-200 bg-surface-raised">
      {hours.map((h) => {
        const items = byHour.get(h) ?? [];
        return (
          <div
            key={h}
            className="flex gap-3 border-b border-warm-100 p-3 last:border-b-0"
          >
            {/* مربع الوقت المستدير الباهت */}
            <span
              aria-hidden
              className="numeric grid h-9 w-14 shrink-0 place-items-center rounded-field bg-primary-500/10 text-xs font-bold text-primary-800"
            >
              {hourLabel(date, h)}
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
                  aria-label={`حجز موعد عند ${hourLabel(date, h)}`}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-field border border-dashed border-warm-200 py-2 text-xs text-warm-400 transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                    "hover:bg-surface-hover hover:text-warm-500",
                  )}
                >
                  <ToothGlyph className="size-5" />
                  — فارغ — انقر لإضافة موعد
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
function hourLabel(date: string, hour: number): string {
  return formatTime(new Date(`${date}T${hourToTimeInput(hour)}:00Z`));
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

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 gap-2">
        {days.map((day, i) => {
          const items = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <section
              key={day}
              aria-label={`${WEEKDAY_HEADERS[i]} ${day}`}
              className={cn(
                "flex min-h-72 flex-col overflow-hidden rounded-panel border bg-surface-raised",
                isToday
                  ? "border-primary-600 ring-1 ring-primary-600"
                  : "border-warm-200",
              )}
            >
              {/* ترويسة العمود: اسم اليوم + الرقم + العدد */}
              <div
                className={cn(
                  "border-b border-warm-100 px-2 py-2 text-center",
                  isToday && "bg-primary-50",
                )}
              >
                <p className="text-[11px] text-warm-500">{WEEKDAY_HEADERS[i]}</p>
                <p
                  className={cn(
                    "numeric text-base font-bold",
                    isToday ? "text-primary-800" : "text-ink-900",
                  )}
                >
                  {day.slice(8)}
                </p>
                {items.length > 0 ? (
                  <p className="numeric text-[11px] text-warm-600">
                    {items.length} موعد
                  </p>
                ) : (
                  <p aria-hidden className="text-[11px] text-warm-300">
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
                    className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-warm-300"
                  >
                    <ToothGlyph className="size-8" />
                    <span className="text-xs">لا مواعيد</span>
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
      className="flex flex-col gap-2 rounded-panel border border-warm-200 bg-surface-raised p-4"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-field bg-warm-100"
          aria-hidden
        />
      ))}
    </div>
  );
}
