import { describe, expect, it } from "vitest";
import { bucketDailySeries } from "@/lib/services/reports";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  formatShortSyp,
  seriesMax,
  summarizeExpensesByCategory,
} from "@/lib/reports-view";

// اختبارات وحدة بيانات عرض التقارير — نقية بلا قاعدة بيانات.

describe("توزيع السلسلة اليومية", () => {
  const endDate = new Date("2026-01-05T00:00:00Z");

  it("يبني N يوماً منتهية بيوم النهاية بترتيب تصاعدي", () => {
    const points = bucketDailySeries([], [], 3, endDate);
    expect(points.map((p) => p.date)).toEqual([
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
    expect(points[0].collectedSyp).toBe(0);
  });

  it("يجمع الدفعات والمصاريف في يومها الصحيح وبنفس قواعد summarizePeriod", () => {
    const points = bucketDailySeries(
      [
        { type: "PAYMENT", amountSyp: -200_000, createdAt: new Date("2026-01-04T10:00:00Z") },
        { type: "PAYMENT", amountSyp: -100_000, createdAt: new Date("2026-01-05T09:00:00Z") },
        { type: "REFUND", amountSyp: 50_000, createdAt: new Date("2026-01-05T11:00:00Z") },
        { type: "CHARGE", amountSyp: 900_000, createdAt: new Date("2026-01-05T12:00:00Z") },
      ],
      [{ amountSyp: 75_000, spentAt: new Date("2026-01-04T08:00:00Z") }],
      2,
      endDate,
    );
    expect(points[0]).toMatchObject({
      date: "2026-01-04",
      collectedSyp: 200_000,
      expensesSyp: 75_000,
      netSyp: 125_000,
    });
    expect(points[1]).toMatchObject({
      date: "2026-01-05",
      collectedSyp: 100_000,
      refundsSyp: 50_000,
      expensesSyp: 0,
      // الرسوم لا تُعد تحصيلاً — نفس قاعدة التقرير
      netSyp: 100_000 - 50_000,
    });
  });

  it("قيود خارج النطاق الزمني تُتجاهل بلا خطأ", () => {
    const points = bucketDailySeries(
      [{ type: "PAYMENT", amountSyp: -1, createdAt: new Date("2025-01-01T00:00:00Z") }],
      [],
      2,
      endDate,
    );
    expect(points.every((p) => p.collectedSyp === 0)).toBe(true);
  });
});

describe("تسميات الفئات", () => {
  it("الفئات الثابتة بأسمائها العربية", () => {
    expect(EXPENSE_CATEGORIES).toEqual(["RENT", "SALARIES", "MATERIALS", "OTHER"]);
    expect(expenseCategoryLabel("RENT")).toBe("إيجار");
    expect(expenseCategoryLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("توزيع المصاريف حسب الفئة", () => {
  it("يجمع حسب الفئة ويرتب تنازلياً حسب المبلغ", () => {
    const totals = summarizeExpensesByCategory([
      { category: "MATERIALS", amountSyp: 100_000 },
      { category: "RENT", amountSyp: 500_000 },
      { category: "MATERIALS", amountSyp: 50_000 },
    ]);
    expect(totals).toEqual([
      { category: "RENT", totalSyp: 500_000 },
      { category: "MATERIALS", totalSyp: 150_000 },
    ]);
  });

  it("لا مصاريف يعطي قائمة فارغة", () => {
    expect(summarizeExpensesByCategory([])).toEqual([]);
  });
});

describe("ملصقات المحور المختصرة", () => {
  it("يلخّص الآلاف والملايين بأرقام لاتينية", () => {
    expect(formatShortSyp(450_000)).toBe("450ألف");
    expect(formatShortSyp(1_200_000)).toBe("1.2م");
    expect(formatShortSyp(750)).toBe("750");
    expect(formatShortSyp(0)).toBe("0");
  });
});

describe("مقياس الرسم", () => {
  it("يعيد أعلى قيمة بين التحصيل والمصاريف ولا يعيد صفراً أبداً", () => {
    expect(
      seriesMax([
        { collectedSyp: 300_000, expensesSyp: 100_000 },
        { collectedSyp: 150_000, expensesSyp: 400_000 },
      ]),
    ).toBe(400_000);
    expect(seriesMax([{ collectedSyp: 0, expensesSyp: 0 }])).toBe(1);
  });
});
