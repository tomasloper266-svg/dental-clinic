// حدود الأيام والأسابيع — نقية تُستخدم في واجهة الجدول وواجهة برمجة المواعيد.
// تُحسب بـ UTC: العميل يرسل التاريخ كنص YYYY-MM-DD فتبقى حدود اليوم محددة
// بلا انزياح منطقة زمنية.

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function dayRange(date: Date): [Date, Date] {
  const start = dayStart(date);
  return [start, new Date(start.getTime() + DAY_MS)];
}

// الأسبوع يبدأ السبت (العربية) وينتهي الجمعة.
export function weekRange(date: Date): [Date, Date] {
  const start = dayStart(date);
  // getUTCDay: 0=الأحد … 6=السبت — نُرجع 6 أيام للوراء ليبدأ الأسبوع بالسبت.
  const daysSinceSaturday = (start.getUTCDay() + 1) % 7;
  const weekStart = new Date(start.getTime() - daysSinceSaturday * DAY_MS);
  return [weekStart, new Date(weekStart.getTime() + 7 * DAY_MS)];
}

// أول الشهر حتى أول الشهر التالي — بتوقيت UTC مثل بقية حدود الأيام.
export function monthRange(date: Date): [Date, Date] {
  const start = dayStart(date);
  return [
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)),
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
  ];
}

// إزاحة التاريخ بحدود يوم ثابتة — للتنقل بين الأيام والأسابيع.
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}
