import type { TenantContext } from "@/lib/tenant/context";
import { clinicScope } from "@/lib/tenant/clinic-client";

// تقرير الفترة — التحصيل (القيمة المطلقة للقيود الدافعة) مقابل المصاريف،
// وصافي الفترة. جمع القيود عبر المجموع الموقّع، والمصاريف عبر سجلها المستقل.

export type PeriodReport = {
  from: Date;
  to: Date;
  collectedSyp: number;
  expensesSyp: number;
  netSyp: number;
  refundsSyp: number;
};

// تجميع نقي — يُختبر وحدوياً: التحصيل = مجموع الدفعات بقيمة مطلقة،
// والمصروفات مجموع سجل المصاريف، والصافي = التحصيل − المصاريف.
export function summarizePeriod(
  ledgerAmounts: ReadonlyArray<{ type: string; amountSyp: number }>,
  expenseAmounts: ReadonlyArray<{ amountSyp: number }>,
): { collectedSyp: number; expensesSyp: number; netSyp: number; refundsSyp: number } {
  let collectedSyp = 0;
  let refundsSyp = 0;
  for (const entry of ledgerAmounts) {
    if (entry.type === "PAYMENT") {
      collectedSyp += Math.abs(entry.amountSyp);
    } else if (entry.type === "REFUND") {
      refundsSyp += entry.amountSyp;
    }
  }
  const expensesSyp = expenseAmounts.reduce(
    (sum, expense) => sum + expense.amountSyp,
    0,
  );
  // التحصيل الصافي بعد الاستردادات المطروحة من المقبوضات.
  return {
    collectedSyp,
    expensesSyp,
    netSyp: collectedSyp - refundsSyp - expensesSyp,
    refundsSyp,
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
      select: { type: true, amountSyp: true },
    }),
    db.expense.findMany({
      where: {
        spentAt: { gte: period.from, lt: period.to },
      },
      select: { amountSyp: true },
    }),
  ]);

  const summary = summarizePeriod(ledgerRows, expenseRows);
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
