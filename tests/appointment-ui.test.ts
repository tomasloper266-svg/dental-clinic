import { describe, expect, it } from "vitest";
import { timeRangeLabel } from "@/lib/appointment-ui";

// نطاق وقت الموعد — من بدايته ومدته، بصيغة «10:30 – 11:00» كما في المرجع.
describe("timeRangeLabel", () => {
  it("يجمع البداية والنهاية المحسوبة من المدة", () => {
    expect(timeRangeLabel("2026-06-13T10:30:00Z", 30)).toBe("10:30 – 11:00");
  });

  it("يعبر عن مدة تتجاوز الساعة", () => {
    expect(timeRangeLabel("2026-06-13T09:00:00Z", 90)).toBe("09:00 – 10:30");
  });
});
