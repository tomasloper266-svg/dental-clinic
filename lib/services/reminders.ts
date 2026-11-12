import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";
import { addDays, dayRange } from "@/lib/dates";
import {
  buildReminderMessage,
  buildWhatsAppUrl,
} from "@/lib/reminders/whatsapp";
import type { AppointmentStatus } from "@/lib/services/appointments";

// خدمة التذكير اليومي — مواعيد الغد بروابط واتساب جاهزة.
// كل استعلام عبر clinicScope بمعرّف العيادة من سياق الجلسة، والرسالة تُبنى
// من أدوات نقية (lib/reminders/whatsapp) لتبقى قابلة للاختبار بمعزل عن القاعدة.

const REMINDER_FORMATS = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const TIME_FMT = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
  hour: "2-digit",
  minute: "2-digit",
});

export type ReminderDto = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  phone: string | null;
  startsAt: Date;
  durationMin: number;
  status: AppointmentStatus;
  reason: string | null;
  whatsappUrl: string | null;
  message: string;
};

// الملغى و«لم يحضر» لا يستحقان تذكيراً — بقية الحالات تظهر في قائمة الغد.
const NOT_REMINDABLE: AppointmentStatus[] = ["CANCELLED", "NO_SHOW"];

export async function listTomorrowReminders(
  ctx: TenantContext,
  now: Date = new Date(),
): Promise<ReminderDto[]> {
  const db = clinicScope(ctx.clinicId);
  const [from, to] = dayRange(addDays(now, 1));

  const [clinic, doctor, appointments] = await Promise.all([
    db.clinic.findUnique({
      where: { id: ctx.clinicId },
      select: { name: true },
    }),
    db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    }),
    db.appointment.findMany({
      where: {
        startsAt: { gte: from, lt: to },
        status: { notIn: NOT_REMINDABLE },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        patientId: true,
        patient: { select: { name: true, phone: true } },
        startsAt: true,
        durationMin: true,
        status: true,
        reason: true,
      },
    }),
  ]);

  const clinicName = clinic?.name ?? "";
  const doctorName = doctor?.name ?? "";

  return appointments.map((a) => {
    const message = buildReminderMessage({
      patientName: a.patient.name,
      clinicName,
      doctorName,
      dateText: REMINDER_FORMATS.format(a.startsAt),
      timeText: TIME_FMT.format(a.startsAt),
    });
    return {
      appointmentId: a.id,
      patientId: a.patientId,
      patientName: a.patient.name,
      phone: a.patient.phone,
      startsAt: a.startsAt,
      durationMin: a.durationMin,
      status: a.status,
      reason: a.reason,
      // مريض بلا رقم هاتف يبقى في القائمة — بلا رابط، مع بيان السبب في الواجهة.
      whatsappUrl: a.patient.phone
        ? buildWhatsAppUrl(a.patient.phone, message)
        : null,
      message,
    };
  });
}
