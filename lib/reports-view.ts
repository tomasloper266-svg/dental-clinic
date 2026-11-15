import type { BadgeTone } from "@/components/ui/Badge";

// بيانات عرض التقارير — نقية بلا I/O. تُستورد من الخدمة أنواع فقط
// (type-only) فلا يُسحب أي كود خادم إلى حزمة المتصفح.

/** الفئات الثابتة للمصاريف — المصدر الوحيد في الخدمة والواجهة معاً */
export const EXPENSE_CATEGORIES = [
  "RENT",
  "SALARIES",
  "MATERIALS",
  "OTHER",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** تسميات فئات المصاريف بالعربية — المصدر الوحيد للفئات في كل العروض */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "إيجار",
  SALARIES: "رواتب",
  MATERIALS: "مواد",
  OTHER: "أخرى",
};

/** تسمية الفئة بالعربية — قيمة غير معروفة تُعرض كما هي بدل أن تُخفى */
export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

/** نبرة لون لكل فئة مصروف — تمييز ثابت في الرسم والجدول */
export const EXPENSE_CATEGORY_TONES: Record<string, BadgeTone> = {
  RENT: "warning",
  SALARIES: "info",
  MATERIALS: "success",
  OTHER: "neutral",
};

export type CategoryTotal = { category: string; totalUsd: number };

/** نقي — مجموع المصاريف حسب الفئة، تنازلياً حسب المبلغ */
export function summarizeExpensesByCategory(
  rows: ReadonlyArray<{ category: string; amountUsd: number }>,
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountUsd);
  }
  return [...totals.entries()]
    .map(([category, totalUsd]) => ({ category, totalUsd }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

/**
 * نقي — تسمية مختصرة لمحور الرسم: «1.2م» للمليون و«450ألف» للألف
 * وبقية القيم كما هي. الأرقام لاتينية للقراءة المالية السريعة.
 */
export function formatShortSyp(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    const millions = Math.round((amount / 1_000_000) * 10) / 10;
    return `${millions}م`;
  }
  if (Math.abs(amount) >= 1_000) {
    const thousands = Math.round(amount / 1_000);
    return `${thousands}ألف`;
  }
  return String(amount);
}

/** نقي — أعلى قيمة في السلسلة لقياس مقياس المحور (تحصيل ومصاريف معاً) */
export function seriesMax(
  series: ReadonlyArray<{ collectedUsd: number; expensesUsd: number }>,
): number {
  return Math.max(1, ...series.flatMap((p) => [p.collectedUsd, p.expensesUsd]));
}
