// حدود الأيام المحلية للعيادة — نقية بلا I/O. التقارير تُصنّف حركة الدفتر
// على أيام دمشق (Asia/Damascus) لا على أيام UTC، وإلا وقعت حركة منتصف الليل
// (00:30 دمشق = 21:30 يوم UTC السابق) في اليوم الخطأ.
//
// المنطقة الزمنية ثابتة معلنة لأن دمشق على +03:00 حالياً على مدار السنة، لكن
// القراءة عبر Intl تجعل الحساب صحيحاً تلقائياً لو تغيّر الإزاحة مستقبلاً —
// لا إزاحة رقمية مباشرة في أي مكان آخر.

/** المنطقة الزمنية المرجعية لأيام التقارير — توقيت العيادة */
export const CLINIC_TIME_ZONE = "Asia/Damascus";

/** صيغة en-CA تُعطي اليوم بصيغة YYYY-MM-DD مباشرة */
const LOCAL_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** صيغة شهر لليمين الصحيح للأشهر المحلية YYYY-MM */
const LOCAL_MONTH_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

/** نقي — يوم YYYY-MM-DD بتوقيت العيادة من قيمة زمنية */
export function localDayOf(value: Date | string): string {
  return LOCAL_DAY_FMT.format(new Date(value));
}

/** نقي — مفتاح الشهر YYYY-MM بتوقيت العيادة من قيمة زمنية */
export function localMonthKeyOf(value: Date | string): string {
  return LOCAL_MONTH_FMT.format(new Date(value));
}

/**
 * نقي — إزاحة المنطقة الزمنية بالمللي ثانية عند لحظة معينة. تُقرأ الساعة
 * المحلية عبر toLocaleString ثم تُقارن باللحظة الأصلية.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const local = new Date(
    at.toLocaleString("en-US", { timeZone }),
  );
  return at.getTime() - local.getTime();
}

/**
 * نقي — لحظة UTC لبداية يوم العيادة YYYY-MM-DD. إزاحة المنطقة تُقدَّر ثم
 * تُصحَّح لمرة واحدة — يكفي لأي منطقة بلا تجميد يوم كامل عند منتصف الليل.
 */
export function localDayStartUtc(day: string, timeZone: string = CLINIC_TIME_ZONE): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const offset = zoneOffsetMs(guess, timeZone);
  const first = new Date(guess.getTime() + offset);
  const correction = zoneOffsetMs(first, timeZone);
  return correction === offset
    ? first
    : new Date(guess.getTime() + correction);
}

/** نقي — نافذة يوم العيادة [بدايته بتوقيت العيادة، بداية يومه التالي) */
export function localDayWindow(
  day: string,
  timeZone: string = CLINIC_TIME_ZONE,
): [Date, Date] {
  const start = localDayStartUtc(day, timeZone);
  return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
}
