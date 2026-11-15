import { describe, expect, it } from "vitest";
import {
  latestReadingByTooth,
  pocketScaleLevel,
  POCKET_SCALE_COLORS,
  readingsForTooth,
  summarizePeriodontal,
  type PeriodontalRecordValues,
} from "@/lib/odontogram/periodontal-view";

// اختبارات نقية لدوال عرض الدواعم — بلا قاعدة بيانات ولا سيرفر.
// القاعدة الإلحاقية: العرض يستنتج «آخر قياس» فقط ولا يعدّل السجل.

function reading(
  toothFdi: number,
  values: Partial<PeriodontalRecordValues> = {},
  measuredAt = "2026-01-01T10:00:00Z",
): PeriodontalRecordValues {
  return {
    toothFdi,
    measuredAt,
    ...values,
  };
}

describe("latestReadingByTooth و readingsForTooth", () => {
  it("يعيدان آخر قياس لكل سن وسجل سن واحد بترتيب زمني", () => {
    const readings = [
      reading(36, { pocketDepthMm: 6 }, "2026-01-01T10:00:00Z"),
      reading(36, { pocketDepthMm: 4 }, "2026-02-01T10:00:00Z"),
      reading(46, { pocketDepthMm: 3 }, "2026-01-15T10:00:00Z"),
    ];

    const latest = latestReadingByTooth(readings);
    expect(latest.get(36)?.pocketDepthMm).toBe(4);
    expect(latest.get(46)?.pocketDepthMm).toBe(3);
    expect(latest.size).toBe(2);

    const for36 = readingsForTooth(readings, 36);
    expect(for36).toHaveLength(2);
    expect(for36[0].pocketDepthMm).toBe(6);
    expect(for36[1].pocketDepthMm).toBe(4);
  });
});

describe("pocketScaleLevel — مقياس التلوين", () => {
  it("الأخضر ≤3، الأصفر 4–5، الأحمر ≥6، وبدون قياس بلا لون", () => {
    expect(pocketScaleLevel(null)).toBeNull();
    expect(pocketScaleLevel(undefined)).toBeNull();
    expect(pocketScaleLevel(0)).toBe("ok");
    expect(pocketScaleLevel(3)).toBe("ok");
    expect(pocketScaleLevel(4)).toBe("warn");
    expect(pocketScaleLevel(5)).toBe("warn");
    expect(pocketScaleLevel(6)).toBe("alert");
    expect(pocketScaleLevel(15)).toBe("alert");
  });

  it("كل درجة من المقياس لها لون معرف", () => {
    for (const level of ["ok", "warn", "alert"] as const) {
      expect(POCKET_SCALE_COLORS[level]).toMatch(/^var\(--color-periodontal-/);
    }
  });
});

describe("summarizePeriodontal — ملخص صفحة المريض", () => {
  it("سجل فارغ يعيد أصفاراً بلا تاريخ", () => {
    expect(summarizePeriodontal([])).toEqual({
      readingCount: 0,
      teethExamined: 0,
      teethWithPocket5Plus: 0,
      bleedingSites: 0,
      teethWithMobility2Plus: 0,
      lastMeasuredAt: null,
    });
  });

  it("يعدّ من آخر قياس لكل سن — القياس القديم لا يرفع العدّ", () => {
    // السن 36: كان بجيب 6مم ثم عولج إلى 3مم — لا يُعد في الجيوب العميقة.
    const readings = [
      reading(36, { pocketDepthMm: 6 }, "2026-01-01T10:00:00Z"),
      reading(36, { pocketDepthMm: 3 }, "2026-03-01T10:00:00Z"),
      // السن 46: جيب 5مم في آخر قياس — يدخل العدّ (الحد الشامل).
      reading(46, { pocketDepthMm: 5 }, "2026-03-02T10:00:00Z"),
      // السن 47: جيب 4مم — لا يدخل.
      reading(47, { pocketDepthMm: 4 }, "2026-03-02T10:00:00Z"),
    ];

    const summary = summarizePeriodontal(readings);
    expect(summary.readingCount).toBe(4);
    expect(summary.teethExamined).toBe(3);
    expect(summary.teethWithPocket5Plus).toBe(1);
    expect(summary.bleedingSites).toBe(0);
    expect(summary.teethWithMobility2Plus).toBe(0);
    expect(summary.lastMeasuredAt).toBe("2026-03-02T10:00:00Z");
  });

  it("مواضع النزيف والحركية ≥2 تُحسب من آخر قياس فقط", () => {
    const readings = [
      // السن 36: نزيف سابق اختفى في آخر قياس — لا يُعد.
      reading(
        36,
        { bleedingOnProbing: true, mobilityGrade: 2 },
        "2026-01-01T10:00:00Z",
      ),
      reading(
        36,
        { bleedingOnProbing: false, mobilityGrade: 1 },
        "2026-02-01T10:00:00Z",
      ),
      // السن 25: نزيف وحركية 3 في آخر قياسه الوحيد — يُعد.
      reading(
        25,
        { bleedingOnProbing: true, mobilityGrade: 3 },
        "2026-02-05T10:00:00Z",
      ),
      // السن 26: حركية 1 فقط — لا تدخل عدّ الحركية.
      reading(26, { mobilityGrade: 1 }, "2026-02-06T10:00:00Z"),
    ];

    const summary = summarizePeriodontal(readings);
    expect(summary.bleedingSites).toBe(1);
    expect(summary.teethWithMobility2Plus).toBe(1);
    expect(summary.teethExamined).toBe(3);
  });
});
