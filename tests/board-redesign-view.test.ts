import { describe, expect, it } from "vitest";
import { groupByStartHour } from "@/lib/calendar-view";
import { filterWaitlistEntries } from "@/lib/waitlist-view";
import type { WaitlistStatus } from "@/lib/services/waitlist";

// اختبارات مساعدات العرض المضافة مع إعادة التصميم على شكل المرجع:
// شبكة الفتحات الزمنية (تجميع المواعيد حسب ساعة البداية) وتصفية قائمة الانتظار.

describe("groupByStartHour", () => {
  type Item = { id: string; startsAt: string };

  it("يجمع الموعد في صف ساعة بدايته", () => {
    const items: Item[] = [{ id: "a", startsAt: "2026-11-13T09:30:00Z" }];
    const byHour = groupByStartHour(items);
    expect(byHour.get(9)).toEqual(items);
    expect(byHour.has(10)).toBe(false);
  });

  it("يوزّع المواعيد على ساعاتها الصحيحة ويحفظ الترتيب", () => {
    const items: Item[] = [
      { id: "a", startsAt: "2026-11-13T10:00:00Z" },
      { id: "b", startsAt: "2026-11-13T09:00:00Z" },
      { id: "c", startsAt: "2026-11-13T10:20:00Z" },
    ];
    const byHour = groupByStartHour(items);
    expect(byHour.get(9)?.map((i) => i.id)).toEqual(["b"]);
    expect(byHour.get(10)?.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("يعيد قائمة فارغة لقائمة مواعيد فارغة", () => {
    expect(groupByStartHour([]).size).toBe(0);
  });
});

describe("filterWaitlistEntries", () => {
  type Entry = {
    id: string;
    patientName: string;
    note: string | null;
    status: WaitlistStatus;
  };

  const entries: Entry[] = [
    {
      id: "1",
      patientName: "أحمد المهدي",
      note: "يفضّل المساء",
      status: "WAITING",
    },
    { id: "2", patientName: "سارة عبود", note: null, status: "BOOKED" },
    {
      id: "3",
      patientName: "ليلى حمود",
      note: "متابعة تقويم",
      status: "WAITING",
    },
  ];

  it("يعرض الجميع مع all وبلا نص بحث", () => {
    expect(filterWaitlistEntries(entries, "", "all")).toHaveLength(3);
  });

  it("يصفي بالحالة", () => {
    const waiting = filterWaitlistEntries(entries, "", "WAITING");
    expect(waiting.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("يبحث في الاسم", () => {
    const found = filterWaitlistEntries(entries, "سارة", "all");
    expect(found.map((e) => e.id)).toEqual(["2"]);
  });

  it("يبحث في الملاحظة", () => {
    const found = filterWaitlistEntries(entries, "تقويم", "WAITING");
    expect(found.map((e) => e.id)).toEqual(["3"]);
  });

  it("يدمج البحث مع التصفية — نص موجود بحالة أخرى يعطي لا نتائج", () => {
    expect(filterWaitlistEntries(entries, "سارة", "WAITING")).toHaveLength(0);
  });

  it("يتجاهل الفراغات في نص البحث", () => {
    expect(filterWaitlistEntries(entries, "   ", "all")).toHaveLength(3);
  });
});
