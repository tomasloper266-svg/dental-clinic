import { describe, expect, it } from "vitest";

import {
  MATERIAL_STATUS_LABELS,
  healthyCount,
  materialStockStatus,
  materialsToCsv,
  stockLevelRatio,
} from "@/lib/inventory-view";

// اختبارات بيانات عرض المخزون — الحالات ومستوى الرصيد وملف CSV، كلها نقية.

describe("materialStockStatus — حالة المادة", () => {
  it("الصفر حرج", () => {
    expect(materialStockStatus({ quantityOnHand: 0, minQuantity: 3 })).toBe(
      "critical",
    );
  });
  it("عند حد التنبيه بالضبط منخفض", () => {
    expect(materialStockStatus({ quantityOnHand: 5, minQuantity: 5 })).toBe(
      "low",
    );
  });
  it("فوق حد التنبيه متوفر", () => {
    expect(materialStockStatus({ quantityOnHand: 9, minQuantity: 5 })).toBe(
      "available",
    );
  });
  it("التسميات العربية للحالات الثلاث", () => {
    expect(MATERIAL_STATUS_LABELS).toEqual({
      available: "متوفر",
      low: "منخفض",
      critical: "حرج",
    });
  });
});

describe("stockLevelRatio — نسبة شريط الكمية", () => {
  it("الرصيد صفر يعطي صفراً", () => {
    expect(stockLevelRatio({ quantityOnHand: 0, minQuantity: 4 })).toBe(0);
  });
  it("الرصيد بضعف الحد فأكثر يشبع عند 1", () => {
    expect(stockLevelRatio({ quantityOnHand: 12, minQuantity: 6 })).toBe(1);
    expect(stockLevelRatio({ quantityOnHand: 30, minQuantity: 6 })).toBe(1);
  });
  it("قيمة بينية نسبية على مقياس ضعف الحد", () => {
    expect(stockLevelRatio({ quantityOnHand: 3, minQuantity: 6 })).toBeCloseTo(
      0.25,
    );
  });
  it("حد التنبيه صفر لا يقسم على صفر", () => {
    expect(stockLevelRatio({ quantityOnHand: 0, minQuantity: 0 })).toBe(0);
    expect(stockLevelRatio({ quantityOnHand: 5, minQuantity: 0 })).toBe(1);
  });
});

describe("healthyCount — المواد بحالة جيدة", () => {
  it("يعد غير المنخفض حصراً", () => {
    expect(
      healthyCount([
        { quantityOnHand: 9, minQuantity: 4, isLow: false },
        { quantityOnHand: 2, minQuantity: 5, isLow: true },
        { quantityOnHand: 0, minQuantity: 3, isLow: true },
      ]),
    ).toBe(1);
  });
  it("قائمة فارغة تعطي صفراً", () => {
    expect(healthyCount([])).toBe(0);
  });
});

describe("materialsToCsv — تصدير المواد", () => {
  it("رأس عربي وصفوف بقيم مقتبسة وBOM وترميز CRLF", () => {
    const csv = materialsToCsv([
      {
        name: "أقنعة N95",
        unit: "علبة",
        quantityOnHand: 2,
        minQuantity: 5,
        costSyp: 12000,
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      '"الاسم","الوحدة","الرصيد","حد التنبيه","سعر الوحدة (ل.س)"',
    );
    expect(lines[1]).toBe('"أقنعة N95","علبة","2","5","12000"');
  });
  it("الاقتباس الداخلي مضاعف والسعر الفارغ خلية فارغة", () => {
    const csv = materialsToCsv([
      {
        name: 'مادة "خاصة"',
        unit: "عبوة",
        quantityOnHand: 1,
        minQuantity: 2,
        costSyp: null,
      },
    ]);
    expect(csv).toContain('"مادة ""خاصة"""');
    expect(csv.endsWith(',""'));
  });
});
