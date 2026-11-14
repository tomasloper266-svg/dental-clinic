import { describe, expect, it } from "vitest";
import {
  CLINIC_TIME_ZONE,
  localDayOf,
  localDayStartUtc,
  localDayWindow,
  localMonthKeyOf,
} from "@/lib/local-day";

// اختبارات حدود اليوم بتوقيت العيادة (دمشق) — نقية بلا قاعدة بيانات.
// دمشق حالياً +03:00 على مدار السنة، فالساعة 00:30 من اليوم الخامس عشر
// هي 21:30 من اليوم الرابع عشر بتوقيت UTC — هذه هي الحالة التي انحرف عنها
// الحساب القديم.

const CHARGE_AT_0030_LOCAL = "2026-11-14T21:30:00.000Z"; // 00:30 دمشق يوم 15
const CHARGE_AT_2330_LOCAL = "2026-11-15T20:30:00.000Z"; // 23:30 دمشق يوم 15

describe("localDayOf", () => {
  it("حركة 00:30 بتوقيت دمشق تقع في يومها المحلي لا يوم UTC السابق", () => {
    expect(localDayOf(CHARGE_AT_0030_LOCAL)).toBe("2026-11-15");
  });

  it("حركة 23:30 بتوقيت دمشق تقع في يومها المحلي", () => {
    expect(localDayOf(CHARGE_AT_2330_LOCAL)).toBe("2026-11-15");
  });

  it("حركة منتصف النهار تعطي نفس يوم UTC", () => {
    expect(localDayOf("2026-11-15T12:00:00.000Z")).toBe("2026-11-15");
  });

  it("يقبل Date كما يقبل النص", () => {
    expect(localDayOf(new Date(CHARGE_AT_0030_LOCAL))).toBe("2026-11-15");
  });
});

describe("localDayStartUtc", () => {
  it("بداية يوم دمشق = 21:00 من اليوم السابق بتوقيت UTC", () => {
    expect(localDayStartUtc("2026-11-15").toISOString()).toBe(
      "2026-11-14T21:00:00.000Z",
    );
  });

  it("المحتوى الدائري يعيد نفس اليوم المحلي", () => {
    expect(localDayOf(localDayStartUtc("2026-11-15"))).toBe("2026-11-15");
  });
});

describe("localDayWindow", () => {
  it("نافذة اليوم تغطي حركة 00:30 و23:30 من ذلك اليوم المحلي", () => {
    const [from, to] = localDayWindow("2026-11-15");
    expect(from.toISOString()).toBe("2026-11-14T21:00:00.000Z");
    expect(new Date(CHARGE_AT_0030_LOCAL).getTime()).toBeGreaterThanOrEqual(
      from.getTime(),
    );
    expect(new Date(CHARGE_AT_2330_LOCAL).getTime()).toBeLessThan(to.getTime());
  });

  it("حركة 00:30 من اليوم التالي خارجة عن النافذة", () => {
    const [, to] = localDayWindow("2026-11-15");
    expect(new Date("2026-11-15T21:30:00.000Z").getTime()).toBeGreaterThanOrEqual(
      to.getTime(),
    );
  });
});

describe("localMonthKeyOf", () => {
  it("حركة 00:30 من أول الشهر المحلي تقع في شهرها لا الشهر UTC السابق", () => {
    // 00:30 دمشق يوم 1 نيسان = 21:30 يوم 31 آذار بتوقيت UTC
    expect(localMonthKeyOf("2026-04-01T21:30:00.000Z")).toBe("2026-04");
  });
});

describe("CLINIC_TIME_ZONE", () => {
  it("المنطقة المرجعية دمشق", () => {
    expect(CLINIC_TIME_ZONE).toBe("Asia/Damascus");
  });
});
