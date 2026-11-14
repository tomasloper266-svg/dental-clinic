import { localDayOf, localMonthKeyOf } from "@/lib/local-day";

// عرضات إيراد لوحة القيادة — نقية بلا I/O تُختبر وحدوياً. كل سلسلة تحمل
// التعريفَين منفصلين: «رسوم صادرة» (قيود CHARGE) و«تحصيل» (قيود PAYMENT) —
// الدمج بين التعريفين هو مصدر سوء الفهم الوحيد مع المرجع، فلا يجتمعان في
// رقم واحد أبداً. التجميع بتوقيت العيادة (دمشق) كما في تقرير الفترة.

const DAY_MS = 24 * 60 * 60 * 1000;

/** صف قيد الدفتر كما تستعمله عرضات اللوحة — نوعه ومبلغه ولحظته */
export type RevenueRow = { type: string; amountSyp: number; createdAt: string | Date };

/** نقطة سلسلة إيراد — مفتاح فترة (يوم أو شهر) والتعريفان منفصلين */
export type RevenueDualPoint = {
  /** مفتاح الفترة: يوم YYYY-MM-DD أو شهر YYYY-MM */
  key: string;
  chargesSyp: number;
  collectedSyp: number;
};

/**
 * نقي — آخر count شهراً منتهية بشهر اليوم، بلا إزاحة: التعريفان
 * (رسوم/تحصيل) يُجمعان لكل شهر بتوقيت العيادة.
 */
export function monthlyRevenueDual(
  rows: ReadonlyArray<RevenueRow>,
  endDay: string,
  count = 6,
): RevenueDualPoint[] {
  const [y, m] = endDay.split("-").map(Number) as [number, number, number];
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const cursor = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(cursor.toISOString().slice(0, 7));
  }
  const index = new Map(keys.map((key, i) => [key, i] as const));
  const points = keys.map((key) => ({ key, chargesSyp: 0, collectedSyp: 0 }));
  for (const row of rows) {
    const position = index.get(localMonthKeyOf(row.createdAt));
    if (position === undefined) continue;
    if (row.type === "CHARGE") {
      points[position].chargesSyp += row.amountSyp;
    } else if (row.type === "PAYMENT") {
      points[position].collectedSyp += Math.abs(row.amountSyp);
    }
  }
  return points;
}

/**
 * نقي — آخر count يوماً منتهية بيوم اليوم، بلا إزاحة. التجميع بيوم العيادة
 * المحلي (localDayOf) — حركة منتصف الليل المحلي تبقى في يومها.
 */
export function dailyRevenueDual(
  rows: ReadonlyArray<RevenueRow>,
  now: Date,
  count = 7,
): RevenueDualPoint[] {
  const today = localDayOf(now);
  const base = new Date(`${today}T00:00:00Z`).getTime();
  const index = new Map<string, number>();
  const points: RevenueDualPoint[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const key = new Date(base - i * DAY_MS).toISOString().slice(0, 10);
    index.set(key, points.length);
    points.push({ key, chargesSyp: 0, collectedSyp: 0 });
  }
  for (const row of rows) {
    const position = index.get(localDayOf(row.createdAt));
    if (position === undefined) continue;
    if (row.type === "CHARGE") {
      points[position].chargesSyp += row.amountSyp;
    } else if (row.type === "PAYMENT") {
      points[position].collectedSyp += Math.abs(row.amountSyp);
    }
  }
  return points;
}

/**
 * نقي — إيراد الشهر الحالي (شهر اليوم بتوقيت العيادة) بالتعريفين منفصلين:
 * بطاقة «إيراد هذا الشهر» تعرض التحصيل أساساً (مطابقة تعريف المرجع الشهري)
 * والرسوم الصادرة سطراً ثانوياً.
 */
export function currentMonthRevenue(
  rows: ReadonlyArray<RevenueRow>,
  now: Date,
): { chargesSyp: number; collectedSyp: number } {
  const month = localMonthKeyOf(now);
  let chargesSyp = 0;
  let collectedSyp = 0;
  for (const row of rows) {
    if (localMonthKeyOf(row.createdAt) !== month) continue;
    if (row.type === "CHARGE") {
      chargesSyp += row.amountSyp;
    } else if (row.type === "PAYMENT") {
      collectedSyp += Math.abs(row.amountSyp);
    }
  }
  return { chargesSyp, collectedSyp };
}
