import { describe, expect, it } from "vitest";
import type { AppointmentDto } from "@/lib/services/appointments";
import {
  appointmentsWithin,
  countDistinctPatients,
  greetingForDate,
  selectUpcomingAppointments,
} from "@/lib/dashboard-view";

// اختبارات مساعدات عرض لوحة الطبيب — نقية بالكامل.

function appt(
  id: string,
  patientId: string,
  startsAt: Date,
  status: AppointmentDto["status"] = "SCHEDULED",
): AppointmentDto {
  return {
    id,
    patientId,
    patientName: `مريض ${id}`,
    startsAt,
    durationMin: 30,
    status,
    reason: null,
    note: null,
    staffId: null,
    staffName: null,
  };
}

describe("countDistinctPatients", () => {
  it("يحسب المرضى الفريدين لا المواعيد", () => {
    const t = new Date("2026-11-12T10:00:00Z");
    const list = [
      appt("a1", "p1", t),
      appt("a2", "p1", t),
      appt("a3", "p2", t),
    ];
    expect(countDistinctPatients(list)).toBe(2);
  });

  it("يرجع صفراً لقائمة فارغة", () => {
    expect(countDistinctPatients([])).toBe(0);
  });
});

describe("appointmentsWithin", () => {
  const day = new Date("2026-11-12T00:00:00Z");

  it("يشمل الحدود ويستثني الطرف العلوي ويرتب تصاعدياً", () => {
    const noon = new Date("2026-11-12T12:00:00Z");
    const ten = new Date("2026-11-12T10:00:00Z");
    const nextDay = new Date("2026-11-13T00:00:00Z");
    const list = [
      appt("late", "p1", noon),
      appt("early", "p2", ten),
      appt("out", "p3", nextDay),
    ];
    const result = appointmentsWithin(list, day, nextDay);
    expect(result.map((a) => a.id)).toEqual(["early", "late"]);
  });
});

describe("selectUpcomingAppointments", () => {
  it("يستبعد الملغي والمكتمل ولم-يحضر ويرتب بالوقت مع حد أقصى", () => {
    const t1 = new Date("2026-11-12T09:00:00Z");
    const t2 = new Date("2026-11-12T11:00:00Z");
    const t3 = new Date("2026-11-12T13:00:00Z");
    const list = [
      appt("done", "p1", t1, "COMPLETED"),
      appt("second", "p2", t2, "CONFIRMED"),
      appt("cancelled", "p3", t3, "CANCELLED"),
      appt("first", "p4", t1, "SCHEDULED"),
    ];
    const result = selectUpcomingAppointments(list, 5);
    expect(result.map((a) => a.id)).toEqual(["first", "second"]);
  });

  it("يحترم حد العرض", () => {
    const t = new Date("2026-11-12T09:00:00Z");
    const list = [appt("a", "p1", t), appt("b", "p2", t)];
    expect(selectUpcomingAppointments(list, 1).map((a) => a.id)).toEqual(["a"]);
  });
});

describe("greetingForDate", () => {
  // التواريخ تُبنى بالمتكلّم المحلي حتى يختبر التوقيت لا المنطقة الزمنية.
  it("يحيي بالصباح قبل الظهر", () => {
    expect(greetingForDate(new Date(2026, 10, 12, 5, 0, 0))).toBe("صباح الخير");
    expect(greetingForDate(new Date(2026, 10, 12, 11, 59, 0))).toBe(
      "صباح الخير",
    );
  });

  it("يحيي بالمساء من الظهر فصاعداً", () => {
    expect(greetingForDate(new Date(2026, 10, 12, 12, 0, 0))).toBe(
      "مساء الخير",
    );
    expect(greetingForDate(new Date(2026, 10, 12, 23, 0, 0))).toBe(
      "مساء الخير",
    );
  });
});
