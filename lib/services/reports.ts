import type { TenantContext } from "@/lib/tenant/context";
import { clinicScope } from "@/lib/tenant/clinic-client";

// تقرير الفترة — التحصيل (القيمة المطلقة للقيود الدافعة) مقابل المصاريف،
// وصافي الفترة. جمع القيود عبر المجموع الموقّع، والمصاريف عبر سجلها المستقل.

export type PeriodReport = {
  from: Date;
  to: Date;
  collectedUsd: number;
  expensesUsd: number;
  netUsd: number;
  refundsUsd: number;
};

// تجميع نقي — يُختبر وحدوياً: التحصيل = مجموع الدفعات بقيمة مطلقة،
// والمصروفات مجموع سجل المصاريف، والصافي = التحصيل − المصاريف.
export function summarizePeriod(
  ledgerAmounts: ReadonlyArray<{ type: string; amountUsd: number }>,
  expenseAmounts: ReadonlyArray<{ amountUsd: number }>,
): { collectedUsd: number; expensesUsd: number; netUsd: number; refundsUsd: number } {
  let collectedUsd = 0;
  let refundsUsd = 0;
  for (const entry of ledgerAmounts) {
    if (entry.type === "PAYMENT") {
      collectedUsd += Math.abs(entry.amountUsd);
    } else if (entry.type === "REFUND") {
      refundsUsd += entry.amountUsd;
    }
  }
  const expensesUsd = expenseAmounts.reduce(
    (sum, expense) => sum + expense.amountUsd,
    0,
  );
  // التحصيل الصافي بعد الاستردادات المطروحة من المقبوضات.
  return {
    collectedUsd,
    expensesUsd,
    netUsd: collectedUsd - refundsUsd - expensesUsd,
    refundsUsd,
  };
}

// حدود يوم التقويم — نطاق [from, to) حصري من الطرفين زمنياً.
export function dayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

// حدود شهر تقويمي (1..12) — نطاق [from, to) حصري من الطرفين زمنياً.
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from, to };
}

export async function getPeriodReport(
  ctx: TenantContext,
  period: { from: Date; to: Date },
): Promise<PeriodReport> {
  const db = clinicScope(ctx.clinicId);
  const [ledgerRows, expenseRows] = await Promise.all([
    db.ledgerEntry.findMany({
      where: {
        createdAt: { gte: period.from, lt: period.to },
      },
      select: { type: true, amountUsd: true },
    }),
    db.expense.findMany({
      where: {
        spentAt: { gte: period.from, lt: period.to },
      },
      select: { amountUsd: true },
    }),
  ]);
  const summary = summarizePeriod(
    ledgerRows.map((r) => ({ ...r, amountUsd: Number(r.amountUsd) })),
    expenseRows.map((r) => ({ ...r, amountUsd: Number(r.amountUsd) })),
  );
  return { from: period.from, to: period.to, ...summary };
}

export async function getDailyReport(
  ctx: TenantContext,
  date: Date,
): Promise<PeriodReport> {
  return getPeriodReport(ctx, dayRange(date));
}

export async function getMonthlyReport(
  ctx: TenantContext,
  year: number,
  month: number,
): Promise<PeriodReport> {
  return getPeriodReport(ctx, monthRange(year, month));
}

export type DailySeriesPoint = {
  /** يوم السلسلة بصيغة YYYY-MM-DD (UTC) */
  date: string;
  collectedUsd: number;
  expensesUsd: number;
  netUsd: number;
  refundsUsd: number;
};

/**
 * نقي — توزيع قيود ومصاريف نطاق على أيام UTC. كل يوم يُجمَّع بنفس
 * summarizePeriod فلا يُعاد تفسير أي حساب مالي. الأيام بلا حركة تعيد أصفاراً.
 */
export function bucketDailySeries(
  ledgerRows: ReadonlyArray<{ type: string; amountUsd: number; createdAt: Date }>,
  expenseRows: ReadonlyArray<{ amountUsd: number; spentAt: Date }>,
  days: number,
  endDate: Date,
): DailySeriesPoint[] {
  const points: DailySeriesPoint[] = [];
  const index = new Map<string, DailySeriesPoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(dayRange(endDate).from);
    day.setUTCDate(day.getUTCDate() - i);
    const key = day.toISOString().slice(0, 10);
    const point: DailySeriesPoint = {
      date: key,
      collectedUsd: 0,
      expensesUsd: 0,
      netUsd: 0,
      refundsUsd: 0,
    };
    points.push(point);
    index.set(key, point);
  }

  for (const row of ledgerRows) {
    const point = index.get(row.createdAt.toISOString().slice(0, 10));
    if (!point) continue;
    if (row.type === "PAYMENT") {
      point.collectedUsd += Math.abs(row.amountUsd);
    } else if (row.type === "REFUND") {
      point.refundsUsd += row.amountUsd;
    }
  }
  for (const row of expenseRows) {
    const point = index.get(row.spentAt.toISOString().slice(0, 10));
    if (!point) continue;
    point.expensesUsd += row.amountUsd;
  }
  for (const point of points) {
    point.netUsd = point.collectedUsd - point.refundsUsd - point.expensesUsd;
  }
  return points;
}

/** سلسلة يومية لأحدث N يوماً منتهية بيوم محدد — لرسم التقارير. */
export async function getDailySeries(
  ctx: TenantContext,
  endDate: Date,
  days: number,
): Promise<DailySeriesPoint[]> {
  const to = dayRange(endDate).to;
  const from = dayRange(new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000)).from;
  const db = clinicScope(ctx.clinicId);
  const [ledgerRows, expenseRows] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { type: true, amountUsd: true, createdAt: true },
    }),
    db.expense.findMany({
      where: { spentAt: { gte: from, lt: to } },
      select: { amountUsd: true, spentAt: true },
    }),
  ]);
  return bucketDailySeries(
    ledgerRows.map((r) => ({ ...r, amountUsd: Number(r.amountUsd) })),
    expenseRows.map((r) => ({ ...r, amountUsd: Number(r.amountUsd) })),
    days,
    endDate,
  );
}
