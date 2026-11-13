import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { appointmentsOverlap } from "@/lib/services/appointments";
import type { AppointmentDto } from "@/lib/services/appointments";
import { AUTO_FILL_REASON } from "@/lib/services/waitlist";
import { canTransition } from "@/lib/appointment-state";
import type { AppointmentStatus } from "@/lib/appointment-state";
import { pickBestWaitlistMatch } from "@/lib/services/waitlist-matching";
import { MIN_AUTO_FILL_MINUTES } from "@/lib/services/waitlist-matching";

// آلة حالات الموعد — منطق الخادم: كل تغيير يُسجل (من → إلى، مَن، متى)
// في AppointmentStatusChange كسجل إلحاقي. القواعد النقية في
// lib/appointment-state.ts (بلا I/O — آمنة لعميل المتصفح).
//
// تحديث الحالة وسجل التغيير وتعبئة الفجوة تُنفَّذ داخل معاملة Prisma واحدة:
// انتقال إلى CANCELLED أو NO_SHOW يفتح فجوة، وإن وُجد منتظر مناسب يُحجز
// تلقائياً في نفس المعاملة — فحص التعارض داخل المعاملة يمنع الحجز المزدوج
// حتى مع تزامن إلغاءات متوازية (نفس أسلوب recordMaterialUsage الذرّي).
// إن لم يوجد تطابق تبقى الفجوة فجوة بلا خطأ ولا إشعار.

/** المدة الافتراضية للحجز التلقائي — نفس افتراض BookGapModal، مقيدة بمدة الفجوة. */
const AUTO_FILL_DEFAULT_MINUTES = 30;

export type StatusChangeDto = {
  id: string;
  appointmentId: string;
  fromStatus: AppointmentStatus;
  toStatus: AppointmentStatus;
  changedById: string;
  createdAt: Date;
};

/** نتيجة تعبئة فجوة من قائمة الانتظار — تُستخدم في رسالة المكوّن وزر التراجع. */
export type WaitlistFillDto = {
  /** قيد الانتظار المحجوز — تُعاد إليه حالة WAITING عند التراجع */
  waitlistEntryId: string;
  patientId: string;
  patientName: string;
  /** الموعد الجديد المُنشأ في الفجوة — يُحذف عند التراجع */
  appointmentId: string;
  startsAt: Date;
  durationMin: number;
};

export type StatusChangeResult =
  | { ok: true; value: AppointmentDto; waitlistFill: WaitlistFillDto | null }
  | {
      ok: false;
      error: string;
      code: "CONFLICT" | "NOT_FOUND" | "INVALID";
    };

export async function changeAppointmentStatus(
  ctx: TenantContext,
  appointmentId: string,
  to: AppointmentStatus,
): Promise<StatusChangeResult> {
  const db = clinicScope(ctx.clinicId);

  return db.$transaction(async (tx): Promise<StatusChangeResult> => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true },
    });
    // clinicScope يحقن clinicId في where — فالموعد من عيادة أخرى يظهر كغير موجود.
    if (!appointment) {
      return { ok: false, error: "الموعد غير موجود", code: "NOT_FOUND" };
    }

    // المنطق الحقيقي للانتقالات المسموحة في canTransition (lib/appointment-state).
    if (!canTransition(appointment.status, to)) {
      return {
        ok: false,
        error: "انتقال غير مسموح من هذه الحالة",
        code: "INVALID",
      };
    }

    const updated = await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: to },
      select: {
        id: true,
        patientId: true,
        patient: { select: { name: true } },
        startsAt: true,
        durationMin: true,
        status: true,
        reason: true,
        note: true,
        staffId: true,
        staff: { select: { name: true } },
      },
    });

    await tx.appointmentStatusChange.create({
      data: {
        clinicId: ctx.clinicId,
        appointmentId,
        fromStatus: appointment.status,
        toStatus: to,
        changedById: ctx.userId,
      },
    });

    // الإلغاء وعدم الحضور يفتحان فجوة — أقرب موعد محجوز يُستبدل بمنتظر مناسب.
    const waitlistFill =
      to === "CANCELLED" || to === "NO_SHOW"
        ? await fillGapFromWaitlist(tx, ctx.clinicId, {
            sourceAppointmentId: appointmentId,
            startsAt: updated.startsAt,
            durationMin: updated.durationMin,
          })
        : null;

    return {
      ok: true,
      value: {
        id: updated.id,
        patientId: updated.patientId,
        patientName: updated.patient.name,
        startsAt: updated.startsAt,
        durationMin: updated.durationMin,
        status: updated.status,
        reason: updated.reason,
        note: updated.note,
        staffId: updated.staffId,
        staffName: updated.staff?.name ?? null,
      },
      waitlistFill,
    };
  });
}

