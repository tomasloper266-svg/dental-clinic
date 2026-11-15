import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { isUsdAmount } from "@/lib/currency";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/reports-view";

// خدمة مصاريف العيادة — سجل مستقل بفئات ثابتة، يعرض لاحقاً مقابل التحصيل
// في تقرير الفترة (انظر lib/services/reports.ts).
// الفئات الثابتة وتسمياتها نقية وتسكن في lib/reports-view.ts — من هنا
// يُعاد تصديرها لسائر الخدمات بلا تكرار.
export { EXPENSE_CATEGORIES } from "@/lib/reports-view";
export type { ExpenseCategory } from "@/lib/reports-view";

// التسميات العربية نقية وتسكن في lib/reports-view.ts لتحصل الواجهة عليها
// بلا سحب كود الخادم إلى حزمة المتصفح — ومن هنا يُعاد تصديرها لسائر الخدمات.
export {
  EXPENSE_CATEGORY_LABELS,
  expenseCategoryLabel,
} from "@/lib/reports-view";

export type ExpenseDto = {
  id: string;
  // القاعدة تخزن سلسلة نصية — صلاحية الفئة مضمونة عند الإدخال حصراً
  category: string;
  amountUsd: number;
  note: string | null;
  spentAt: Date;
};

export type ExpenseInput = {
  category: ExpenseCategory;
  amountUsd: number;
  note?: string;
  spentAt?: Date;
};

// تحقق نقي من جسم الطلب — يُختبر وحدوياً قبل أي لمس لقاعدة البيانات.
export function parseCreateExpense(
  body: unknown,
): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;

  const category = b.category as ExpenseCategory;
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return { ok: false, error: "فئة المصروف غير صالحة" };
  }

  const amountUsd = typeof b.amountUsd === "number" ? b.amountUsd : NaN;
  if (!isUsdAmount(amountUsd) || amountUsd <= 0) {
    return { ok: false, error: "المصروف يجب أن يكون رقماً موجباً بمنزلتين عشريتين كحد أقصى" };
  }

  const note = typeof b.note === "string" ? b.note.trim() : undefined;
  let spentAt: Date | undefined;
  if (b.spentAt !== undefined) {
    const parsed = new Date(b.spentAt as string);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "تاريخ المصروف غير صالح" };
    }
    spentAt = parsed;
  }

  return { ok: true, value: { category, amountUsd, note, spentAt } };
}

export type ExpensePeriod = { from: Date; to: Date };

export async function listExpenses(
  ctx: TenantContext,
  period?: ExpensePeriod,
): Promise<ExpenseDto[]> {
  const db = clinicScope(ctx.clinicId);
  const rows = await db.expense.findMany({
    where: period
      ? { spentAt: { gte: period.from, lt: period.to } }
      : {},
    orderBy: { spentAt: "desc" },
    take: 200,
    select: {
      id: true,
      category: true,
      amountUsd: true,
      note: true,
      spentAt: true,
    },
  });
  return rows.map((row) => ({ ...row, amountUsd: Number(row.amountUsd) }));
}

export async function createExpense(
  ctx: TenantContext,
  input: ExpenseInput,
): Promise<ExpenseDto> {
  const db = clinicScope(ctx.clinicId);
  const expense = await db.expense.create({
    data: {
      clinicId: ctx.clinicId,
      category: input.category,
      amountUsd: input.amountUsd,
      note: input.note,
      spentAt: input.spentAt,
    },
    select: {
      id: true,
      category: true,
      amountUsd: true,
      note: true,
      spentAt: true,
    },
  });
  return { ...expense, amountUsd: Number(expense.amountUsd) };
}
