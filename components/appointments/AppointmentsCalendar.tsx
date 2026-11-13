"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { APPOINTMENT_STATUSES } from "@/lib/appointment-state";
import {
  STATUS_META,
  formatDayLabel,
  formatTime,
} from "@/lib/appointment-ui";
import { addDays, toDateInputValue } from "@/lib/dates";
import {
  WEEKDAY_HEADERS,
  addMonths,
  groupByDay,
  groupByStartHour,
  hourToTimeInput,
  minutesFromMidnightUtc,
  monthGrid,
  monthLabel,
  timeGridWindow,
  weekDays,
  weekRangeLabel,
} from "@/lib/calendar-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EntityCell } from "@/components/ui/EntityCell";
import { StatusPill } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import BookingModal from "./BookingModal";
import {
  AppointmentDetailsDrawer,
  type AppointmentJson,
} from "./AppointmentDetailsDrawer";

// لوحة المواعيد: تقويم يومي (شبكة زمنية) وأسبوعي وشهري، أعمدته من اليمين
// لليسار (السبت أول الأسبوع). ألوان الحالات من STATUS_META الموحّدة، والفجوة
// الفارغة في اليوم قابلة للنقر لفتح نموذج الحجز عليها مباشرة.

type CalendarView = "day" | "week" | "month";

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; appointments: AppointmentJson[] };

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "اليوم",
  week: "الأسبوع",
  month: "الشهر",
};

const HOUR_ROW_HEIGHT_REM = 4; // ارتفاع صف الساعة الواحدة في الشبكة

