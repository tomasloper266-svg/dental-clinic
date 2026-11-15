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
const WEEKDAY_DATE_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** تاريخ مع اليوم — «السبت 2026/11/14» لترويسة الصفحات وبطاقة الفاتورة.
 * timeZone اختياري — تقارير الفترة تُمرّر توقيت العيادة كي يطابق الترويسة
 * «اليوم» المُستعمل في حدود الفترة */
export function formatWeekdayDateCell(
  date: Date | string,
  timeZone?: string,
): string {
  return (timeZone === undefined
    ? WEEKDAY_DATE_FMT
    : new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone,
      })
  ).format(new Date(date));
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


/** قيمة حقل تاريخ YYYY-MM-DD → لحظة منتصف ليل اليوم بتوقيت UTC — بلا مكوّن
 * وقت محلي، فتبقى لحظة «اليوم» ماضية أي كانت الساعة (شرط الخطأ 15: تثبيت
 * الظهر المحلي كان يجعلها مستقبلية قبل الظهر ويرفضها خادم الدفتر). */
export function parseDateInputValue(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** نقي — هل يوم حقل التاريخ لاحق ليوم اليوم؟ مقارنة يوم بيوم (سلسلة ISO)
 * بلا أي مكوّن وقت: «اليوم» مقبول أي كانت الساعة و«غداً» مرفوض دائماً.
 * التحقق الموحّد لنموذجي الدفع والفاتورة (RecordPaymentModal / NewInvoiceModal). */
export function isDateInputFuture(date: string, now: Date): boolean {
  return date.slice(0, 10) > toDateInputValue(now);
}

const DATE_CELL_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** تاريخ خلية جدول — صيغة قصيرة موحّدة 2026/11/09 بأرقام لاتينية */
export function formatDateCell(date: Date | string): string {
  return DATE_CELL_FMT.format(new Date(date));
}
