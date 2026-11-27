import { describe, expect, it } from "vitest";
import {
  WAITLIST_STATUS_META,
  stripPercent,
  suggestEntriesForGap,
} from "@/lib/waitlist-view";

// يوم نافذة اختبار — 10 يناير 2026 من 07:00 إلى 14:00 UTC (7 ساعات).
const WINDOW_START = Date.UTC(2026, 0, 10, 7, 0, 0);
const WINDOW_MS = 7 * 60 * 60 * 1000;

describe("بيانات عرض قائمة الانتظار — شريط النهار", () => {
  it("يحسب مواضع نسبية داخل النافذة", () => {
    const mid = new Date(WINDOW_START + WINDOW_MS / 2).toISOString();
    expect(stripPercent(mid, WINDOW_START, WINDOW_MS)).toBeCloseTo(50);
    const start = new Date(WINDOW_START).toISOString();
    expect(stripPercent(start, WINDOW_START, WINDOW_MS)).toBe(0);
    const end = new Date(WINDOW_START + WINDOW_MS).toISOString();
    expect(stripPercent(end, WINDOW_START, WINDOW_MS)).toBe(100);
  });

  it("يقيّد المواضع خارج النافذة بين 0 و100", () => {
    const before = new Date(WINDOW_START - 60_000).toISOString();
    const after = new Date(WINDOW_START + WINDOW_MS + 60_000).toISOString();
    expect(stripPercent(before, WINDOW_START, WINDOW_MS)).toBe(0);
    expect(stripPercent(after, WINDOW_START, WINDOW_MS)).toBe(100);
  });

  it("يُرجع صفراً لنافذة صفرية", () => {
    expect(stripPercent(new Date().toISOString(), WINDOW_START, 0)).toBe(0);
  });
});

describe("بيانات عرض قائمة الانتظار — اقتراح المرضى", () => {
  it("يُرجع المنتظرين فقط مرتبين بالأولوية تنازلياً", () => {
    const suggested = suggestEntriesForGap([
      { status: "BOOKED", priority: 99 },
      { status: "WAITING", priority: 1 },
      { status: "OFFERED", priority: 5 },
      { status: "WAITING", priority: 7 },
    ]);
    expect(suggested.map((e) => e.priority)).toEqual([7, 1]);
  });
});

describe("بيانات عرض قائمة الانتظار — تسميات الحالات", () => {
  it("لكل حالة تسمية عربية ونبرة شارة", () => {
    for (const [status, meta] of Object.entries(WAITLIST_STATUS_META)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect([
        "neutral",
        "success",
        "warning",
        "danger",
        "info",
        "plum",
      ]).toContain(meta.tone);
      expect(WAITLIST_STATUS_META).toHaveProperty(status);
    }
  });
});