export default function AppointmentsCalendar({
  initialDate,
}: {
  initialDate: string;
}) {
  const [view, setView] = useState<CalendarView>("day");
  const [dateValue, setDateValue] = useState(initialDate);
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

  const appointments = state.kind === "loaded" ? state.appointments : null;

  /** التنقل: يوم ±1، أسبوع ±7، شهر ±1 (أول الشهر الهدف). */
  function navigate(direction: 1 | -1) {
    setDateValue((d) => {
      if (view === "month") return addMonths(d, direction);
      const step = view === "week" ? 7 : 1;
      return toDateInputValue(
        addDays(new Date(`${d}T00:00:00`), direction * step),
      );
    });
  }

  function openBooking(time = "09:00") {
    setBooking({ open: true, time });
  }

  const rangeLabel = useMemo(() => {
    if (view === "month") return monthLabel(dateValue);
    if (view === "week") return weekRangeLabel(weekDays(dateValue));
    return formatDayLabel(new Date(`${dateValue}T00:00:00`));
  }, [view, dateValue]);

  return (
    <>
      <PageHeader
        title="المواعيد"
        description="جدول العيادة اليومي والأسبوعي والشهري — انقر فجوة فارغة في يوم العرض لحجز موعد عليها."
        actions={
          <Button shape="pill" onClick={() => openBooking()}>
            <Plus size={16} aria-hidden />
            موعد جديد
          </Button>
        }
      />

      {/* صف بطاقات أيام الأسبوع — النشط بإطار بلون الهوية، والنقر ينقل إليه */}
      <WeekStrip dateValue={dateValue} onSelect={setDateValue} />

      {/* شريط الأدوات: مبدّل العرض + التنقل + التسمية */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="group"
          aria-label="نمط العرض"
          className="flex flex-wrap gap-1"
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
                  "rounded-field border px-3 py-1.5 text-xs font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                  active
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-warm-300 bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken",
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-start">
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
          <span className="min-w-40 text-center text-sm font-semibold text-ink-900 md:text-start">
            {rangeLabel}
          </span>
        </div>
      </div>

      {/* دليل ألوان الحالات */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {APPOINTMENT_STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-warm-600">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", STATUS_META[status].dot)}
            />
            {STATUS_META[status].label}
          </span>
        ))}
      </div>

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
        ) : appointments === null ? (
          <CalendarSkeleton view={view} />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              view === "day"
                ? "لا مواعيد هذا اليوم"
                : view === "week"
                  ? "لا مواعيد هذا الأسبوع"
                  : "لا مواعيد في هذا الشهر"
            }
            description="احجز موعداً جديداً، أو انقر فجوة فارغة في شبكة اليوم لتحديد وقتها مباشرة."
            action={
              <Button size="sm" onClick={() => openBooking()}>
                <CalendarPlus size={14} aria-hidden />
                حجز موعد جديد
              </Button>
            }
          />
        ) : view === "day" ? (
          <DayTimeline
            date={dateValue}
            appointments={appointments}
            onSelect={setSelected}
            onSlotClick={openBooking}
          />
        ) : view === "week" ? (
          <WeekBoard
            dateValue={dateValue}
            appointments={appointments}
            onSelect={setSelected}
            onDaySelect={(day) => {
              setDateValue(day);
              setView("day");
            }}
          />
        ) : (
          <MonthBoard
            dateValue={dateValue}
            appointments={appointments}
            onSelect={setSelected}
            onDaySelect={(day) => {
              setDateValue(day);
              setView("day");
            }}
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

/* ---------- صف بطاقات أيام الأسبوع ---------- */

function WeekStrip({
  dateValue,
  onSelect,
}: {
  dateValue: string;
  onSelect: (day: string) => void;
}) {
  const days = useMemo(() => weekDays(dateValue), [dateValue]);
  const today = toDateInputValue(new Date());

  return (
    <div
      role="group"
      aria-label="أيام الأسبوع"
      className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7"
    >
      {days.map((day, i) => {
        const active = day === dateValue;
        const isToday = day === today;
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
                active ? "text-primary-800" : isToday ? "text-primary-700" : "text-ink-900",
              )}
            >
              {day.slice(8)}
            </span>
            <span aria-hidden className="text-[11px] text-warm-300">
              —
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- الشبكة الزمنية المشتركة ---------- */

function useGrid(appointments: AppointmentJson[]) {
  const window_ = useMemo(() => timeGridWindow(appointments), [appointments]);
  const hours = useMemo(() => {
    const rows: number[] = [];
    for (let h = window_.startMin / 60; h < window_.endMin / 60; h++) rows.push(h);
    return rows;
  }, [window_]);
  const totalMin = window_.endMin - window_.startMin;
  return { window_, hours, totalMin };
}

function blockStyle(
  appointment: AppointmentJson,
  window_: { startMin: number },
  totalMin: number,
): React.CSSProperties {
  const start = minutesFromMidnightUtc(appointment.startsAt);
  const top = ((start - window_.startMin) / totalMin) * 100;
  const height = Math.max((appointment.durationMin / totalMin) * 100, 4);
  return { top: `${top}%`, height: `${height}%` };
}

/** تسمية ساعة الشبكة — بنفس منسّق الوقت المستخدم في بقية الواجهة. */
function hourLabel(date: string, hour: number): string {
  return formatTime(new Date(`${date}T${hourToTimeInput(hour)}:00Z`));
}

function AppointmentBlock({
  appointment,
  style,
  onSelect,
  compact = false,
}: {
  appointment: AppointmentJson;
  style: React.CSSProperties;
  onSelect: (a: AppointmentJson) => void;
  compact?: boolean;
}) {
  const meta = STATUS_META[appointment.status];
  const settled = appointment.status === "COMPLETED" || appointment.status === "CANCELLED";
  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      className={cn(
        "absolute inset-x-1 z-10 overflow-hidden rounded-field border px-2 py-1 text-start transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
        meta.block,
        settled && "opacity-70",
      )}
      style={style}
      title={`${appointment.patientName} · ${meta.label}`}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
        <span className="numeric shrink-0 text-[11px] font-semibold">
          {formatTime(appointment.startsAt)}
        </span>
        <span className="truncate text-xs font-medium">
          {appointment.patientName}
        </span>
      </span>
      {!compact && appointment.reason && (
        <span className="block truncate text-[11px] opacity-80">
          {appointment.reason}
        </span>
      )}
    </button>
  );
}

/* ---------- عرض اليوم ---------- */

/**
 * شبكة الفتحات الزمنية على شكل المرجع: صف لكل ساعة، بمربع وقت مستدير بلون
 * باهت، وبطاقة موعد بأفاتار المريض واسمه وملاحظته الفرعية وشارة حالته،
 * والساعات الخالية فجوات بنص هادئ قابلة للنقر لفتح الحجز عليها.
 */
function DayTimeline({
  date,
  appointments,
  onSelect,
  onSlotClick,
}: {
  date: string;
  appointments: AppointmentJson[];
  onSelect: (a: AppointmentJson) => void;
  onSlotClick: (time: string) => void;
}) {
  const { hours } = useGrid(appointments);
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
                  <SlotCard key={a.id} appointment={a} onSelect={onSelect} />
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => onSlotClick(hourToTimeInput(h))}
                  aria-label={`حجز موعد عند ${hourLabel(date, h)}`}
                  className={cn(
                    "rounded-field border border-dashed border-warm-200 px-3 py-2 text-start text-xs text-warm-400 transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                    "hover:bg-surface-hover hover:text-warm-500",
                  )}
                >
                  — فاضٍ — انقر لإضافة موعد
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** بطاقة موعد الفتحة — أفاتار + اسم + ملاحظة فرعية + شارة الحالة، والنقر يفتح التفاصيل. */
function SlotCard({
  appointment,
  onSelect,
}: {
  appointment: AppointmentJson;
  onSelect: (a: AppointmentJson) => void;
}) {
  const meta = STATUS_META[appointment.status];
  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      title={`${appointment.patientName} · ${meta.label}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-panel border px-3 py-2 text-start transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
        meta.block,
        "hover:opacity-90",
      )}
    >
      <EntityCell
        name={appointment.patientName}
        subtitle={appointment.reason}
        className="min-w-0 flex-1"
      />
      <span className="numeric shrink-0 text-xs font-semibold">
        {formatTime(appointment.startsAt)}
      </span>
      <StatusPill tone={meta.tone} className="shrink-0">
        {meta.label}
      </StatusPill>
    </button>
  );
}

/* ---------- عرض الأسبوع ---------- */

function WeekBoard({
  dateValue,
  appointments,
  onSelect,
  onDaySelect,
}: {
  dateValue: string;
  appointments: AppointmentJson[];
  onSelect: (a: AppointmentJson) => void;
  onDaySelect: (day: string) => void;
}) {
  const days = useMemo(() => weekDays(dateValue), [dateValue]);
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);
  const { window_, hours, totalMin } = useGrid(appointments);
  const today = toDateInputValue(new Date());

  return (
    <>
      {/* الشاشات الصغيرة: قائمة أيام مختصرة — النقر يفتح يوم العرض */}
      <div className="flex flex-col gap-2 md:hidden">
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDaySelect(day)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-panel border bg-surface-raised px-4 py-3 text-start transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                day === today ? "border-primary-300 bg-primary-50" : "border-warm-200 hover:bg-surface-hover",
              )}
            >
              <span className="flex flex-col">
                <span className="text-xs text-warm-500">
                  {WEEKDAY_HEADERS[days.indexOf(day)]}
                </span>
                <span className="numeric text-sm font-semibold text-ink-900">
                  {day.slice(8)} / {day.slice(5, 7)}
                </span>
              </span>
              {items.length === 0 ? (
                <span className="text-xs text-warm-400">لا مواعيد</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {items.slice(0, 4).map((a) => (
                    <span
                      key={a.id}
                      aria-hidden
                      className={cn("size-2 rounded-full", STATUS_META[a.status].dot)}
                    />
                  ))}
                  <span className="numeric text-xs text-warm-600">
                    {items.length}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* التابلت والشاشات الأوسع: شبكة أسبوع كاملة */}
      <div className="hidden overflow-hidden rounded-panel border border-warm-200 bg-surface-raised md:block">
        {/* ترويسة الأيام */}
        <div className="grid grid-cols-7 border-b border-warm-200">
          <div className="w-14 shrink-0" aria-hidden />
          {days.map((day, i) => (
            <div
              key={day}
              className={cn(
                "border-s border-warm-100 px-2 py-2 text-center",
                day === today && "bg-primary-50",
              )}
            >
              <p className="text-[11px] text-warm-500">{WEEKDAY_HEADERS[i]}</p>
              <p
                className={cn(
                  "numeric text-sm font-semibold",
                  day === today ? "text-primary-800" : "text-ink-900",
                )}
              >
                {day.slice(8)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex">
          {/* عمود الساعات */}
          <div className="w-14 shrink-0 border-e border-warm-200">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: `${HOUR_ROW_HEIGHT_REM}rem` }}
                className="numeric -translate-y-2 pt-0.5 text-end text-[11px] text-warm-400"
              >
                <span className="me-1">{hourLabel(days[0], h)}</span>
              </div>
            ))}
          </div>

          {/* أعمدة الأيام — RTL يجعل السبت أقصى اليمين */}
          <div
            className="grid flex-1 grid-cols-7"
            style={{ height: `${hours.length * HOUR_ROW_HEIGHT_REM}rem` }}
          >
            {days.map((day) => (
              <div
                key={day}
                className={cn(
                  "relative border-s border-warm-100",
                  day === today && "bg-primary-50/40",
                )}
              >
                {(byDay.get(day) ?? []).map((a) => (
                  <AppointmentBlock
                    key={a.id}
                    appointment={a}
                    style={blockStyle(a, window_, totalMin)}
                    onSelect={onSelect}
                    compact
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- عرض الشهر ---------- */

const MONTH_CHIPS_DESKTOP = 2;
const MONTH_DOTS_MOBILE = 4;

function MonthBoard({
  dateValue,
  appointments,
  onSelect,
  onDaySelect,
}: {
  dateValue: string;
  appointments: AppointmentJson[];
  onSelect: (a: AppointmentJson) => void;
  onDaySelect: (day: string) => void;
}) {
  const weeks = useMemo(() => monthGrid(dateValue), [dateValue]);
  const byDay = useMemo(() => groupByDay(appointments), [appointments]);
  const today = toDateInputValue(new Date());

  return (
    <div className="overflow-hidden rounded-panel border border-warm-200 bg-surface-raised">
      {/* ترويسة الأيام */}
      <div className="grid grid-cols-7 border-b border-warm-200 bg-surface-sunken">
        {WEEKDAY_HEADERS.map((name) => (
          <div
            key={name}
            className="px-1 py-2 text-center text-[11px] font-semibold text-warm-600"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((cell) => {
          const items = byDay.get(cell.date) ?? [];
          const isToday = cell.date === today;
          return (
            <div
              key={cell.date}
              className={cn(
                "min-h-20 border-b border-s border-warm-100 p-1.5 sm:min-h-24",
                cell.inMonth ? "bg-surface-raised" : "bg-surface-sunken/60",
              )}
            >
              <button
                type="button"
                onClick={() => onDaySelect(cell.date)}
                aria-label={`عرض يوم ${cell.date}`}
                className={cn(
                  "numeric rounded-field px-1.5 text-xs font-semibold transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                  isToday
                    ? "bg-primary-600 text-white"
                    : cell.inMonth
                      ? "text-ink-900 hover:bg-surface-hover"
                      : "text-warm-400 hover:bg-surface-hover",
                )}
              >
                {cell.date.slice(8)}
              </button>

              {/* الموبايل: نقاط حالات فقط */}
              <div className="mt-1 flex items-center gap-1 sm:hidden">
                {items.slice(0, MONTH_DOTS_MOBILE).map((a) => (
                  <span
                    key={a.id}
                    aria-hidden
                    className={cn("size-1.5 rounded-full", STATUS_META[a.status].dot)}
                  />
                ))}
                {items.length > MONTH_DOTS_MOBILE && (
                  <span className="numeric text-[10px] text-warm-400">
                    +{items.length - MONTH_DOTS_MOBILE}
                  </span>
                )}
              </div>

              {/* الشاشات الأوسع: بطاقات مصغرة للمواعيد */}
              <div className="mt-1 hidden flex-col gap-1 sm:flex">
                {items.slice(0, MONTH_CHIPS_DESKTOP).map((a) => {
                  const meta = STATUS_META[a.status];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      className={cn(
                        "truncate rounded-field border px-1.5 py-0.5 text-start text-[11px] transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
                        meta.block,
                      )}
                      title={`${formatTime(a.startsAt)} · ${a.patientName} · ${meta.label}`}
                    >
                      <span className="numeric font-semibold">
                        {formatTime(a.startsAt)}
                      </span>{" "}
                      {a.patientName}
                    </button>
                  );
                })}
                {items.length > MONTH_CHIPS_DESKTOP && (
                  <button
                    type="button"
                    onClick={() => onDaySelect(cell.date)}
                    className="rounded-field px-1.5 text-start text-[11px] text-warm-500 hover:bg-surface-hover hover:text-ink-900"
                  >
                    <span className="numeric">+{items.length - MONTH_CHIPS_DESKTOP}</span>{" "}
                    مواعيد أخرى
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- هياكل التحميل ---------- */

function CalendarSkeleton({ view }: { view: CalendarView }) {
  if (view === "month") {
    return (
      <div
        aria-busy="true"
        className="grid grid-cols-7 overflow-hidden rounded-panel border border-warm-200 bg-surface-raised"
      >
        {Array.from({ length: 42 }, (_, i) => (
          <div
            key={i}
            className="min-h-20 border-b border-s border-warm-100 p-2"
          >
            <div className="h-3 w-4 animate-pulse rounded bg-warm-100" aria-hidden />
          </div>
        ))}
      </div>
    );
  }
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
