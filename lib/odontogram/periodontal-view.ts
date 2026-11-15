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
