import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { appointmentsOverlap } from "@/lib/services/appointments";
import type { AppointmentDto } from "@/lib/services/appointments";

// نوع نتيجة الخدمة — يفرّق بين خطأ مُصنَّف والقيمة المُرجعة.
type WaitlistResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: "CONFLICT" | "NOT_FOUND" | "INVALID" };

// خدمة قائمة الانتظار — مرضى طالبو موعداً مع فترة مفضلة، ومقترحات فجوات
// شاغرة في جدول اليوم. الفجوة = وقت حر ضمن ساعات العمل غير متقاطع مع موعد
// غير ملغى وغير مكتمل — لذا إلغاء موعد يفتح فجوة تُقترح تلقائياً.

export type WaitlistStatus = "WAITING" | "OFFERED" | "BOOKED";

export type WaitlistEntryDto = {
  id: string;
  patientId: string;
  patientName: string;
  preferredWindow: string;
  priority: number;
  status: WaitlistStatus;
  note: string | null;
};

export type CreateWaitlistInput = {
  patientId: string;
  preferredWindow: string;
  priority?: number;
  note?: string;
};

export type GapDto = {
  start: Date;
  end: Date;
  durationMin: number;
};

// ساعات العمل الافتراضية للعيادة — قد تصبح إعداداً لاحقاً.
export const WORK_DAY_START_UTC_HOUR = 7; // 10 صباحاً بتوقيت دمشق (UTC+3)
export const WORK_DAY_END_UTC_HOUR = 14; // 5 مساءً بتوقيت دمشق

export function parseCreateWaitlistEntry(
  body: unknown,
): { ok: true; value: CreateWaitlistInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const patientId = typeof b.patientId === "string" ? b.patientId.trim() : "";
  if (!patientId) {
    return { ok: false, error: "يجب اختيار مريض" };
  }
  const preferredWindow =
    typeof b.preferredWindow === "string" ? b.preferredWindow.trim() : "";
  if (preferredWindow.length < 2 || preferredWindow.length > 100) {
    return { ok: false, error: "الفترة المفضلة يجب أن تكون بين 2 و100 حرف" };
  }
  const priority =
    typeof b.priority === "number" && Number.isInteger(b.priority)
      ? b.priority
      : 0;
  if (priority < 0 || priority > 100) {
    return { ok: false, error: "الأولوية يجب أن تكون بين 0 و100" };
  }
  const note = typeof b.note === "string" ? b.note.trim() : undefined;

  return { ok: true, value: { patientId, preferredWindow, priority, note } };
}

export async function addToWaitlist(
  ctx: TenantContext,
  input: CreateWaitlistInput,
): Promise<WaitlistResult<WaitlistEntryDto>> {
  const db = clinicScope(ctx.clinicId);
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) {
    return { ok: false, error: "المريض غير موجود", code: "NOT_FOUND" };
  }

  const entry = await db.waitlistEntry.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      preferredWindow: input.preferredWindow,
      priority: input.priority ?? 0,
      status: "WAITING",
      note: input.note,
    },
    select: {
      id: true,
      patientId: true,
      patient: { select: { name: true } },
      preferredWindow: true,
      priority: true,
      status: true,
      note: true,
    },
  });
  return { ok: true, value: mapWaitlistEntry(entry) };
}

