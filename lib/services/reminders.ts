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
  /** هل سُجّل إرسال تذكير هذا الموعد سابقاً */
  sent: boolean;
};

// الملغى و«لم يحضر» لا يستحقان تذكيراً — بقية الحالات تظهر في قائمة الغد.
const NOT_REMINDABLE: AppointmentStatus[] = ["CANCELLED", "NO_SHOW"];

export async function listTomorrowReminders(
  ctx: TenantContext,
  now: Date = new Date(),
): Promise<ReminderDto[]> {
  const db = clinicScope(ctx.clinicId);
  const [from, to] = dayRange(addDays(now, 1));

  // نموذج Clinic لا يحمل clinicId — حقنه في where يُبطل الاستعلام. لذلك
  // يُجلب اسم العيادة عبر علاقة المستخدم clinic في استعلام واحد صالح.
  const [doctor, appointments] = await Promise.all([
    db.user.findFirst({
      where: { id: ctx.userId },
      select: { name: true, clinic: { select: { name: true } } },
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

  const clinicName = doctor?.clinic.name ?? "";
  const doctorName = doctor?.name ?? "";

  // سطور الإرسال السابقة تُجلب بدفعة واحدة — الحالة تبقى بين الجلسات من القاعدة.
  const appointmentIds = appointments.map((a) => a.id);
  const sentRows =
    appointmentIds.length > 0
      ? await db.appointmentReminder.findMany({
          where: { appointmentId: { in: appointmentIds } },
          select: { appointmentId: true },
        })
      : [];
  const sentIds = new Set(sentRows.map((s) => s.appointmentId));

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
      sent: sentIds.has(a.id),
    };
  });
}

export type MarkReminderSentResult =
  | { ok: true; sentAt: Date }
  | { ok: false; code: "NOT_FOUND" };

// تسجيل إرسال تذكير موعد — إلحاقي وعديم الأثر عند التكرار (idempotent):
// سطر واحد لكل موعد بفضل القيد المركّب clinicId+appointmentId. الموعد يُتحقق
// منه بنطاق العيادة أولاً — معرف الموعد من الطلب ادعاء لا حقيقة.
export async function markReminderSent(
  ctx: TenantContext,
  appointmentId: string,
): Promise<MarkReminderSentResult> {
  const db = clinicScope(ctx.clinicId);

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId },
    select: { id: true },
  });
  if (!appointment) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const existing = await db.appointmentReminder.findFirst({
    where: { appointmentId },
    select: { sentAt: true },
  });
  if (existing) {
    return { ok: true, sentAt: existing.sentAt };
  }

  const created = await db.appointmentReminder.create({
    data: { clinicId: ctx.clinicId, appointmentId, sentById: ctx.userId },
    select: { sentAt: true },
  });
  return { ok: true, sentAt: created.sentAt };
}
