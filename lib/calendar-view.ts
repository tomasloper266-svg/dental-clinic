// مساعدات التقويم — نقية بلا I/O، تُستخدم في لوحة المواعيد. كل التواريخ نصوص
// YYYY-MM-DD بحدود UTC (نفس اتفاق lib/dates)، والأسبوع يبدأ السبت كما في
// weekRange. المنسّقات صريحة بـ timeZone: "UTC" حتى لا ينزاح التسميل في
// بيئة متصفح بمنطقة سالبة.

const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarCell = {
  /** تاريخ الخلية YYYY-MM-DD */
  date: string;
  /** هل يقع التاريخ داخل الشهر المعروض — لتمييز أيام الشهور المجاورة */
  inMonth: boolean;
};

/** عناوين أعمدة التقويم — السبت أول الأسبوع، بنفس ترتيب weekRange */
export const WEEKDAY_HEADERS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
] as const;

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysSinceSaturday(date: Date): number {
  // getUTCDay: 0=الأحد … 6=السبت — نُرجع أياماً للوراء ليبدأ العمود بالسبت.
  return (date.getUTCDay() + 1) % 7;
}

/** أيام الأسبوع الذي يقع فيه التاريخ — من السبت إلى الجمعة. */
export function weekDays(date: string): string[] {
  const day = parseIsoDate(date);
  const weekStart = new Date(day.getTime() - daysSinceSaturday(day) * DAY_MS);
  return Array.from({ length: 7 }, (_, i) =>
    toIsoDate(new Date(weekStart.getTime() + i * DAY_MS)),
  );
}

/** الانتقال إلى أول الشهر المُزاح — للتنقل بين الأشهر. */
export function addMonths(date: string, months: number): string {
  const day = parseIsoDate(date);
  return toIsoDate(
    new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, 1)),
  );
}

/** أسابيع الشهر كامنة بصفوف من السبت إلى الجمعة — 5 أو 6 صفوف تغطي الشهر. */
export function monthGrid(date: string): CalendarCell[][] {
  const day = parseIsoDate(date);
  const month = day.getUTCMonth();
  const monthEnd = new Date(Date.UTC(day.getUTCFullYear(), month + 1, 0));
  const first = new Date(Date.UTC(day.getUTCFullYear(), month, 1));
  const gridStart = new Date(first.getTime() - daysSinceSaturday(first) * DAY_MS);

  const weeks: CalendarCell[][] = [];
  let cursor = gridStart.getTime();
  while (cursor <= monthEnd.getTime()) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const cell = new Date(cursor + i * DAY_MS);
      week.push({ date: toIsoDate(cell), inMonth: cell.getUTCMonth() === month });
    }
    weeks.push(week);
    cursor += 7 * DAY_MS;
  }
  return weeks;
}

const MONTH_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function monthLabel(date: string): string {
  return MONTH_FMT.format(parseIsoDate(date));
}

/** تسمية نطاق الأسبوع — «2026/11/08 — 2026/11/14» بنمط المرجع الرقمي. */
export function weekRangeLabel(days: string[]): string {
  return `${numericDate(days[0])} — ${numericDate(days[days.length - 1])}`;
}

// «الجمعة 2026/11/13» — اسم اليوم + التاريخ الرقمي بنمط المرجع (سنة/شهر/يوم).
const WEEKDAY_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "long",
  timeZone: "UTC",
});

/** تسمية ترويسة الصفحة — «السبت، 2026/11/14» باسم اليوم والتاريخ الرقمي. */
export function headerDateLabel(date: string): string {
  return `${WEEKDAY_FMT.format(parseIsoDate(date))}، ${numericDate(date)}`;
}

/** تسمية اليوم المفرد بأسلوب المرجع، مع لاحقة (اليوم) إذا كان تاريخ اليوم. */
export function dayDateLabel(date: string, today: string): string {
  const base = `${WEEKDAY_FMT.format(parseIsoDate(date))} ${numericDate(date)}`;
  return date === today ? `${base} (اليوم)` : base;
}

/** «2026/11/08» — تاريخ رقمي صريح بحدود UTC بترتيب المرجع. */
function numericDate(date: string): string {
  return date.replaceAll("-", "/");
}

export type TimeGridWindow = { startMin: number; endMin: number };

/** نافذة الشبكة الزمنية الافتراضية — تغطي ساعات العمل وبداية المساء. */
const DEFAULT_WINDOW: TimeGridWindow = { startMin: 5 * 60, endMin: 18 * 60 };

/**
 * نقي — نافذة الشبكة الزمنية لعرض المواعيد: ساعات العمل الافتراضية ممتدة
 * لتشمل أي موعد خارجها، مقرّبة إلى حدود الساعة وضمن حدود اليوم.
 */
export function timeGridWindow(
  appointments: { startsAt: string; durationMin: number }[],
): TimeGridWindow {
  let startMin = DEFAULT_WINDOW.startMin;
  let endMin = DEFAULT_WINDOW.endMin;
  for (const a of appointments) {
    const t = new Date(a.startsAt);
    const start = t.getUTCHours() * 60 + t.getUTCMinutes();
    startMin = Math.min(startMin, start);
    endMin = Math.max(endMin, start + Math.max(a.durationMin, 0));
  }
  return {
    startMin: Math.max(0, Math.floor(startMin / 60) * 60),
    endMin: Math.min(24 * 60, Math.ceil(endMin / 60) * 60),
  };
}

/** دقائق من منتصف الليل UTC — لموضعة بلوك الموعد داخل عمود الشبكة. */
export function minutesFromMidnightUtc(iso: string): number {
  const t = new Date(iso);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** قيمة حقل الوقت (HH:mm) لساعة بداية الشبكة — للنقر على فجوة فارغة. */
export function hourToTimeInput(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** تجميع العناصر حسب يومها (YYYY-MM-DD) مع حفظ الترتيب الزمني داخل اليوم. */
export function groupByDay<T extends { startsAt: string }>(
  items: T[],
): Map<string, T[]> {
  const byDay = new Map<string, T[]>();
  for (const item of items) {
    const day = item.startsAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  return byDay;
}

/**
 * تجميع مواعيد اليوم حسب ساعة بدايتها — لشبكة الفتحات الزمنية في عرض اليوم:
 * كل صف ساعة يعرض مواعيده الناشئة فيه، والساعات بلا مواعيد فجوات فارغة.
 */
export function groupByStartHour<T extends { startsAt: string }>(
  items: T[],
): Map<number, T[]> {
  const byHour = new Map<number, T[]>();
  for (const item of items) {
    const hour = Math.floor(minutesFromMidnightUtc(item.startsAt) / 60);
    byHour.set(hour, [...(byHour.get(hour) ?? []), item]);
  }
  return byHour;
}
