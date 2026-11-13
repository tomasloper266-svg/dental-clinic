import { describe, expect, it } from "vitest";

import { reminderCounters } from "@/lib/reminders/counters";

// اختبارات نقية — عدّادات لوحة التذكير (جاهز/أُرسل/متبقي) بلا قاعدة بيانات.

describe("reminderCounters — عدّادات لوحة التذكير", () => {
  it("قائمة فارغة تعطي أصفاراً", () => {
    expect(reminderCounters([])).toEqual({
      ready: 0,
      sent: 0,
      remaining: 0,
    });
  });

  it("يعدّ المُرسل ويطرحه من المتبقي", () => {
    const counters = reminderCounters([
      { sent: true },
      { sent: true },
      { sent: false },
    ]);
    expect(counters.ready).toBe(3);
    expect(counters.sent).toBe(2);
    expect(counters.remaining).toBe(1);
  });

  it("كل شيء أُرسل — المتبقي صفر", () => {
    const counters = reminderCounters([{ sent: true }, { sent: true }]);
    expect(counters).toEqual({ ready: 2, sent: 2, remaining: 0 });
  });

  it("لا شيء أُرسل — المتبقي يساوي الجاهز", () => {
    const counters = reminderCounters([
      { sent: false },
      { sent: false },
      { sent: false },
    ]);
    expect(counters).toEqual({ ready: 3, sent: 0, remaining: 3 });
  });
});
