import { describe, expect, it } from "vitest";
import {
  PERIOD_PRESET_OPTIONS,
  appointmentOutcomeCounts,
  buildPeriodCsv,
  monthLabel,
  monthsCovered,
  monthlyRevenue,
  patientGrowthMonthly,
  presetRange,
  revenueByDoctor,
  revenueByProcedure,
  shiftMonthDay,
  summarizePeriodLedger,
  topPatientsByCharges,
} from "@/lib/reports-period-view";

// اختبارات عرض تقرير الفترة — كل الدوال نقية بلا قاعدة بيانات.

describe("shiftMonthDay", () => {
  it("يزيح الأشهر مع ثبات اليوم", () => {
    expect(shiftMonthDay("2026-11-14", -3)).toBe("2026-08-14");
    expect(shiftMonthDay("2026-11-14", -6)).toBe("2026-05-14");
  });

  it("يقلم اليوم لآخر الشهر عند الحاجة", () => {
    expect(shiftMonthDay("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftMonthDay("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("يعبر السنة", () => {
    expect(shiftMonthDay("2026-02-10", -12)).toBe("2025-02-10");
  });
});

describe("presetRange", () => {
  it("الكل من أقدم يوم حركة حتى اليوم", () => {
    expect(presetRange("all", "2026-11-14", "2026-08-16")).toEqual({
      from: "2026-08-16",
      to: "2026-11-14",
    });
  });

  it("آخر 30 يوم نافذة منتهية باليوم", () => {
    expect(presetRange("30d", "2026-11-14", "2026-08-16")).toEqual({
      from: "2026-10-16",
      to: "2026-11-14",
    });
  });

  it("آخر 3 و6 أشهر", () => {
    expect(presetRange("3m", "2026-11-14", "x")).toEqual({
      from: "2026-08-14",
      to: "2026-11-14",
    });
    expect(presetRange("6m", "2026-11-14", "x")).toEqual({
      from: "2026-05-14",
      to: "2026-11-14",
    });
  });

  it("السنة كاملة من رأس السنة حتى اليوم", () => {
    expect(presetRange("year", "2026-11-14", "x")).toEqual({
      from: "2026-01-01",
      to: "2026-11-14",
    });
  });
});

describe("monthsCovered", () => {
  it("يغطي أشهر النطاق شاملة طرفيه", () => {
    expect(monthsCovered({ from: "2026-08-16", to: "2026-10-14" })).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("يوم واحد يعيد شهراً واحداً", () => {
    expect(monthsCovered({ from: "2026-08-16", to: "2026-08-16" })).toEqual([
      "2026-08",
    ]);
  });
});

describe("monthlyRevenue", () => {
  it("يوزع الرسوم على أشهر النطاق ويبقي الأشهر بلا حركة", () => {
    const charges = [
      { amountSyp: 400, createdAt: "2026-08-20T10:00:00Z" },
      { amountSyp: 1710, createdAt: "2026-09-02T10:00:00Z" },
      { amountSyp: 705, createdAt: "2026-10-05T10:00:00Z" },
      { amountSyp: 500, createdAt: "2026-10-11T10:00:00Z" },
      // قيد خارج النطاق — الخدمة تُقصّه قبل التجميع فلا يصل إلى هنا
      { amountSyp: 999, createdAt: "2025-01-01T10:00:00Z" },
    ];
    const months = monthlyRevenue(charges, { from: "2026-08-16", to: "2026-10-14" });
    expect(months.map((m) => m.chargesSyp)).toEqual([400, 1710, 1205]);
    expect(months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });
});

describe("summarizePeriodLedger", () => {
  it("يجمع الرسوم وعددها وعدد الدفعات فقط", () => {
    const entries = [
      { type: "CHARGE", amountSyp: 1000 },
      { type: "CHARGE", amountSyp: 500 },
      { type: "PAYMENT", amountSyp: -300 },
      { type: "PAYMENT", amountSyp: -200 },
      { type: "ADJUSTMENT", amountSyp: -50 },
      { type: "REFUND", amountSyp: 25 },
    ];
    expect(summarizePeriodLedger(entries)).toEqual({
      totalChargesSyp: 1500,
      invoiceCount: 2,
      paymentCount: 2,
    });
  });
});

describe("appointmentOutcomeCounts", () => {
  it("بترتيب ثابت والحالات صفرية محذوفة", () => {
    const appointments = [
      { status: "SCHEDULED" },
      { status: "SCHEDULED" },
      { status: "COMPLETED" },
      { status: "NO_SHOW" },
      { status: "CANCELLED" },
    ];
    expect(appointmentOutcomeCounts(appointments)).toEqual([
      { status: "NO_SHOW", count: 1 },
      { status: "SCHEDULED", count: 2 },
      { status: "COMPLETED", count: 1 },
      { status: "CANCELLED", count: 1 },
    ]);
  });

  it("فترة بلا مواعيد تعيد قائمة فارغة", () => {
    expect(appointmentOutcomeCounts([])).toEqual([]);
  });
});

describe("revenueByDoctor", () => {
  const staffName = (staffId: string) =>
    ({ s1: "د. سامر درويش", s2: "د. رنا الحلقي" })[staffId];

  it("ينسب الرسم إلى طبيب أحدث موعد المريض قبله", () => {
    const charges = [
      { patientId: "p1", amountSyp: 200, createdAt: "2026-09-10T10:00:00Z" },
      { patientId: "p1", amountSyp: 100, createdAt: "2026-09-20T10:00:00Z" },
      { patientId: "p2", amountSyp: 300, createdAt: "2026-09-15T10:00:00Z" },
    ];
    const appointments = [
      { patientId: "p1", staffId: "s1", startsAt: "2026-09-01T10:00:00Z" },
      { patientId: "p1", staffId: "s2", startsAt: "2026-09-15T10:00:00Z" },
      // موعد p2 قبل رسمه ليُنسب إليه
      { patientId: "p2", staffId: "s1", startsAt: "2026-09-14T10:00:00Z" },
    ];
    expect(revenueByDoctor(charges, appointments, staffName)).toEqual([
      { doctor: "د. سامر درويش", chargesSyp: 500 },
      { doctor: "د. رنا الحلقي", chargesSyp: 100 },
    ]);
  });

  it("القيود بلا موعد مسند تجتمع تحت بند مستقل", () => {
    const charges = [
      { patientId: "p3", amountSyp: 150, createdAt: "2026-09-10T10:00:00Z" },
    ];
    expect(revenueByDoctor(charges, [], staffName)).toEqual([
      { doctor: "بدون طبيب محدد", chargesSyp: 150 },
    ]);
  });
});

describe("revenueByProcedure", () => {
  it("يجمع حسب إجراء البند والقيود غير المرتبطة تحت بند مستقل", () => {
    const procedureByItemId = new Map([
      ["i1", "زراعة"],
      ["i2", "تنظيف"],
    ]);
    const charges = [
      { treatmentItemId: "i1", amountSyp: 800 },
      { treatmentItemId: "i2", amountSyp: 300 },
      { treatmentItemId: "i2", amountSyp: 250 },
      { treatmentItemId: null, amountSyp: 90 },
    ];
    expect(revenueByProcedure(charges, procedureByItemId)).toEqual([
      { procedure: "زراعة", chargesSyp: 800 },
      { procedure: "تنظيف", chargesSyp: 550 },
      { procedure: "بدون تصنيف", chargesSyp: 90 },
    ]);
  });
});

describe("topPatientsByCharges", () => {
  it("يجمع لكل مريض ويرتب تنازلياً ويقص بالحد", () => {
    const charges = [
      { patientId: "p1", patientName: "يوسف النجار", amountSyp: 1000 },
      { patientId: "p1", patientName: "يوسف النجار", amountSyp: 245 },
      { patientId: "p2", patientName: "ليلى مرعي", amountSyp: 965 },
      { patientId: "p3", patientName: "محمد رياضان", amountSyp: 280 },
    ];
    const top = topPatientsByCharges(charges, 2);
    expect(top).toEqual([
      { patientId: "p1", patientName: "يوسف النجار", chargesSyp: 1245 },
      { patientId: "p2", patientName: "ليلى مرعي", chargesSyp: 965 },
    ]);
  });
});

describe("patientGrowthMonthly", () => {
  it("آخر 12 شهراً منتهية بشهر النهاية بعدّ المرضى الجدد", () => {
    const createdAts = [
      "2026-08-05T10:00:00Z",
      "2026-08-09T10:00:00Z",
      "2026-10-01T10:00:00Z",
      "2024-01-01T10:00:00Z",
    ];
    const growth = patientGrowthMonthly(createdAts, "2026-11-14");
    expect(growth).toHaveLength(12);
    expect(growth[growth.length - 1]).toEqual({ month: "2026-11", count: 0 });
    expect(growth.find((g) => g.month === "2026-08")).toEqual({
      month: "2026-08",
      count: 2,
    });
    expect(growth.find((g) => g.month === "2026-10")).toEqual({
      month: "2026-10",
      count: 1,
    });
  });
});

describe("buildPeriodCsv", () => {
  it("يشمل أقسام التقرير كلها بمبالغ دولار وليرة", () => {
    const summary = {
      from: "2026-08-16",
      to: "2026-11-14",
      totalChargesSyp: 66_975_000,
      invoiceCount: 32,
      paymentCount: 41,
      outstandingSyp: 9_300_000,
      monthlyRevenue: [{ month: "2026-08", chargesSyp: 6_000_000 }],
      appointmentOutcomes: [{ status: "SCHEDULED" as const, count: 15 }],
      revenueByDoctor: [{ doctor: "د. سامر درويش", chargesSyp: 27_300_000 }],
      revenueByProcedure: [{ procedure: "زراعة", chargesSyp: 12_000_000 }],
      topPatients: [
        { patientId: "p1", patientName: "يوسف النجار", chargesSyp: 18_675_000 },
      ],
      patientGrowth: [{ month: "2026-08", count: 2 }],
      rangeStart: "2026-08-16",
    };
    const csv = buildPeriodCsv(summary, 15000);
    expect(csv).toContain('"إجمالي الفواتير","4465","66975000"');
    expect(csv).toContain('"متوسط الفاتورة","139.53",""');
    expect(csv).toContain("الإيرادات الشهرية");
    expect(csv).toContain("نتائج المواعيد");
    expect(csv).toContain("الإيراد حسب الطبيب");
    expect(csv).toContain("الإيراد حسب نوع العلاج");
    expect(csv).toContain("أعلى المرضى (فواتير الفترة)");
    expect(csv).toContain("نمو سجل المرضى (شهرياً)");
  });
});

describe("تسميات", () => {
  it("أسماء الأشهر العربية الشامية", () => {
    expect(monthLabel("2026-08")).toBe("آب");
    expect(monthLabel("2026-10")).toBe("تشرين الأول");
    expect(monthLabel("2026-11")).toBe("تشرين الثاني");
  });

  it("خيارات الفترة بخمسة بنود بالترتيب", () => {
    expect(PERIOD_PRESET_OPTIONS.map((option) => option.label)).toEqual([
      "الكل",
      "آخر 30 يوم",
      "آخر 3 أشهر",
      "آخر 6 أشهر",
      "السنة كاملة",
    ]);
  });
});
