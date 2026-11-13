// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import type { TenantContext } from "@/lib/tenant/context";
import { listTomorrowReminders, markReminderSent } from "@/lib/services/reminders";
import {
  createTemplate,
  deleteTemplate,
  findTemplatesForProcedure,
  listInstructionSends,
  recordInstructionSend,
  updateTemplate,
} from "@/lib/services/instructions";

// اختبارات تكامل التذكيرات والتعليمات — تحتاج قاعدة بيانات حقيقية وتتخطى
// إن لم يتوفر DATABASE_URL (نمط باقي اختبارات التكامل). عيادة مستقلة تُنظف بعدها.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

// يوم اختبار ثابت — الاثنين 15 يونيو 2026، فالغد الثلاثاء 16 يونيو.
const DAY = Date.UTC(2026, 5, 15);
const NOW = new Date(DAY);
const at = (h: number, m: number) =>
  new Date(DAY + 24 * 3_600_000 + h * 3_600_000 + m * 60_000);

let clinicId = "";
let userId = "";
let patientId = "";
let noPhonePatientId = "";
let ctx: TenantContext;

async function cleanClinicData(): Promise<void> {
  await prisma.instructionSend.deleteMany({ where: { clinicId } });
  await prisma.instructionTemplate.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.deleteMany({ where: { id: clinicId } });
}

describeDb("قائمة تذكير الغد — integration", () => {
  beforeAll(async () => {
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة تذكير (اختبار)" },
    });
    clinicId = clinic.id;
    const user = await prisma.user.create({
      data: {
        clinicId,
        name: "د. سالم",
        phone: "0911111111",
        passwordHash: await hashPassword("reminder-pass-1"),
        role: "DENTIST",
      },
    });
    userId = user.id;
    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض تذكير", phone: "0944-444-444" },
    });
    patientId = patient.id;
    const noPhone = await prisma.patient.create({
      data: { clinicId, name: "مريض بلا رقم", phone: null },
    });
    noPhonePatientId = noPhone.id;
    ctx = tenantContextFromSession({
      userId,
      clinicId,
      name: user.name,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await cleanClinicData();
  });

  async function addAppointment(input: {
    patientId: string;
    startsAt: Date;
    status?: "SCHEDULED" | "CONFIRMED" | "CANCELLED" | "NO_SHOW";
  }) {
    return prisma.appointment.create({
      data: {
        clinicId,
        patientId: input.patientId,
        startsAt: input.startsAt,
        durationMin: 30,
        status: input.status ?? "SCHEDULED",
      },
    });
  }

  it("يعرض مواعيد الغد فقط بترتيب زمني وبروابط wa.me صحيحة", async () => {
    const second = await addAppointment({ patientId, startsAt: at(11, 0) });
    const first = await addAppointment({ patientId, startsAt: at(9, 30) });
    // موعد اليوم لا يدخل قائمة الغد
    await prisma.appointment.create({
      data: { clinicId, patientId, startsAt: new Date(DAY + 8 * 3_600_000) },
    });

    const reminders = await listTomorrowReminders(ctx, NOW);

    expect(reminders).toHaveLength(2);
    expect(reminders[0].appointmentId).toBe(first.id);
    expect(reminders[1].appointmentId).toBe(second.id);
    expect(reminders[0].patientName).toBe("مريض تذكير");

    const url = reminders[0].whatsappUrl;
    expect(url).toMatch(/^https:\/\/wa\.me\/944444444\?text=/);
    const message = decodeURIComponent(url!.split("text=")[1]);
    expect(message).toContain("مريض تذكير");
    expect(message).toContain("عيادة تذكير (اختبار)");
    expect(message).toContain("د. سالم");
    expect(message).toContain("نذكّركم بموعدكم");
  });

  it("يستثني الملغى و«لم يحضر» من قائمة التذكير", async () => {
    const cancelled = await addAppointment({
      patientId,
      startsAt: at(8, 0),
      status: "CANCELLED",
    });
    const noShow = await addAppointment({
      patientId,
      startsAt: at(8, 30),
      status: "NO_SHOW",
    });

    const reminders = await listTomorrowReminders(ctx, NOW);
    const ids = reminders.map((r) => r.appointmentId);
    expect(ids).not.toContain(cancelled.id);
    expect(ids).not.toContain(noShow.id);
  });

  it("مريض بلا رقم هاتف يبقى في القائمة بلا رابط واتساب", async () => {
    await addAppointment({ patientId: noPhonePatientId, startsAt: at(12, 0) });

    const reminders = await listTomorrowReminders(ctx, NOW);
    const entry = reminders.find((r) => r.patientId === noPhonePatientId);
    expect(entry).toBeDefined();
    expect(entry?.phone).toBeNull();
    expect(entry?.whatsappUrl).toBeNull();
    expect(entry?.message).toContain("مريض بلا رقم");
  });
});

