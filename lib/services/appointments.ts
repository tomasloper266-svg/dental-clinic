import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import type { AppointmentStatus } from "@/lib/appointment-state";

// خدمة المواعيد — نفس نمط خدمة المرضى: كل استعلام عبر clinicScope بمعرّف
// العيادة من سياق الجلسة. قاعدة منع التعارض: فترة جديدة تتقاطع مع موعد
// حالته غير «ملغى» وغير «مكتمل» تُرفض (الملغي والمكتمل لا يحجزان الفترة).

const DAY_MIN = 24 * 60;

export type { AppointmentStatus };

export type AppointmentDto = {
  id: string;
  patientId: string;
  patientName: string;
  startsAt: Date;
  durationMin: number;
  status: AppointmentStatus;
  reason: string | null;
  note: string | null;
};

export type CreateAppointmentInput = {
  patientId: string;
  startsAt: Date;
  durationMin: number;
  reason?: string;
  note?: string;
};

export type ServiceError =
  | { ok: false; error: string; code: "CONFLICT" | "NOT_FOUND" | "INVALID" }
  | { ok: true; value: AppointmentDto };

// نقي — يتقاطع موعدان إذا بدأ كلٌّ منهما قبل انتهاء الآخر.
export function appointmentsOverlap(
  aStart: Date,
  aDurationMin: number,
  bStart: Date,
  bDurationMin: number,
): boolean {
  const aEnd = aStart.getTime() + aDurationMin * 60_000;
  const bEnd = bStart.getTime() + bDurationMin * 60_000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}

// تحقق نقي — يُختبر في وحدة منفصلة عن قاعدة البيانات.
export function parseCreateAppointment(
  body: unknown,
): { ok: true; value: CreateAppointmentInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const patientId = typeof b.patientId === "string" ? b.patientId.trim() : "";
  if (!patientId) {
    return { ok: false, error: "يجب اختيار مريض" };
  }
  const startsAt =
    typeof b.startsAt === "string" && !Number.isNaN(Date.parse(b.startsAt))
      ? new Date(b.startsAt)
      : null;
  if (!startsAt) {
    return { ok: false, error: "تاريخ ووقت البداية غير صالحين" };
  }
  const durationMin =
    typeof b.durationMin === "number" && Number.isInteger(b.durationMin)
      ? b.durationMin
      : 30;
  if (durationMin < 5 || durationMin > DAY_MIN) {
    return { ok: false, error: "المدة يجب أن تكون بين 5 دقائق و24 ساعة" };
  }
  const reason = typeof b.reason === "string" ? b.reason.trim() : undefined;
  const note = typeof b.note === "string" ? b.note.trim() : undefined;

  return {
    ok: true,
    value: { patientId, startsAt, durationMin, reason, note },
  };
}

export async function createAppointment(
  ctx: TenantContext,
  input: CreateAppointmentInput,
): Promise<ServiceError> {
  const db = clinicScope(ctx.clinicId);

  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) {
    return { ok: false, error: "المريض غير موجود", code: "NOT_FOUND" };
  }

  // التداخل يتطلب busyStart < نهاية المرشح و busyEnd > بدايته — يكفي مسح
  // مواعيد بدأت في النافذة [بداية المرشح − مدة أقصى، نهاية المرشح).
  const end = new Date(input.startsAt.getTime() + input.durationMin * 60_000);
  const earliestRelevant = new Date(
    input.startsAt.getTime() - DAY_MIN * 60_000,
  );
  const busy = await db.appointment.findMany({
    where: {
      startsAt: { gte: earliestRelevant, lt: end },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: { startsAt: true, durationMin: true },
  });
  const hasConflict = busy.some((a) =>
    appointmentsOverlap(
      a.startsAt,
      a.durationMin,
      input.startsAt,
      input.durationMin,
    ),
  );
  if (hasConflict) {
    return {
      ok: false,
      error: "التعارض: توجد فترة محجوزة في هذا الوقت",
      code: "CONFLICT",
    };
  }

  const appointment = await db.appointment.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      status: "SCHEDULED",
      reason: input.reason,
      note: input.note,
    },
    select: {
      id: true,
      patientId: true,
      patient: { select: { name: true } },
      startsAt: true,
      durationMin: true,
      status: true,
      reason: true,
      note: true,
    },
  });
  return {
    ok: true,
    value: {
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patient.name,
      startsAt: appointment.startsAt,
      durationMin: appointment.durationMin,
      status: appointment.status,
      reason: appointment.reason,
      note: appointment.note,
    },
  };
}

export async function listAppointments(
  ctx: TenantContext,
  from: Date,
  to: Date,
): Promise<AppointmentDto[]> {
  const db = clinicScope(ctx.clinicId);
  return db.appointment
    .findMany({
      where: { startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        patientId: true,
        patient: { select: { name: true } },
        startsAt: true,
        durationMin: true,
        status: true,
        reason: true,
        note: true,
      },
    })
    .then((rows) =>
      rows.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patient.name,
        startsAt: a.startsAt,
        durationMin: a.durationMin,
        status: a.status,
        reason: a.reason,
        note: a.note,
      })),
    );
}

// مواعيد مريض واحد فقط — قراءة عرضية لملف المريض، بنفس نمط listAppointments
// والحصر بالعيادة عبر clinicScope. تنازلياً زمنياً (الأحدث أولًا) بحد أعلى.
export async function listPatientAppointments(
  ctx: TenantContext,
  patientId: string,
  take = 50,
): Promise<AppointmentDto[]> {
  const db = clinicScope(ctx.clinicId);
  return db.appointment
    .findMany({
      where: { patientId },
      orderBy: { startsAt: "desc" },
      take,
      select: {
        id: true,
        patientId: true,
        startsAt: true,
        durationMin: true,
        status: true,
        reason: true,
        note: true,
      },
    })
    .then((rows) =>
      rows.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: "",
        startsAt: a.startsAt,
        durationMin: a.durationMin,
        status: a.status,
        reason: a.reason,
        note: a.note,
      })),
    );
}