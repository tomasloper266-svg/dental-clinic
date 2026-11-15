import { describe, it, expect } from "vitest";
import {
  planBoardColumns,
  chartToothHref,
} from "@/lib/treatment-plan-view";
import type { PlanItemDto } from "@/lib/services/treatment-plan";

function item(overrides: Partial<PlanItemDto>): PlanItemDto {
  return {
    id: "i1",
    toothFdi: 16,
    procedure: "حشو",
    priceUsd: 50000,
    status: "PROPOSED",
    priority: 0,
    ...overrides,
  };
}

describe("planBoardColumns", () => {
  it("يوزع البنود على الأعمدة الثلاثة بحسب الحالة", () => {
    const items = [
      item({ id: "1", status: "PROPOSED" }),
      item({ id: "2", status: "ACCEPTED" }),
      item({ id: "3", status: "DONE" }),
    ];
    const columns = planBoardColumns(items);
    expect(columns.PROPOSED.map((it) => it.id)).toEqual(["1"]);
    expect(columns.ACCEPTED.map((it) => it.id)).toEqual(["2"]);
    expect(columns.DONE.map((it) => it.id)).toEqual(["3"]);
  });

  it("يرتب بنود كل عمود حسب السن ثم الأولوية", () => {
    const items = [
      item({ id: "a", toothFdi: 26, status: "PROPOSED", priority: 1 }),
      item({ id: "b", toothFdi: 16, status: "PROPOSED", priority: 0 }),
      item({ id: "c", toothFdi: 26, status: "PROPOSED", priority: 5 }),
      item({ id: "d", toothFdi: 36, status: "DONE", priority: 0 }),
    ];
    const columns = planBoardColumns(items);
    expect(columns.PROPOSED.map((it) => it.id)).toEqual(["b", "c", "a"]);
    expect(columns.ACCEPTED).toEqual([]);
    expect(columns.DONE.map((it) => it.id)).toEqual(["d"]);
  });

  it("لا يعدّل القائمة الأصلية (نسخة نقية)", () => {
    const items = [item({ id: "1", toothFdi: 46 })];
    planBoardColumns(items);
    expect(items.map((it) => it.id)).toEqual(["1"]);
  });

  it("قائمة فارغة تعطي ثلاثة أعمدة فارغة", () => {
    const columns = planBoardColumns([]);
    expect(columns.PROPOSED).toEqual([]);
    expect(columns.ACCEPTED).toEqual([]);
    expect(columns.DONE).toEqual([]);
  });
});

describe("chartToothHref", () => {
  it("يبني رابط المخطط مع المريض والسن", () => {
    expect(chartToothHref("pat_1", 26)).toBe(
      "/chart?patient=pat_1&tooth=26",
    );
  });

  it("يشفّر معرّف المريض في الرابط", () => {
    expect(chartToothHref("pa t", 11)).toBe("/chart?patient=pa%20t&tooth=11");
  });
});
