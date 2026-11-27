import { describe, it, expect } from "vitest";
import {
  appointmentsOverlap,
  parseCreateAppointment,
} from "@/lib/services/appointments";
import { ALLOWED_TRANSITIONS, canTransition } from "@/lib/appointment-state";
import { computeOpenGaps } from "@/lib/services/waitlist";
import { dayRange, weekRange, addDays } from "@/lib/dates";
import type { AppointmentStatus } from "@/lib/services/appointments";

const ALL: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "IN_TREATMENT",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

// يوم اختبار ثابت بحدود UTC — الاثنين 15 يونيو 2026.
const DAY = Date.UTC(2026, 5, 15);
const at = (h: number, m: number) => new Date(DAY + h * 3_600_000 + m * 60_000);

describe("آلة حالات الموعد — قواعد الانتقال", () => {
  it("يقبل الانتقالات المسموحة: محجوز→مؤكد→قيد العلاج→مكتمل", () => {
    expect(canTransition("SCHEDULED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "IN_TREATMENT")).toBe(true);
    expect(canTransition("IN_TREATMENT", "COMPLETED")).toBe(true);
  });

  it("يقبل الإلغاء ولم-يحضر من محجوز أو مؤكد", () => {
    expect(canTransition("SCHEDULED", "CANCELLED")).toBe(true);
    expect(canTransition("SCHEDULED", "NO_SHOW")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "NO_SHOW")).toBe(true);
  });

  it("يرفض قفز المسار: محجوز→قيد العلاج أو مكتمل مباشرة", () => {
    expect(canTransition("SCHEDULED", "IN_TREATMENT")).toBe(false);
    expect(canTransition("SCHEDULED", "COMPLETED")).toBe(false);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(false);
  });

  it("يرفض التراجع أو تغيير الحالات النهائية", () => {
    expect(canTransition("CONFIRMED", "SCHEDULED")).toBe(false);
    expect(canTransition("IN_TREATMENT", "CANCELLED")).toBe(false);
    for (const terminal of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it("المصفوفة شاملة: كل زوج غير مذكور في ALLOWED_TRANSITIONS مرفوض", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(
          ALLOWED_TRANSITIONS[from].includes(to),
        );
      }
    }
  });
});

describe("منع تعارض الفترات — appointmentsOverlap", () => {
  it("مواعيد متطابقة الوقت تتقاطع", () => {
    expect(appointmentsOverlap(at(10, 0), 30, at(10, 0), 30)).toBe(true);
  });

  it("تداخل جزئي يتقاطع", () => {
    expect(appointmentsOverlap(at(10, 0), 30, at(10, 15), 30)).toBe(true);
  });

  it("موعد داخل آخر يتقاطع", () => {
    expect(appointmentsOverlap(at(10, 0), 60, at(10, 20), 10)).toBe(true);
  });

  it("مواعيد متلاصقة (تنتهي فترة مع بداية أخرى) لا تتقاطع", () => {
    expect(appointmentsOverlap(at(10, 0), 30, at(10, 30), 30)).toBe(false);
  });

  it("مواعيد منفصلة تماماً لا تتقاطع", () => {
    expect(appointmentsOverlap(at(9, 0), 30, at(11, 0), 30)).toBe(false);
  });
});

describe("parseCreateAppointment", () => {
  it("يقبل حجزاً صحيحاً", () => {
    const r = parseCreateAppointment({
      patientId: "p1",
      startsAt: "2026-06-15T10:00:00Z",
      durationMin: 30,
      reason: "كشف",
    });
    expect(r.ok).toBe(true);
  });

  it("يقبل حالة ابتدائية صالحة ويرفض غير معروفة", () => {
    const ok = parseCreateAppointment({
      patientId: "p1",
      startsAt: "2026-06-15T10:00:00Z",
      status: "CONFIRMED",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.status).toBe("CONFIRMED");

    expect(
      parseCreateAppointment({
        patientId: "p1",
        startsAt: "2026-06-15T10:00:00Z",
        status: "NOT_A_STATUS",
      }).ok,
    ).toBe(false);
  });

  it("يرفض غياب المريض أو تاريخاً غير صالح", () => {
    expect(
      parseCreateAppointment({ startsAt: "2026-06-15T10:00:00Z" }).ok,
    ).toBe(false);
    expect(
      parseCreateAppointment({ patientId: "p1", startsAt: "غير تاريخ" }).ok,
    ).toBe(false);
  });

  it("يرفض مدة خارج النطاق ويقبل الافتراضي 30", () => {
    expect(
      parseCreateAppointment({
        patientId: "p1",
        startsAt: "2026-06-15T10:00:00Z",
        durationMin: 0,
      }).ok,
    ).toBe(false);
    const r = parseCreateAppointment({
      patientId: "p1",
      startsAt: "2026-06-15T10:00:00Z",
    });
    expect(r.ok && r.value.durationMin).toBe(30);
  });

  it("يتعامل مع جسم غير كائن", () => {
    expect(parseCreateAppointment("نص").ok).toBe(false);
  });

  it("يقبل إسناد طبيب اختيارياً ويتجاهل الفارغ", () => {
    const withStaff = parseCreateAppointment({
      patientId: "p1",
      startsAt: "2026-06-15T10:00:00Z",
      staffId: "  st1  ",
    });
    expect(withStaff.ok && withStaff.value.staffId).toBe("st1");

    const withoutStaff = parseCreateAppointment({
      patientId: "p1",
      startsAt: "2026-06-15T10:00:00Z",
      staffId: "   ",
    });
    expect(withoutStaff.ok && withoutStaff.value.staffId).toBeUndefined();
  });
});

describe("فجوات شاغرة — computeOpenGaps", () => {
  const winStart = at(9, 0);
  const winEnd = at(17, 0);

  it("يوم فارغ يعطي فجوة واحدة بكامل النافذة", () => {
    const gaps = computeOpenGaps(winStart, winEnd, []);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].durationMin).toBe(480);
  });

  it("موعد واحد في المنتصف يعطي فجوتين قبله وبعده", () => {
    const gaps = computeOpenGaps(winStart, winEnd, [
      { startsAt: at(10, 0), durationMin: 60 },
    ]);
    expect(gaps.map((g) => g.durationMin)).toEqual([60, 360]);
    expect(gaps[0].end).toEqual(at(10, 0));
  });

  it("الفترات المشغولة المتداخلة تُدمج فلا تظهر فجوات بينها", () => {
    const gaps = computeOpenGaps(winStart, winEnd, [
      { startsAt: at(10, 0), durationMin: 60 },
      { startsAt: at(11, 0), durationMin: 30 },
      { startsAt: at(10, 30), durationMin: 45 },
    ]);
    expect(gaps.map((g) => g.durationMin)).toEqual([60, 330]);
  });

  it("فترة تمتد خارج نافذة العمل تُقتطع عند الحدود", () => {
    const gaps = computeOpenGaps(winStart, winEnd, [
      { startsAt: at(8, 0), durationMin: 120 }, // مشغول حتى 10:00 — يبقى 7 ساعات
    ]);
    expect(gaps.map((g) => g.durationMin)).toEqual([420]);
  });

  it("فجوة أقصر من 5 دقائق تُهمل", () => {
    const gaps = computeOpenGaps(winStart, winEnd, [
      { startsAt: at(9, 0), durationMin: 57 }, // حتى 9:57 — يترك 3 دقائق
      { startsAt: at(10, 0), durationMin: 3 }, // حتى 10:03
    ]);
    expect(gaps.map((g) => g.durationMin)).toEqual([417]);
  });
});

describe("حدود الأيام والأسابيع", () => {
  it("dayRange يعيد بداية اليوم نفسه ونهايته", () => {
    const [from, to] = dayRange(at(10, 30));
    expect(from).toEqual(at(0, 0));
    expect(to).toEqual(at(24, 0));
  });

  it("الأسبوع يبدأ السبت وينتهي بعد 7 أيام", () => {
    // 15 يونيو 2026 اثنين — السبت 13 يونيو.
    const [from, to] = weekRange(at(10, 0));
    expect(from).toEqual(new Date(Date.UTC(2026, 5, 13)));
    expect(to).toEqual(new Date(Date.UTC(2026, 5, 20)));
  });

  it("addDays يعبر حدود الشهر والأسبوع", () => {
    expect(addDays(at(0, 0), 7)).toEqual(new Date(Date.UTC(2026, 5, 22)));
    expect(addDays(at(0, 0), -1)).toEqual(new Date(Date.UTC(2026, 5, 14)));
  });
});
