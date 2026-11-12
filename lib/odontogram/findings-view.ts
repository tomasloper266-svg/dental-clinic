// دوال عرض نقية فوق سجل المشاهدات — تُختبر في وحدة منفصلة عن قاعدة البيانات.
// القاعدة: المشاهدات سجل إلحاقي — لا تُمحى ولا تُستبدل؛ العرض يستنتج «آخر حالة» فقط.

export type FindingRecord = {
  toothFdi: number;
  kind: string;
  status: string;
  recordedAt: string | Date;
};

// آخر مشاهدة لكل سن حسب ترتيب التسجيل الزمني — لعرض الحالة الحالية على الأودوغرام.
export function latestFindingByTooth<T extends FindingRecord>(
  findings: readonly T[],
): Map<number, T> {
  const latest = new Map<number, T>();
  for (const finding of findings) {
    const existing = latest.get(finding.toothFdi);
    if (!existing || timeOf(finding) >= timeOf(existing)) {
      latest.set(finding.toothFdi, finding);
    }
  }
  return latest;
}

// سجل سن واحد كاملاً بترتيب زمني تصاعدي — التاريخ يبقى محفوظاً بلا استبدال.
export function findingsForTooth<T extends FindingRecord>(
  findings: readonly T[],
  toothFdi: number,
): T[] {
  return findings
    .filter((f) => f.toothFdi === toothFdi)
    .sort((a, b) => timeOf(a) - timeOf(b));
}

function timeOf(f: FindingRecord): number {
  return f.recordedAt instanceof Date
    ? f.recordedAt.getTime()
    : new Date(f.recordedAt).getTime();
}