export async function listWaitlist(
  ctx: TenantContext,
): Promise<WaitlistEntryDto[]> {
  const db = clinicScope(ctx.clinicId);
  const entries = await db.waitlistEntry.findMany({
    where: { status: { in: ["WAITING", "OFFERED"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      patientId: true,
      patient: { select: { name: true } },
      preferredWindow: true,
      priority: true,
      status: true,
      note: true,
    },
  });
  return entries.map(mapWaitlistEntry);
}

// نقي — فجوات شاغرة ضمن نافذة زمنية معطاة بعد استبعاد الفترات المشغولة.
export function computeOpenGaps(
  windowStart: Date,
  windowEnd: Date,
  busy: { startsAt: Date; durationMin: number }[],
): GapDto[] {
  // ندمج الفترات المشغولة مرتبة، ثم نمشي بينها لنستخرج الفراغات.
  const merged: { start: number; end: number }[] = [];
  for (const a of [...busy].sort(
    (x, y) => x.startsAt.getTime() - y.startsAt.getTime(),
  )) {
    const start = Math.max(a.startsAt.getTime(), windowStart.getTime());
    const end = Math.min(
      a.startsAt.getTime() + a.durationMin * 60_000,
      windowEnd.getTime(),
    );
    if (start >= end) continue;
    const last = merged[merged.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      merged.push({ start, end });
    }
  }

  const gaps: GapDto[] = [];
  let cursor = windowStart.getTime();
  for (const m of merged) {
    if (m.start > cursor) {
      pushGap(gaps, cursor, m.start);
    }
    cursor = Math.max(cursor, m.end);
  }
  if (windowEnd.getTime() > cursor) {
    pushGap(gaps, cursor, windowEnd.getTime());
  }
  return gaps;
}

function pushGap(gaps: GapDto[], startMs: number, endMs: number): void {
  const durationMin = Math.floor((endMs - startMs) / 60_000);
  if (durationMin >= 5) {
    gaps.push({ start: new Date(startMs), end: new Date(endMs), durationMin });
  }
}

export async function listOpenGaps(
  ctx: TenantContext,
  windowStart: Date,
  windowEnd: Date,
): Promise<GapDto[]> {
  const db = clinicScope(ctx.clinicId);
  const busy = await db.appointment.findMany({
    where: {
      startsAt: { gte: windowStart, lt: windowEnd },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: { startsAt: true, durationMin: true },
  });
  return computeOpenGaps(windowStart, windowEnd, busy);
}

export type BookFromWaitlistInput = {
  waitlistEntryId: string;
  startsAt: Date;
  durationMin: number;
};

// حجز مريض من الانتظار في فجوة شاغرة — بضغطة واحدة: إنشاء الموعد
// (بفحص التعارض نفسه) ثم تعليم القيد BOOKED.
export async function bookFromWaitlist(
  ctx: TenantContext,
  input: BookFromWaitlistInput,
): Promise<
  | { ok: true; value: AppointmentDto }
  | { ok: false; error: string; code: "CONFLICT" | "NOT_FOUND" | "INVALID" }
> {
  const db = clinicScope(ctx.clinicId);

  const entry = await db.waitlistEntry.findUnique({
    where: { id: input.waitlistEntryId },
    select: { id: true, patientId: true, status: true },
  });
  if (!entry) {
    return { ok: false, error: "قيد الانتظار غير موجود", code: "NOT_FOUND" };
  }
  if (entry.status === "BOOKED") {
    return { ok: false, error: "تم حجز هذا القيد مسبقاً", code: "INVALID" };
  }

  // فحص التعارض نفسه المستخدم في الحجز المباشر.
  const earliestRelevant = new Date(
    input.startsAt.getTime() - 24 * 60 * 60_000,
  );
  const busy = await db.appointment.findMany({
    where: {
      startsAt: { gte: earliestRelevant, lt: input.startsAt },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: { startsAt: true, durationMin: true },
  });
  if (
    busy.some((a) =>
      appointmentsOverlap(
        a.startsAt,
        a.durationMin,
        input.startsAt,
        input.durationMin,
      ),
    )
  ) {
    return { ok: false, error: "الفجوة لم تعد شاغرة", code: "CONFLICT" };
  }

  const created = await db.appointment.create({
    data: {
      clinicId: ctx.clinicId,
      patientId: entry.patientId,
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      status: "SCHEDULED",
      reason: "من قائمة الانتظار",
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

  await db.waitlistEntry.update({
    where: { id: input.waitlistEntryId },
    data: { status: "BOOKED" },
  });

  return {
    ok: true,
    value: {
      id: created.id,
      patientId: created.patientId,
      patientName: created.patient.name,
      startsAt: created.startsAt,
      durationMin: created.durationMin,
      status: created.status,
      reason: created.reason,
      note: created.note,
    },
  };
}

function mapWaitlistEntry(entry: {
  id: string;
  patientId: string;
  patient: { name: string };
  preferredWindow: string;
  priority: number;
  status: WaitlistStatus;
  note: string | null;
}): WaitlistEntryDto {
  return {
    id: entry.id,
    patientId: entry.patientId,
    patientName: entry.patient.name,
    preferredWindow: entry.preferredWindow,
    priority: entry.priority,
    status: entry.status,
    note: entry.note,
  };
}