// تعبئة الفجوة بمنتظر مناسب — تُستدعى داخل معاملة الانتقال حصراً. فحص
// التعارض يقارن الفجوة بالمواعيد غير الملغاة وغير المكتملة، والموعد الملغى
// نفسه مستبعد لأن حالته عُدلت CANCELLED/NO_SHOW في المعاملة ذاتها.
async function fillGapFromWaitlist(
  tx: Parameters<Parameters<ReturnType<typeof clinicScope>["$transaction"]>[0]>[0],
  clinicId: string,
  freed: { sourceAppointmentId: string; startsAt: Date; durationMin: number },
): Promise<WaitlistFillDto | null> {
  const durationMin = Math.min(AUTO_FILL_DEFAULT_MINUTES, freed.durationMin);
  if (durationMin < MIN_AUTO_FILL_MINUTES) return null;

  const candidates = (
    await tx.waitlistEntry.findMany({
      where: { status: "WAITING" },
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
    })
  ).map((row) => ({
    id: row.id,
    patientId: row.patientId,
    patientName: row.patient.name,
    preferredWindow: row.preferredWindow,
    priority: row.priority,
    status: row.status,
    note: row.note,
  }));

  const best = pickBestWaitlistMatch(candidates, freed.startsAt, freed.durationMin);
  if (!best) return null;

  // فحص التعارض داخل المعاملة — يمنع الحجز المزدوج حتى مع تزامن الإلغاءات.
  // الموعد المصدر مستبعد صراحةً بالمعرف: فجوة NO_SHOW لا تسدها حالته هو
  // (notIn لا يشمل NO_SHOW فبقي موعد عدم الحضور يسد فجوته ذاتياً).
  const end = new Date(freed.startsAt.getTime() + durationMin * 60_000);
  const earliestRelevant = new Date(freed.startsAt.getTime() - 24 * 60 * 60_000);
  const busy = await tx.appointment.findMany({
    where: {
      id: { not: freed.sourceAppointmentId },
      startsAt: { gte: earliestRelevant, lt: end },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: { startsAt: true, durationMin: true },
  });
  if (
    busy.some((a) =>
      appointmentsOverlap(a.startsAt, a.durationMin, freed.startsAt, durationMin),
    )
  ) {
    return null;
  }

  const created = await tx.appointment.create({
    data: {
      clinicId,
      patientId: best.patientId,
      startsAt: freed.startsAt,
      durationMin,
      status: "SCHEDULED",
      reason: AUTO_FILL_REASON,
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

  await tx.waitlistEntry.update({
    where: { id: best.id },
    data: { status: "BOOKED" },
  });

  return {
    waitlistEntryId: best.id,
    patientId: created.patientId,
    patientName: created.patient.name,
    appointmentId: created.id,
    startsAt: created.startsAt,
    durationMin: created.durationMin,
  };
}

export async function listStatusChanges(
  ctx: TenantContext,
  appointmentId: string,
): Promise<StatusChangeDto[]> {
  const db = clinicScope(ctx.clinicId);
  const changes = await db.appointmentStatusChange.findMany({
    where: { appointmentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      appointmentId: true,
      fromStatus: true,
      toStatus: true,
      changedById: true,
      createdAt: true,
    },
  });
  return changes;
}
