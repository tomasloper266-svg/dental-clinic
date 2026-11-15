import { describe, expect, it } from "vitest";

import {
  currentMonthRevenue,
  dailyRevenueDual,
  monthlyRevenueDual,
} from "@/lib/revenue-views";

// عرضات إيراد لوحة القيادة — التعريفان منفصلان (رسوم صادرة / تحصيل) والتجميع
// بتوقيت العيادة. أرقام تشرين الثاني هنا مصغّرة من أرقام بذرة المقارنة
// (رسوم 305 / تحصيل 550) لتبقى العلاقة بين التعريفين قابلة للتحقق بصرياً.

function row(type: string, amountUsd: number, createdAt: string) {
  return { type, amountUsd, createdAt };
}

describe("monthlyRevenueDual", () => {
  it("آخر 6 أشهر منتهية بشهر النهاية والتعريفان منفصلان لكل شهر", () => {
    const rows = [
      // تشرين الأول 2026: رسوم 3050 وتحصيل 1805
      row("CHARGE", 3050, "2026-10-20T12:00:00Z"),
      row("PAYMENT", -1805, "2026-10-21T12:00:00Z"),
      // تشرين الثاني 2026: رسوم 305 وتحصيل 550
      row("CHARGE", 120, "2026-11-05T12:00:00Z"),
      row("CHARGE", 185, "2026-11-10T12:00:00Z"),
      row("PAYMENT", -550, "2026-11-11T12:00:00Z"),
      // آب — خارج نافذة 6 أشهر المنتهية بتشرين الثاني
      row("CHARGE", 999, "2026-08-02T12:00:00Z"),
    ];
    const points = monthlyRevenueDual(rows, "2026-11-14", 6);
    expect(points).toHaveLength(6);
    expect(points[5]).toEqual({ key: "2026-11", chargesUsd: 305, collectedUsd: 550 });
    expect(points[4]).toEqual({ key: "2026-10", chargesUsd: 3050, collectedUsd: 1805 });
    // الأشهر بلا حركة صفرية لا تُحذف
    expect(points[0]).toEqual({ key: "2026-06", chargesUsd: 0, collectedUsd: 0 });
  });

  it("قيد منتصف الليل المحلي يبقى في شهره بتوقيت العيادة", () => {
    // 2026-10-31T21:00:00Z = منتصف الليل 1 تشرين الثاني بتوقيت دمشق (+03:00)
    const rows = [row("CHARGE", 100, "2026-10-31T21:00:00Z")];
    const points = monthlyRevenueDual(rows, "2026-11-14", 2);
    expect(points[1]).toEqual({ key: "2026-11", chargesUsd: 100, collectedUsd: 0 });
  });
});

describe("dailyRevenueDual", () => {
  it("آخر 7 أيام منتهية بيوم اليوم والتعريفان منفصلان", () => {
    const now = new Date("2026-11-14T15:00:00Z");
    const rows = [
      row("CHARGE", 305, "2026-11-13T10:00:00Z"),
      row("PAYMENT", -200, "2026-11-13T11:00:00Z"),
      row("PAYMENT", -350, "2026-11-13T12:00:00Z"),
      row("CHARGE", 999, "2026-11-01T10:00:00Z"),
    ];
    const points = dailyRevenueDual(rows, now, 7);
    expect(points).toHaveLength(7);
    expect(points[6].key).toBe("2026-11-14");
    expect(points[5]).toEqual({ key: "2026-11-13", chargesUsd: 305, collectedUsd: 550 });
    // الأيام بلا حركة صفرية لا تُحذف
    expect(points[0].chargesUsd).toBe(0);
    expect(points[0].collectedUsd).toBe(0);
  });
});

describe("currentMonthRevenue", () => {
  it("يجمع شهر اليوم الحالي بالتعريفين منفصلين", () => {
    const now = new Date("2026-11-14T15:00:00Z");
    const rows = [
      row("CHARGE", 120, "2026-11-05T12:00:00Z"),
      row("CHARGE", 185, "2026-11-10T12:00:00Z"),
      row("PAYMENT", -550, "2026-11-11T12:00:00Z"),
      // الشهر السابق مستبعد
      row("CHARGE", 3050, "2026-10-20T12:00:00Z"),
      row("PAYMENT", -1805, "2026-10-21T12:00:00Z"),
    ];
    expect(currentMonthRevenue(rows, now)).toEqual({
      chargesUsd: 305,
      collectedUsd: 550,
    });
  });

  it("شهر بلا حركة يعيد أصفاراً", () => {
    const now = new Date("2026-11-14T15:00:00Z");
    expect(currentMonthRevenue([], now)).toEqual({
      chargesUsd: 0,
      collectedUsd: 0,
    });
  });
});