describeDb("قوالب التعليمات وتسجيل الإرسال — integration", () => {
  beforeAll(async () => {
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة تعليمات (اختبار)" },
    });
    clinicId = clinic.id;
    const user = await prisma.user.create({
      data: {
        clinicId,
        name: "د. هدى",
        phone: "0911111112",
        passwordHash: await hashPassword("instruction-pass-1"),
        role: "DENTIST",
      },
    });
    userId = user.id;
    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض تعليمات", phone: "0955-555-555" },
    });
    patientId = patient.id;
    ctx = tenantContextFromSession({
      userId,
      clinicId,
      name: user.name,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await cleanClinicData();
  });

  it("إنشاء قالب وتعديله وحذفه — دورة كاملة", async () => {
    const created = await createTemplate(ctx, {
      procedure: "خلع",
      body: "اعضض على شاش قطني ساعتين ولا تغسل أسنانك اليوم.",
    });
    expect(created.procedure).toBe("خلع");

    const updated = await updateTemplate(ctx, created.id, {
      body: "اعضض على شاش قطني ساعتين، ولا تشرب مشروبات ساخنة اليوم.",
    });
    expect(updated?.body).toContain("مشروبات ساخنة");

    const deleted = await deleteTemplate(ctx, created.id);
    expect(deleted).toBe(true);
    expect(await deleteTemplate(ctx, created.id)).toBe(false); // لم يعد موجوداً
  });

  it("يجلب القوالب المطابقة لإجراء منجز — تطابق تام وجزئي", async () => {
    await createTemplate(ctx, {
      procedure: "خلع",
      body: "تعليمات الخلع: تجنب المضمضة.",
    });
    await createTemplate(ctx, {
      procedure: "حشو",
      body: "تعليمات الحشو: لا تأكل لساعتين.",
    });

    const exact = await findTemplatesForProcedure(ctx, "خلع");
    expect(exact).toHaveLength(1);
    expect(exact[0].procedure).toBe("خلع");

    const partial = await findTemplatesForProcedure(ctx, "خلع ضرس");
    expect(partial.map((t) => t.procedure)).toContain("خلع");
  });

  it("تسجيل الإرسال بقيد إلحاقي في تاريخ المريض — القناة والوقت والنص", async () => {
    const template = await createTemplate(ctx, {
      procedure: "زرعة",
      body: "تجنب المضمضة 24 ساعة وتناول المسكن عند الحاجة.",
    });

    const send = await recordInstructionSend(ctx, patientId, {
      templateId: template.id,
      procedure: "زرعة",
      body: template.body,
      channel: "WHATSAPP",
    });
    expect(send).not.toBeNull();
    expect(send?.channel).toBe("WHATSAPP");
    expect(send?.templateId).toBe(template.id);

    await recordInstructionSend(ctx, patientId, {
      templateId: null,
      procedure: "زرعة",
      body: "نسخة نصية معدلة من نفس التعليمات.",
      channel: "TEXT",
    });

    const history = await listInstructionSends(ctx, patientId);
    expect(history).toHaveLength(2);
    // الأحدث أولاً
    expect(history[0].channel).toBe("TEXT");
    expect(history[1].channel).toBe("WHATSAPP");
    expect(history[1].body).toBe(template.body);
  });

  it("مريض عيادة أخرى — لا تسجيل ولا قراءة تاريخ (عزل)", async () => {
    const otherClinic = await prisma.clinic.create({
      data: { name: "عيادة أخرى (اختبار)" },
    });
    const otherPatient = await prisma.patient.create({
      data: { clinicId: otherClinic.id, name: "مريض أخرى" },
    });

    // تسجيل الإرسال لمريض عيادة أخرى يُرفض — null يعادل 404 في الـ handler
    const result = await recordInstructionSend(ctx, otherPatient.id, {
      templateId: null,
      procedure: "خلع",
      body: "لا يجب أن يُسجَّل هذا القيد.",
      channel: "TEXT",
    });
    expect(result).toBeNull();

    // التاريخ لا يُقرأ عبر حدود العيادات
    const history = await listInstructionSends(ctx, otherPatient.id);
    expect(history).toHaveLength(0);

    await prisma.patient.delete({ where: { id: otherPatient.id } });
    await prisma.clinic.delete({ where: { id: otherClinic.id } });
  });
});

