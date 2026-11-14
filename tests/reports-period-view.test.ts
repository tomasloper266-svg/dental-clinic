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
  type DayRange,
} from "@/lib/reports-period-view";
import { localDayStartUtc } from "@/lib/local-day";

// اختبارات عرض تقرير الفترة — كل الدوال نقية بلا قاعدة بيانات.

describe("حدود الأيام المحلية للنطاقات", () => {
  const DAY = "2026-11-15";
  // 00:30 دمشق يوم 15 = 21:30 يوم 14 بتوقيت UTC
  const AT_0030 = "2026-11-14T21:30:00.000Z";
  // 23:30 دمشق يوم 15 = 20:30 يوم 15 بتوقيت UTC
  const AT_2330 = "2026-11-15T20:30:00.000Z";
  // 00:30 دمشق يوم 16 = 21:30 يوم 15 بتوقيت UTC
  const AT_0030_NEXT = "2026-11-15T21:30:00.000Z";

  /** نفس نافذة الاستعلام في خدمة التقرير: [بداية from، بداية اليوم التالي لـ to) */
  function rangeWindow(range: DayRange): { from: number; to: number } {
    return {
      from: localDayStartUtc(range.from).getTime(),
      to: localDayStartUtc(range.to).getTime() + 24 * 60 * 60 * 1000,
    };
  }

  it("نطاق جاهز (30d): حركة 00:30 وحركة 23:30 من اليوم X تعدّان في اليوم X", () => {
    const range = presetRange("30d", DAY, "2020-01-01");
    const window = rangeWindow(range);
    expect(range.to).toBe(DAY);
    expect(new Date(AT_0030).getTime()).toBeGreaterThanOrEqual(window.from);
    expect(new Date(AT_2330).getTime()).toBeLessThan(window.to);
  });

  it("نطاق مخصص (from=to=اليوم X): حركة 00:30 وحركة 23:30 تعدّان في اليوم X", () => {
    const window = rangeWindow({ from: DAY, to: DAY });
    expect(new Date(AT_0030).getTime()).toBeGreaterThanOrEqual(window.from);
    expect(new Date(AT_2330).getTime()).toBeLessThan(window.to);
  });

  it("حركة 00:30 من اليوم التالي خارجة عن نافذة اليوم X بنوعي النطاق", () => {
    const preset = rangeWindow(presetRange("30d", DAY, "2020-01-01"));
    const custom = rangeWindow({ from: DAY, to: DAY });
    for (const window of [preset, custom]) {
      expect(new Date(AT_0030_NEXT).getTime()).toBeGreaterThanOrEqual(window.to);
    }
  });

  it("حركة 00:30 من اليوم السابق خارجة عن النافذة المخصصة لليوم X", () => {
    const custom = rangeWindow({ from: DAY, to: DAY });
    // 00:30 دمشق يوم 14 = 21:30 يوم 13 بتوقيت UTC
    expect(new Date("2026-11-13T21:30:00.000Z").getTime()).toBeLessThan(custom.from);
  });
});

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

  it("قيد منتصف الليل المحلي (00:30 دمشق من أول الشهر) يقع في شهره المحلي", () => {
    // 00:30 دمشق يوم 1-11 = 21:30 يوم 31-10 بتوقيت UTC
    const months = monthlyRevenue(
      [{ amountSyp: 300, createdAt: "2026-10-31T21:30:00.000Z" }],
      { from: "2026-11-01", to: "2026-11-30" },
    );
    expect(months.map((m) => m.chargesSyp)).toEqual([300]);
  });
});

describe("summarizePeriodLedger", () => {
  it("يجمع الرسوم وعددها وعدد الدفعات وتحصيل الفترة منفصلاً", () => {
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
      totalPaymentsSyp: 500,
      invoiceCount: 2,
      paymentCount: 2,
    });
  });

  it("فترة بلا حركة تعيد أصفاراً للتعريفين", () => {
    expect(summarizePeriodLedger([])).toEqual({
      totalChargesSyp: 0,
      totalPaymentsSyp: 0,
      invoiceCount: 0,
      paymentCount: 0,
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

  it("الطبيب المخزّن على القيد يتقدم على الاستنتاج من المواعيد", () => {
    // موعد p1 الأحدث مسند لس1 لكن القيد مخزّن على س2 — القرار للمخزّن
    const charges = [
      {
        patientId: "p1",
        amountSyp: 400,
        createdAt: "2026-09-10T10:00:00Z",
        doctorId: "s2",
      },
    ];
    const appointments = [
      { patientId: "p1", staffId: "s1", startsAt: "2026-09-01T10:00:00Z" },
    ];
    expect(revenueByDoctor(charges, appointments, staffName)).toEqual([
      { doctor: "د. رنا الحلقي", chargesSyp: 400 },
    ]);
  });

  it("القيد بلا طبيب مخزّن يرجع للاستنتاج احتياطياً", () => {
    const charges = [
      {
        patientId: "p1",
        amountSyp: 400,
        createdAt: "2026-09-10T10:00:00Z",
        doctorId: null,
      },
    ];
    const appointments = [
      { patientId: "p1", staffId: "s1", startsAt: "2026-09-01T10:00:00Z" },
    ];
    expect(revenueByDoctor(charges, appointments, staffName)).toEqual([
      { doctor: "د. سامر درويش", chargesSyp: 400 },
    ]);
  });

  it("الطبيب المخزّن المحذوف من الطاقم يقع تحت بند مستقل دون استنتاج", () => {
    const charges = [
      {
        patientId: "p1",
        amountSyp: 200,
        createdAt: "2026-09-10T10:00:00Z",
        doctorId: "deleted",
      },
    ];
    const appointments = [
      { patientId: "p1", staffId: "s1", startsAt: "2026-09-01T10:00:00Z" },
    ];
    expect(revenueByDoctor(charges, appointments, staffName)).toEqual([
      { doctor: "بدون طبيب محدد", chargesSyp: 200 },
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

  it("يجمع من بنود الفاتورة حسب تصنيفها النصي الحر", () => {
    const procedureByItemId = new Map([["i1", "زراعة"]]);
    const charges = [
      {
        treatmentItemId: null,
        amountSyp: 500,
        items: [
          { category: "تبييض ليزر", amountSyp: 300 },
          { category: "تنظيف جير", amountSyp: 200 },
        ],
      },
      {
        treatmentItemId: "i1",
        amountSyp: 800,
        items: [{ category: "زراعة", amountSyp: 800 }],
      },
    ];
    expect(revenueByProcedure(charges, procedureByItemId)).toEqual([
      { procedure: "زراعة", chargesSyp: 800 },
      { procedure: "تبييض ليزر", chargesSyp: 300 },
      { procedure: "تنظيف جير", chargesSyp: 200 },
    ]);
  });

  it("بنود بلا تصنيف تقع تحت بند مستقل والقيد بلا بنود يرجع لربط الخطة", () => {
    const procedureByItemId = new Map([["i1", "تنظيف"]]);
    const charges = [
      {
        treatmentItemId: null,
        amountSyp: 300,
        items: [
          { category: null, amountSyp: 180 },
          { category: "  ", amountSyp: 120 },
        ],
      },
      { treatmentItemId: "i1", amountSyp: 250, items: [] },
      { treatmentItemId: null, amountSyp: 90 },
    ];
    expect(revenueByProcedure(charges, procedureByItemId)).toEqual([
      { procedure: "بدون تصنيف", chargesSyp: 390 },
      { procedure: "تنظيف", chargesSyp: 250 },
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
      totalPaymentsSyp: 66_975_000,
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
