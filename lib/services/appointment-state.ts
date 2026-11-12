import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import type { ServiceError } from "@/lib/services/appointments";
import {
  ALLOWED_TRANSITIONS,
  canTransition,
} from "@/lib/appointment-state";
import type { AppointmentStatus } from "@/lib/appointment-state";

// آلة حالات الموعد — منطق الخادم: كل تغيير يُسجل (من → إلى، مَن، متى)
// في AppointmentStatusChange كسجل إلحاقي. القواعد النقية في
// lib/appointment-state.ts (بلا I/O — آمنة لعميل المتصفح).

export type StatusChangeDto = {
  id: string;
  appointmentId: string;
  fromStatus: AppointmentStatus;
  toStatus: AppointmentStatus;
  changedById: string;
  createdAt: Date;
};

export async function changeAppointmentStatus(
  ctx: TenantContext,
  appointmentId: string,
  to: AppointmentStatus,
): Promise<ServiceError> {
  const db = clinicScope(ctx.clinicId);

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, status: true },
  });
  // clinicScope يحقن clinicId في where — فالموعد من عيادة أخرى يظهر كغير موجود.
  if (!appointment) {
    return { ok: false, error: "الموعد غير موجود", code: "NOT_FOUND" };
  }

  if (!canTransition(appointment.status, to)) {
    return {
      ok: false,
      error: "انتقال غير مسموح من هذه الحالة",
      code: "INVALID",
    };
  }

  const updated = await db.appointment.update({
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
    },
  });

  await db.appointmentStatusChange.create({
    data: {
      clinicId: ctx.clinicId,
      appointmentId,
      fromStatus: appointment.status,
      toStatus: to,
      changedById: ctx.userId,
    },
  });

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
    },
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