describeDb("تتبع حالة إرسال تذكير الغد — integration", () => {
  let trackClinicId = "";
  let trackUserId = "";
  let trackPatientId = "";
  let trackCtx: TenantContext;

  beforeAll(async () => {
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة تتبع تذكير (اختبار)" },
    });
    trackClinicId = clinic.id;
    const user = await prisma.user.create({
      data: {
        clinicId: trackClinicId,
        name: "د. رامي",
        phone: "0911111113",
        passwordHash: await hashPassword("track-pass-1"),
        role: "DENTIST",
      },
    });
    trackUserId = user.id;
    const patient = await prisma.patient.create({
      data: { clinicId: trackClinicId, name: "مريض تتبع", phone: "0966-666-666" },
    });
    trackPatientId = patient.id;
    trackCtx = tenantContextFromSession({
      userId: trackUserId,
      clinicId: trackClinicId,
      name: user.name,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await prisma.appointmentReminder.deleteMany({ where: { clinicId: trackClinicId } });
    await prisma.appointment.deleteMany({ where: { clinicId: trackClinicId } });
    await prisma.patient.deleteMany({ where: { clinicId: trackClinicId } });
    await prisma.user.deleteMany({ where: { clinicId: trackClinicId } });
    await prisma.clinic.deleteMany({ where: { id: trackClinicId } });
  });

  it("التسجيل يجعل القائمة تعلم «أُرسل» ويبقى بين الجلسات — والتكرار بلا أثر", async () => {
    const a1 = await prisma.appointment.create({
      data: {
        clinicId: trackClinicId,
        patientId: trackPatientId,
        startsAt: at(9, 0),
        durationMin: 30,
        status: "SCHEDULED",
      },
    });
    const a2 = await prisma.appointment.create({
      data: {
        clinicId: trackClinicId,
        patientId: trackPatientId,
        startsAt: at(10, 0),
        durationMin: 30,
        status: "SCHEDULED",
      },
    });

    // قبل التسجيل: كل شيء غير مُرسل
    const before = await listTomorrowReminders(trackCtx, NOW);
    expect(before.find((r) => r.appointmentId === a1.id)?.sent).toBe(false);
    expect(before.find((r) => r.appointmentId === a2.id)?.sent).toBe(false);

    const first = await markReminderSent(trackCtx, a1.id);
    expect(first.ok).toBe(true);

    // التكرار عديم الأثر — سطر واحد فقط في السجل
    const again = await markReminderSent(trackCtx, a1.id);
    expect(again.ok).toBe(true);
    if (first.ok && again.ok) {
      expect(again.sentAt.getTime()).toBe(first.sentAt.getTime());
    }
    expect(
      await prisma.appointmentReminder.count({
        where: { clinicId: trackClinicId },
      }),
    ).toBe(1);

    // القائمة بعد التسجيل: الأول أُرسل والثاني بقي «متبقياً»
    const after = await listTomorrowReminders(trackCtx, NOW);
    expect(after.find((r) => r.appointmentId === a1.id)?.sent).toBe(true);
    expect(after.find((r) => r.appointmentId === a2.id)?.sent).toBe(false);
  });

  it("موعد عيادة أخرى لا يُسجَّل — العزل عبر نطاق العيادة", async () => {
    const otherClinic = await prisma.clinic.create({
      data: { name: "عيادة تتبع أخرى" },
    });
    const otherPatient = await prisma.patient.create({
      data: { clinicId: otherClinic.id, name: "مريض تتبع أخرى" },
    });
    const otherAppointment = await prisma.appointment.create({
      data: {
        clinicId: otherClinic.id,
        patientId: otherPatient.id,
        startsAt: at(11, 0),
        durationMin: 30,
        status: "SCHEDULED",
      },
    });

    const result = await markReminderSent(trackCtx, otherAppointment.id);
    expect(result.ok).toBe(false);

    await prisma.appointment.delete({ where: { id: otherAppointment.id } });
    await prisma.patient.delete({ where: { id: otherPatient.id } });
    await prisma.clinic.delete({ where: { id: otherClinic.id } });
  });
});
