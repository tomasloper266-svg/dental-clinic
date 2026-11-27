import { describe, expect, it } from "vitest";

import {
  MONTHLY_PRICE_USD,
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  WARNING_DAYS_LEFT,
  YEARLY_PRICE_USD,
  addDays,
  planPriceUsd,
} from "@/lib/billing/plans";
import {
  deriveSubscriptionState,
  extendedSubscriptionEnd,
  shouldWarnExpiring,
  subscriptionProgress,
} from "@/lib/billing/state";

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

// اشتقاق الحالة من التواريخ حصراً — لا عمود حالة يُنسى تحديثه
describe("deriveSubscriptionState", () => {
  it("تجربة بها 5 أيام → ACTIVE", () => {
    const state = deriveSubscriptionState(
      { trialEndsAt: daysFromNow(5), subscriptionEndsAt: null },
      new Date(),
    );
    expect(state.status).toBe("ACTIVE");
    expect(state.isTrial).toBe(true);
    expect(state.daysLeft).toBe(5);
  });

  it("تجربة تجاوزت 15 يوماً بلا دفع → EXPIRED", () => {
    const state = deriveSubscriptionState(
      { trialEndsAt: daysFromNow(-1), subscriptionEndsAt: null },
      new Date(),
    );
    expect(state.status).toBe("EXPIRED");
  });

  it("اشتراك مدفوع منتهٍ بلا تجربة قائمة → EXPIRED", () => {
    // المواصفة: ACTIVE إذا now ≤ max(التجربة، الاشتراك) — عملياً بعد الدفع
    // تكون التجربة في الماضي، فيحسم اشتراك منتهٍ الحالة
    const state = deriveSubscriptionState(
      { trialEndsAt: daysFromNow(-20), subscriptionEndsAt: daysFromNow(-1) },
      new Date(),
    );
    expect(state.status).toBe("EXPIRED");
  });

  it("اللحظة الفاصلة نفسها → ACTIVE (حد شمول now ≤ النهاية)", () => {
    const ends = new Date();
    const state = deriveSubscriptionState(
      { trialEndsAt: ends, subscriptionEndsAt: null },
      ends,
    );
    expect(state.status).toBe("ACTIVE");
  });

  it("اشتراك أطول من التجربة يحسم الانتهاء ولا يعد تجربة", () => {
    const state = deriveSubscriptionState(
      { trialEndsAt: daysFromNow(2), subscriptionEndsAt: daysFromNow(60) },
      new Date(),
    );
    expect(state.status).toBe("ACTIVE");
    expect(state.isTrial).toBe(false);
    expect(state.daysLeft).toBe(60);
  });
});

// البانر عند ≤ 5 أيام فقط — معيار التحقق 7
describe("shouldWarnExpiring", () => {
  const active = (daysLeft: number) =>
    deriveSubscriptionState(
      { trialEndsAt: daysFromNow(daysLeft), subscriptionEndsAt: null },
      new Date(),
    );

  it("يظهر عند 5 أيام بالضبط", () => {
    expect(shouldWarnExpiring(active(WARNING_DAYS_LEFT))).toBe(true);
  });

  it("يظهر عند أقل من 5 أيام وفي يوم الانتهاء", () => {
    expect(shouldWarnExpiring(active(2))).toBe(true);
    expect(shouldWarnExpiring(active(0))).toBe(true);
  });

  it("لا يظهر بعيداً عن الانتهاء ولا بعده", () => {
    expect(shouldWarnExpiring(active(6))).toBe(false);
    expect(shouldWarnExpiring(active(-1))).toBe(false);
  });
});

