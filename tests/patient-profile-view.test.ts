import { describe, it, expect } from "vitest";
import {
  planByTooth,
  planTotals,
} from "@/lib/treatment-plan-view";
import { splitAppointments } from "@/lib/patient-profile";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import type { AppointmentDto } from "@/lib/services/appointments";

function item(overrides: Partial<PlanItemDto>): PlanItemDto {
  return {
    id: "i1",
    toothFdi: 16,
    procedure: "حشو",
    priceUsd: 50000,
    status: "PROPOSED",
    priority: 0,
    surface: null,
    ...overrides,
  };
}

describe("planTotals", () => {
  it("يجمع العدادات والمجاميع لكل حالة", () => {
    const items = [
      item({ id: "1", priceUsd: 100, status: "PROPOSED" }),
      item({ id: "2", priceUsd: 200, status: "PROPOSED" }),
      item({ id: "3", priceUsd: 300, status: "ACCEPTED" }),
      item({ id: "4", priceUsd: 400, status: "DONE" }),
    ];
    const totals = planTotals(items);
    expect(totals.byStatus.PROPOSED).toEqual({
      status: "PROPOSED",
      count: 2,
      total: 300,
    });
    expect(totals.byStatus.ACCEPTED).toEqual({
      status: "ACCEPTED",
      count: 1,
      total: 300,
    });
    expect(totals.byStatus.DONE).toEqual({
      status: "DONE",
      count: 1,
      total: 400,
    });
    expect(totals.grandTotal).toBe(1000);
    expect(totals.acceptedTotal).toBe(300);
  });

  it("يعيد أصفاراً لخطة فارغة", () => {
    const totals = planTotals([]);
    expect(totals.grandTotal).toBe(0);
    expect(totals.acceptedTotal).toBe(0);
    expect(totals.byStatus.DONE.count).toBe(0);
  });
});

describe("planByTooth", () => {
  it("يرتب حسب رقم السن ثم الأولوية تنازلياً", () => {
    const sorted = planByTooth([
      item({ id: "a", toothFdi: 26, priority: 5 }),
      item({ id: "b", toothFdi: 16, priority: 1 }),
      item({ id: "c", toothFdi: 16, priority: 9 }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("لا يغيّر المصفوفة الأصلية", () => {
    const list = [item({ id: "a", toothFdi: 26 }), item({ id: "b", toothFdi: 16 })];
    planByTooth(list);
    expect(list.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("splitAppointments", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  function appt(id: string, startsAt: string): AppointmentDto {
    return {
      id,
      patientId: "p1",
      patientName: "أحمد",
      startsAt: new Date(startsAt),
      durationMin: 30,
      status: "SCHEDULED",
      reason: null,
      note: null,
      staffId: null,
      staffName: null,
    };
  }

  it("يفصل القادم تصاعدياً والفائت تنازلياً", () => {
    const list = [
      appt("old1", "2026-11-01T09:00:00Z"),
      appt("future1", "2026-11-20T09:00:00Z"),
      appt("old2", "2026-11-10T09:00:00Z"),
      appt("future2", "2026-11-25T09:00:00Z"),
    ];
    const { upcoming, past } = splitAppointments(list, now);
    expect(upcoming.map((a) => a.id)).toEqual(["future1", "future2"]);
    expect(past.map((a) => a.id)).toEqual(["old2", "old1"]);
  });

  it("يعتبر الموعد اللحظة نفسها قادماً", () => {
    const { upcoming, past } = splitAppointments(
      [appt("now", "2026-11-12T10:00:00Z")],
      now,
    );
    expect(upcoming.map((a) => a.id)).toEqual(["now"]);
    expect(past).toHaveLength(0);
  });
});
