// دوال عرض نقية فوق سجل قراءات الدواعم — نمط findings-view.ts حرفاً.
// القاعدة: القياسات إلحاقية — لا تُمحى ولا تُستبدل؛ العرض يستنتج «آخر قياس» فقط.

export type PeriodontalRecord = {
  toothFdi: number;
  measuredAt: string | Date;
};

// آخر قراءة لكل سن حسب ترتيب القياس الزمني — للعرض الحالي على المخطط.
export function latestReadingByTooth<T extends PeriodontalRecord>(
  readings: readonly T[],
): Map<number, T> {
  const latest = new Map<number, T>();
  for (const reading of readings) {
    const existing = latest.get(reading.toothFdi);
    if (!existing || timeOf(reading) >= timeOf(existing)) {
      latest.set(reading.toothFdi, reading);
    }
  }
  return latest;
}

// سجل سن واحد كاملاً بترتيب زمني تصاعدي — التاريخ يبقى محفوظاً بلا استبدال.
export function readingsForTooth<T extends PeriodontalRecord>(
  readings: readonly T[],
  toothFdi: number,
): T[] {
  return readings
    .filter((r) => r.toothFdi === toothFdi)
    .sort((a, b) => timeOf(a) - timeOf(b));
}

function timeOf(r: PeriodontalRecord): number {
  return r.measuredAt instanceof Date
    ? r.measuredAt.getTime()
    : new Date(r.measuredAt).getTime();
}

// عتبات الملخص السريري — أرقام تقارير المتابعة لا الفواتير.
export const SUMMARY_POCKET_MIN_MM = 5;
export const SUMMARY_MOBILITY_MIN_GRADE = 2;

// حدود القياسات السريرية — أول حقول عددية في النظام، بحدود صريحة.
// تسكن هنا في الوحدة النقية (لا اعتماديات سيرفر) لتهلك مكوّنات العميل
// والخدمة معاً دون سحب pg إلى حزمة المتصفح.
export const POCKET_DEPTH_MIN_MM = 0;
export const POCKET_DEPTH_MAX_MM = 15;
export const RECESSION_MIN_MM = -5;
export const RECESSION_MAX_MM = 10;
export const MOBILITY_MIN_GRADE = 0;
export const MOBILITY_MAX_GRADE = 3;

// مقياس تلوين عمق الجيب على المخطط — أخضر ≤3 / أصفر 4–5 / أحمر ≥6.
// النزيف يُرسم نقشاً فوق اللون — التمييز لا يعتمد على اللون وحده.
export type PocketScaleLevel = "ok" | "warn" | "alert";

export function pocketScaleLevel(
  mm: number | null | undefined,
): PocketScaleLevel | null {
  if (mm === null || mm === undefined) return null;
  if (mm <= 3) return "ok";
  if (mm <= 5) return "warn";
  return "alert";
}

export const POCKET_SCALE_COLORS: Record<PocketScaleLevel, string> = {
  ok: "var(--color-periodontal-ok)",
  warn: "var(--color-periodontal-warn)",
  alert: "var(--color-periodontal-alert)",
};

export const POCKET_SCALE_KEYS = ["ok", "warn", "alert"] as const;

export const POCKET_SCALE_LABEL_AR: Record<PocketScaleLevel, string> = {
  ok: "سليم (≤3مم)",
  warn: "إنذار (4–5مم)",
  alert: "جيب عميق (≥6مم)",
};

export type PeriodontalRecordValues = PeriodontalRecord & {
  pocketDepthMm?: number | null;
  recessionMm?: number | null;
  bleedingOnProbing?: boolean | null;
  mobilityGrade?: number | null;
};

export type PeriodontalSummary = {
  /** عدد القياسات الإلحاقية الكلي في السجل */
  readingCount: number;
  /** عدد الأسنان التي فُحصت (لها قراءة واحدة على الأقل) */
  teethExamined: number;
  /** أسنان آخر قياس لها جيب ≥5مم */
  teethWithPocket5Plus: number;
  /** مواضع النزيف عند الجس في آخر قياس لكل سن */
  bleedingSites: number;
  /** أسنان آخر قياس لها حركية ≥2 */
  teethWithMobility2Plus: number;
  /** تاريخ آخر قياس في السجل — null يعني لا قياسات بعد */
  lastMeasuredAt: string | null;
};

// ملخص دواعم نقية فوق السجل الإلحاقي — العد من «آخر قياس لكل سن» لأن القيم
// القديمة لا تعبر عن الحالة الحالية، بينما مواضع النزيف تُحسب من القراءة نفسها.
export function summarizePeriodontal(
  readings: readonly PeriodontalRecordValues[],
): PeriodontalSummary {
  const latest = latestReadingByTooth(readings);

  let teethWithPocket5Plus = 0;
  let bleedingSites = 0;
  let teethWithMobility2Plus = 0;
  for (const reading of latest.values()) {
    if ((reading.pocketDepthMm ?? 0) >= SUMMARY_POCKET_MIN_MM) {
      teethWithPocket5Plus += 1;
    }
    if (reading.bleedingOnProbing === true) {
      bleedingSites += 1;
    }
    if ((reading.mobilityGrade ?? 0) >= SUMMARY_MOBILITY_MIN_GRADE) {
      teethWithMobility2Plus += 1;
    }
  }

  let lastMeasuredAt: string | null = null;
  for (const reading of readings) {
    const time = timeOf(reading);
    if (!lastMeasuredAt || time > new Date(lastMeasuredAt).getTime()) {
      lastMeasuredAt =
        reading.measuredAt instanceof Date
          ? reading.measuredAt.toISOString()
          : reading.measuredAt;
    }
  }

  return {
    readingCount: readings.length,
    teethExamined: latest.size,
    teethWithPocket5Plus,
    bleedingSites,
    teethWithMobility2Plus,
    lastMeasuredAt,
  };
}
