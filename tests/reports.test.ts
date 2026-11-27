import { describe, expect, it } from "vitest";
import { dayRange, monthRange, summarizePeriod } from "@/lib/services/reports";

// اختبارات وحدة تجميع التقرير — نقية بلا قاعدة بيانات.

describe("تجميع الفترة", () => {
  it("التحصيل مجموع الدفعات بقيمة مطلقة والصافي مطروحاً منه المصاريف", () => {
    const summary = summarizePeriod(
      [
        { type: "CHARGE", amountUsd: 500_000 },
        { type: "PAYMENT", amountUsd: -200_000 },
        { type: "PAYMENT", amountUsd: -175_000 },
        { type: "ADJUSTMENT", amountUsd: -50_000 },
      ],
      [{ amountUsd: 100_000 }, { amountUsd: 25_000 }],
    );
    expect(summary.collectedUsd).toBe(375_000);
    expect(summary.expensesUsd).toBe(125_000);
    expect(summary.netUsd).toBe(250_000);
  });

  it("الاسترداد يطرح من المقبوضات ولا يُعد تحصيلاً", () => {
    const summary = summarizePeriod(
      [
        { type: "PAYMENT", amountUsd: -300_000 },
        { type: "REFUND", amountUsd: 100_000 },
      ],
      [],
    );
    expect(summary.collectedUsd).toBe(300_000);
    expect(summary.refundsUsd).toBe(100_000);
    expect(summary.netUsd).toBe(200_000);
  });

  it("فترة بلا حركة تعطي أصفاراً", () => {
    const summary = summarizePeriod([], []);
    expect(summary.collectedUsd).toBe(0);
    expect(summary.expensesUsd).toBe(0);
    expect(summary.netUsd).toBe(0);
  });
});

describe("حدود الفترات", () => {
  it("حدود اليوم تغطي يوماً واحداً بالضبط", () => {
    const { from, to } = dayRange(new Date("2026-11-12T10:30:00Z"));
    expect(from.toISOString()).toBe("2026-11-12T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-13T00:00:00.000Z");
  });

  it("حدود الشهر تغطي الشهر كاملاً بمن فعله لاحق الشهور", () => {
    const { from, to } = monthRange(2026, 2);
    expect(from.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("حدود نهاية السنة تنتقل لسنة جديدة", () => {
    const { from, to } = monthRange(2026, 12);
    expect(from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
