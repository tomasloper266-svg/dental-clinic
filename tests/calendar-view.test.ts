import { describe, expect, it } from "vitest";
import {
  addMonths,
  minutesFromMidnightUtc,
  monthGrid,
  monthLabel,
  timeGridWindow,
  weekDays,
  weekRangeLabel,
  hourToTimeInput,
} from "@/lib/calendar-view";

// يوم اختبار ثابت — السبت 13 يونيو 2026 (أول أسبوع يبدأ بالسبت).
const SAT = "2026-06-13";

describe("مساعدات التقويم — أيام الأسبوع", () => {
  it("يبدأ الأسبوع بالسبت وينتهي بالجمعة", () => {
    const days = weekDays(SAT);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe(SAT);
    expect(days[6]).toBe("2026-06-19");
  });

  it("يُرجع الأسبوع الصحيح لتاريخ في وسط الأسبوع", () => {
    const days = weekDays("2026-06-16"); // ثلاثاء
    expect(days[0]).toBe(SAT);
    expect(days[6]).toBe("2026-06-19");
  });
});

describe("مساعدات التقويم — شبكة الشهر", () => {
  it("تغطي كل أيام الشهر بصفوف من السبت إلى الجمعة", () => {
    const weeks = monthGrid("2026-06-15");
    const all = weeks.flat();
    expect(all.filter((c) => c.inMonth).map((c) => c.date)).toEqual(
      Array.from({ length: 30 }, (_, i) => {
        const day = i + 1;
        return `2026-06-${String(day).padStart(2, "0")}`;
      }),
    );
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it("تميّز أيام الشهور المجاورة خارج الشهر", () => {
    const weeks = monthGrid("2026-06-15");
    const firstWeek = weeks[0];
    expect(firstWeek[0].date).toBe("2026-05-30");
    expect(firstWeek[0].inMonth).toBe(false);
    expect(firstWeek[6].inMonth).toBe(true); // 5 يونيو
  });

  it("يتعامل مع شهر يبدأ بالسبت دون أسابيع فارغة", () => {
    const weeks = monthGrid("2026-02-15"); // فبراير 2026 يبدأ بالأحد
    const inMonth = weeks.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(28);
  });
});

describe("مساعدات التقويم — التنقل بين الأشهر", () => {
  it("ينتقل عبر حدود السنة", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2027-01-05", -1)).toBe("2026-12-01");
  });
});

describe("مساعدات التقويم — نافذة الشبكة الزمنية", () => {
  it("تُرجع النافذة الافتراضية لجدول فارغ", () => {
    expect(timeGridWindow([])).toEqual({ startMin: 300, endMin: 1080 });
  });

  it("تتسع لموعد قبل النافذة وبعدها", () => {
    const window = timeGridWindow([
      { startsAt: "2026-06-15T03:30:00Z", durationMin: 45 },
      { startsAt: "2026-06-15T19:00:00Z", durationMin: 30 },
    ]);
    expect(window).toEqual({ startMin: 180, endMin: 1200 });
  });

  it("يحسب الدقائق من منتصف الليل UTC", () => {
    expect(minutesFromMidnightUtc("2026-06-15T09:20:00Z")).toBe(560);
  });

  it("يُنسّق قيمة حقل الوقت بحدّين", () => {
    expect(hourToTimeInput(7)).toBe("07:00");
    expect(hourToTimeInput(13)).toBe("13:00");
  });
});

describe("مساعدات التقويم — التسميات العربية", () => {
  it("تسمية الشهر بالعربية بأرقام لاتينية", () => {
    // ar-SY يستخدم أسماء الأشهر الشامية (حزيران = يونيو)
    expect(monthLabel("2026-06-15")).toContain("حزيران");
    expect(monthLabel("2026-06-15")).toContain("2026");
  });

  it("تسمية نطاق الأسبوع من أول يوم إلى آخره", () => {
    const label = weekRangeLabel(weekDays(SAT));
    expect(label).toContain("13");
    expect(label).toContain("19");
  });
});
