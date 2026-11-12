// دوال عرض نقية لخطة العلاج — تُستخدم في ملف المريض ولوحة الخطة داخل الأودوغرام.
// لا منطق عمل هنا: الحالات والإجماليات للعرض فقط، والمنطق يبقى في الخدمة.

import type { PlanItemDto, PlanItemStatus } from "./services/treatment-plan";

export type PlanStatusSummary = {
  status: PlanItemStatus;
  count: number;
  total: number;
};

export type PlanTotals = {
  byStatus: Record<PlanItemStatus, PlanStatusSummary>;
  /** إجمالي البنود كافة بغضّ الحالة — السطر الختامي في ملخص الخطة */
  grandTotal: number;
  /** إجمالي البنود المقبولة فقط — القيمة المتوقع موافقتها على التنفيذ */
  acceptedTotal: number;
};

const EMPTY_COUNT = (): Record<PlanItemStatus, PlanStatusSummary> => ({
  PROPOSED: { status: "PROPOSED", count: 0, total: 0 },
  ACCEPTED: { status: "ACCEPTED", count: 0, total: 0 },
  DONE: { status: "DONE", count: 0, total: 0 },
});

/** عدّاد ومجموع كل حالة + الإجمالي العام — جمع زبوني للعرض فقط. */
export function planTotals(items: readonly PlanItemDto[]): PlanTotals {
  const byStatus = EMPTY_COUNT();
  let grandTotal = 0;
  let acceptedTotal = 0;

  for (const item of items) {
    const summary = byStatus[item.status];
    summary.count += 1;
    summary.total += item.priceSyp;
    grandTotal += item.priceSyp;
    if (item.status === "ACCEPTED") acceptedTotal += item.priceSyp;
  }

  return { byStatus, grandTotal, acceptedTotal };
}

/** بنود مرتبة حسب السن ثم الأولوية — ترتيب العرض في الجداول والملف. */
export function planByTooth(items: readonly PlanItemDto[]): PlanItemDto[] {
  return [...items].sort(
    (a, b) => a.toothFdi - b.toothFdi || b.priority - a.priority,
  );
}
