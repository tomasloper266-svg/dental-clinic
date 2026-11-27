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

/** ألفاظ حالات بند الخطة في الواجهة — التسميات كما في المرجع البصري */
export type PlanItemStatusMeta = {
  status: PlanItemStatus;
  labelAr: string;
  labelEn: string;
  toneClass: string;
};

const PLAN_ITEM_STATUS_META: Record<PlanItemStatus, PlanItemStatusMeta> = {
  PROPOSED: {
    status: "PROPOSED",
    labelAr: "مخطط",
    labelEn: "Planned",
    toneClass: "bg-warm-100 text-steel-600",
  },
  ACCEPTED: {
    status: "ACCEPTED",
    labelAr: "جاري",
    labelEn: "In progress",
    toneClass: "bg-primary-50 text-primary-800",
  },
  DONE: {
    status: "DONE",
    labelAr: "مكتمل",
    labelEn: "Completed",
    toneClass: "bg-success-50 text-success-700",
  },
};

/** بيانات عرض حالة بند الخطة — تسمية عربية ودرجة لون الشارة. نقي — آمن للعميل */
export function planStatusMeta(status: PlanItemStatus): PlanItemStatusMeta {
  return PLAN_ITEM_STATUS_META[status];
}

/** تسمية حالة بند الخطة بلغة محددة — الجداول والمنسدلات */
export function planStatusLabel(locale: "ar" | "en", status: PlanItemStatus): string {
  const meta = PLAN_ITEM_STATUS_META[status];
  return locale === "en" ? meta.labelEn : meta.labelAr;
}

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
    summary.total += item.priceUsd;
    grandTotal += item.priceUsd;
    if (item.status === "ACCEPTED") acceptedTotal += item.priceUsd;
  }

  return { byStatus, grandTotal, acceptedTotal };
}

/** بنود مرتبة حسب السن ثم الأولوية — ترتيب العرض في الجداول والملف. */
export function planByTooth(items: readonly PlanItemDto[]): PlanItemDto[] {
  return [...items].sort(
    (a, b) => a.toothFdi - b.toothFdi || b.priority - a.priority,
  );
}

/** أعمدة لوحة الخطط الثلاثة — بنود كل حالة مرتبة حسب السن ثم الأولوية. */
export function planBoardColumns(
  items: readonly PlanItemDto[],
): Record<PlanItemStatus, PlanItemDto[]> {
  return {
    PROPOSED: planByTooth(items.filter((it) => it.status === "PROPOSED")),
    ACCEPTED: planByTooth(items.filter((it) => it.status === "ACCEPTED")),
    DONE: planByTooth(items.filter((it) => it.status === "DONE")),
  };
}

/** رابط سنٍّ على مخطط المريض المستقل — الصفحة تفتح لوحة السن من ?tooth=. */
export function chartToothHref(patientId: string, fdi: number): string {
  return `/chart?patient=${encodeURIComponent(patientId)}&tooth=${fdi}`;
}