// التمديد التراكمي — الدفع قبل الانتهاء يُمدد من نهايته لا من اليوم
describe("extendedSubscriptionEnd", () => {
  it("شهري بلا اشتراك قائم → +30 يوماً من اليوم", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const end = extendedSubscriptionEnd(null, "MONTHLY", now);
    expect(end.getTime()).toBe(addDays(now, 30).getTime());
  });

  it("سنوي بلا اشتراك قائم → +365 يوماً من اليوم", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const end = extendedSubscriptionEnd(null, "YEARLY", now);
    expect(end.getTime()).toBe(addDays(now, 365).getTime());
  });

  it("دفع قبل انتهاء اشتراك قائم → تمديد من نهايته", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const currentEnd = new Date("2026-12-01T10:00:00Z");
    const end = extendedSubscriptionEnd(currentEnd, "MONTHLY", now);
    expect(end.getTime()).toBe(addDays(currentEnd, 30).getTime());
  });

  it("دفع بعد انتهاء الاشتراك → تمديد من اليوم لا من النهاية الغابرة", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const pastEnd = new Date("2026-11-01T10:00:00Z");
    const end = extendedSubscriptionEnd(pastEnd, "YEARLY", now);
    expect(end.getTime()).toBe(addDays(now, 365).getTime());
  });

  it("التفعيل اليدوي بعدة دورات → مضاعفة المدة بنفس القاعدة التراكمية", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    expect(extendedSubscriptionEnd(null, "MONTHLY", now, 3).getTime()).toBe(
      addDays(now, 90).getTime(),
    );
    expect(extendedSubscriptionEnd(null, "YEARLY", now, 2).getTime()).toBe(
      addDays(now, 730).getTime(),
    );
  });

  it("التفعيل اليدوي بجلسة واحدة = التمديد الفردي (الافتراضي count=1)", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    const currentEnd = new Date("2026-12-01T10:00:00Z");
    expect(
      extendedSubscriptionEnd(currentEnd, "MONTHLY", now, 1).getTime(),
    ).toBe(extendedSubscriptionEnd(currentEnd, "MONTHLY", now).getTime());
  });
});

// شريط التقدم — تجربة 15 يوماً أو فترة الباقة المدفوعة
describe("subscriptionProgress", () => {
  it("تجربة متبقية 9 أيام → 6 أيام مستهلكة من 15 (40%)", () => {
    const progress = subscriptionProgress({ daysLeft: 9, isTrial: true });
    expect(progress.totalDays).toBe(15);
    expect(progress.elapsedDays).toBe(6);
    expect(progress.pct).toBe(40);
  });

  it("باقة مدفوعة — الطول من مدة الباقة لا من التجربة", () => {
    const progress = subscriptionProgress(
      { daysLeft: 335, isTrial: false },
      365,
    );
    expect(progress.totalDays).toBe(365);
    expect(progress.elapsedDays).toBe(30);
    expect(progress.pct).toBe(8);
  });

  it("بلا مدة باقة معروفة → يجثم على نافذة التجربة", () => {
    const progress = subscriptionProgress({ daysLeft: 5, isTrial: false });
    expect(progress.totalDays).toBe(15);
    expect(progress.elapsedDays).toBe(10);
  });

  it("يقيد المستهلك بين صفر والطول — أيام سالبة أو متجاوزة لا تكسر النسبة", () => {
    expect(
      subscriptionProgress({ daysLeft: -3, isTrial: true }).elapsedDays,
    ).toBe(15);
    expect(subscriptionProgress({ daysLeft: -3, isTrial: true }).pct).toBe(100);
    expect(
      subscriptionProgress({ daysLeft: 40, isTrial: true }).elapsedDays,
    ).toBe(0);
    expect(subscriptionProgress({ daysLeft: 40, isTrial: true }).pct).toBe(0);
  });
});

// الثوابت — قرارات مقفلة في المواصفة
describe("plans", () => {
  it("الأسعار 15$ شهرياً و120$ سنوياً والتجربة 15 يوماً", () => {
    expect(MONTHLY_PRICE_USD).toBe(15);
    expect(YEARLY_PRICE_USD).toBe(120);
    expect(TRIAL_DAYS).toBe(15);
    expect(planPriceUsd("MONTHLY")).toBe(15);
    expect(planPriceUsd("YEARLY")).toBe(120);
    expect(SUBSCRIPTION_PLANS.MONTHLY.durationDays).toBe(30);
    expect(SUBSCRIPTION_PLANS.YEARLY.durationDays).toBe(365);
  });
});
