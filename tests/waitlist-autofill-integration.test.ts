// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { changeAppointmentStatus } from "@/lib/services/appointment-state";
import {
  AUTO_FILL_REASON,
  undoWaitlistAutoFill,
} from "@/lib/services/waitlist";
import type { TenantContext } from "@/lib/tenant/context";

// اختبارات التكامل تحتاج قاعدة بيانات حقيقية — تُتخطى إن لم يتوفر DATABASE_URL
// (نمط اختبارات عزل المستأجرين). تتحقق المعاملة نفسها: تعبئة الفجوة، منع
// الحجز المزدوج داخلها، والتراجع بضغطة.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

// يوم اختبار ثابت — الاثنين 15 يونيو 2026.
const DAY = Date.UTC(2026, 5, 15);
const at = (h: number, m = 0) => new Date(DAY + h * 3_600_000 + m * 60_000);

const PHONE = "0934444444";
const PASSWORD = "autofill-pass-1";

let clinicId = "";
let userId = "";
let ctx: TenantContext;

let patientCounter = 0;

async function createPatient(name: string): Promise<string> {
  patientCounter += 1;
  const patient = await prisma.patient.create({
    data: { clinicId, name, phone: `0935${String(patientCounter).padStart(7, "0")}` },
  });
  return patient.id;
}

async function createAppointment(input: {
  patientId: string;
  startsAt: Date;
  durationMin: number;
  status?: "SCHEDULED" | "CANCELLED" | "COMPLETED";
}): Promise<string> {
  const appointment = await prisma.appointment.create({
    data: {
      clinicId,
      patientId: input.patientId,
      startsAt: input.startsAt,
      durationMin: input.durationMin,
      status: input.status ?? "SCHEDULED",
    },
  });
  return appointment.id;
}

async function createWaitlistEntry(input: {
  patientId: string;
  preferredWindow: string;
  priority?: number;
}): Promise<string> {
  const entry = await prisma.waitlistEntry.create({
    data: {
      clinicId,
      patientId: input.patientId,
      preferredWindow: input.preferredWindow,
      priority: input.priority ?? 0,
      status: "WAITING",
    },
  });
  return entry.id;
}

async function cleanClinicData(): Promise<void> {
  await prisma.appointmentStatusChange.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.waitlistEntry.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.deleteMany({ where: { id: clinicId } });
}

describeDb("التعبئة التلقائية للفجوات من قائمة الانتظار — integration", () => {
  beforeAll(async () => {
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة التعبئة التلقائية (اختبار)" },
    });
    clinicId = clinic.id;
    const user = await prisma.user.create({
      data: {
        clinicId,
        name: "د. تعبئة",
        phone: PHONE,
        passwordHash: await hashPassword(PASSWORD),
        role: "DENTIST",
      },
    });
    userId = user.id;
    ctx = tenantContextFromSession({
      userId,
      clinicId,
      name: user.name,
      lockEnabled: false,
role: "DENTIST",
    });
  });

  afterAll(async () => {
    await cleanClinicData();
  });

  it("الإلغاء يحجز أفضل منتظر في الفجوة داخل المعاملة نفسها", async () => {
    const patientA = await createPatient("مالك الموعد الملغى");
    const patientB = await createPatient("منتظر مرن");
    const patientC = await createPatient("منتظر أولوية");

    const appointmentId = await createAppointment({
      patientId: patientA,
      startsAt: at(9),
      durationMin: 60,
    });
    // «أي وقت» بأولوية أدنى، و«مساء» بأولوية أعلى لن يطابق 12:00 محلياً.
    const flexibleEntryId = await createWaitlistEntry({
      patientId: patientB,
      preferredWindow: "أي وقت",
      priority: 3,
    });
    await createWaitlistEntry({
      patientId: patientC,
      preferredWindow: "مساء",
      priority: 10,
    });

    const result = await changeAppointmentStatus(ctx, appointmentId, "CANCELLED");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // نتيجة واضحة للمكوّن: حُجز المنتظر فلان بالفجوة.
    expect(result.waitlistFill).not.toBeNull();
    const fill = result.waitlistFill!;
    expect(fill.waitlistEntryId).toBe(flexibleEntryId);
    expect(fill.patientId).toBe(patientB);
    expect(fill.startsAt.getTime()).toBe(at(9).getTime());
    expect(fill.durationMin).toBe(30);

    // الموعد الجديد محجوز في الفجوة والقيد عُلّم BOOKED — في المعاملة نفسها
    // التي عدّلت حالة الموعد الأصلي.
    const created = await prisma.appointment.findUnique({
      where: { id: fill.appointmentId },
    });
    expect(created?.status).toBe("SCHEDULED");
    expect(created?.reason).toBe(AUTO_FILL_REASON);
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id: flexibleEntryId },
    });
    expect(entry?.status).toBe("BOOKED");

    // الموعد الأصلي ملغى وسجل التغيير الإلحاقي مسجّل.
    const source = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    expect(source?.status).toBe("CANCELLED");
    const changes = await prisma.appointmentStatusChange.findMany({
      where: { appointmentId },
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.fromStatus).toBe("SCHEDULED");
    expect(changes[0]?.toStatus).toBe("CANCELLED");
  });

  it("عدم الحضور يفتح الفجوة نفسها للتعبئة التلقائية", async () => {
    const patientA = await createPatient("غائب عن موعده");
    const patientB = await createPatient("بديل الحضور");
    const appointmentId = await createAppointment({
      patientId: patientA,
      startsAt: at(10),
      durationMin: 30,
    });
    await createWaitlistEntry({ patientId: patientB, preferredWindow: "ظهر" });

    const result = await changeAppointmentStatus(ctx, appointmentId, "NO_SHOW");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.waitlistFill?.patientId).toBe(patientB);
  });

  it("لا منتظر مناسب — الفجوة تبقى فجوة بلا خطأ", async () => {
    const patientA = await createPatient("مالك فجوة صامتة");
    const appointmentId = await createAppointment({
      patientId: patientA,
      startsAt: at(8),
      durationMin: 30,
    });
    // منتظر مساءً فقط — 11:00 محلياً لا تطابقه.
    const eveningPatient = await createPatient("منتظر مسائي");
    const eveningEntryId = await createWaitlistEntry({
      patientId: eveningPatient,
      preferredWindow: "مساء",
    });

    const result = await changeAppointmentStatus(ctx, appointmentId, "CANCELLED");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.waitlistFill).toBeNull();
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id: eveningEntryId },
    });
    expect(entry?.status).toBe("WAITING");
    const appointments = await prisma.appointment.findMany({
      where: { startsAt: at(8) },
    });
    expect(appointments).toHaveLength(1); // الملغى فقط — لا حجز جديد
  });

  it("فجوة أقصر من الحد الأدنى لا تُملأ", async () => {
    const patientA = await createPatient("مالك فجوة قصيرة");
    const appointmentId = await createAppointment({
      patientId: patientA,
      startsAt: at(11),
      durationMin: 15,
    });
    const waitingPatient = await createPatient("منتظر لفجوة قصيرة");
    await createWaitlistEntry({ patientId: waitingPatient, preferredWindow: "أي وقت" });

    const result = await changeAppointmentStatus(ctx, appointmentId, "CANCELLED");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.waitlistFill).toBeNull();
  });

  it("منع الحجز المزدوج: منتظر له موعد متقاطع لا يُحجز في الفجوة", async () => {
    const patientA = await createPatient("مالك فجوة التعارض");
    const patientB = await createPatient("منتظر مثقل بموعد");
    const appointmentId = await createAppointment({
      patientId: patientA,
      startsAt: at(12),
      durationMin: 30,
    });
    const entryId = await createWaitlistEntry({
      patientId: patientB,
      preferredWindow: "أي وقت",
    });
    // للمنتظر نفسه موعد قائم يتقاطع مع الفجوة المفتوحة — الحجز يجب أن يُرفض.
    await createAppointment({
      patientId: patientB,
      startsAt: at(12, 15),
      durationMin: 30,
    });

    const result = await changeAppointmentStatus(ctx, appointmentId, "CANCELLED");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.waitlistFill).toBeNull();
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id: entryId },
    });
    expect(entry?.status).toBe("WAITING");
  });

  it("التراجع بضغطة: حذف الحجز التلقائي وإعادة كل شيء لما كان", async () => {
    const patientA = await createPatient("مالك تراجع");
    const patientB = await createPatient("محجوز تراجع");
    const appointmentId = await createAppointment({
      patientId: patientA,
      startsAt: at(9, 30),
      durationMin: 30,
    });
    const entryId = await createWaitlistEntry({
      patientId: patientB,
      preferredWindow: "أي وقت",
    });

    const fillResult = await changeAppointmentStatus(ctx, appointmentId, "CANCELLED");
    expect(fillResult.ok).toBe(true);
    const fill = fillResult.ok ? fillResult.waitlistFill : null;
    expect(fill).not.toBeNull();
    if (!fill) return;

    const undo = await undoWaitlistAutoFill(ctx, {
      filledAppointmentId: fill.appointmentId,
      waitlistEntryId: fill.waitlistEntryId,
      sourceAppointmentId: appointmentId,
    });
    expect(undo).toEqual({ ok: true });

    const created = await prisma.appointment.findUnique({
      where: { id: fill.appointmentId },
    });
    expect(created).toBeNull();
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id: entryId },
    });
    expect(entry?.status).toBe("WAITING");
    const source = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    expect(source?.status).toBe("SCHEDULED");
    // السجل إلحاقي — قيد التراجع مضاف لا محذوف.
    const changes = await prisma.appointmentStatusChange.findMany({
      where: { appointmentId },
      orderBy: { createdAt: "asc" },
    });
    expect(changes).toHaveLength(2);
    expect(changes[1]?.fromStatus).toBe("CANCELLED");
    expect(changes[1]?.toStatus).toBe("SCHEDULED");
  });

  it("التراجع يرفض الحجز اليدوي والموعد المحذوف", async () => {
    const patientA = await createPatient("مالك حجز يدوي");
    const patientB = await createPatient("محجوز يدوياً");
    // موعد بحجز يدوي (سبب مختلف) — التراجع الآلي لا يمسه.
    const manual = await prisma.appointment.create({
      data: {
        clinicId,
        patientId: patientB,
        startsAt: at(13),
        durationMin: 30,
        status: "SCHEDULED",
        reason: "من قائمة الانتظار",
      },
    });
    const manualEntry = await prisma.waitlistEntry.create({
      data: {
        clinicId,
        patientId: patientB,
        preferredWindow: "أي وقت",
        status: "BOOKED",
      },
    });

    const manualUndo = await undoWaitlistAutoFill(ctx, {
      filledAppointmentId: manual.id,
      waitlistEntryId: manualEntry.id,
      sourceAppointmentId: patientA,
    });
    expect(manualUndo.ok).toBe(false);
    if (!manualUndo.ok) expect(manualUndo.code).toBe("INVALID");

    const ghostUndo = await undoWaitlistAutoFill(ctx, {
      filledAppointmentId: "cuid-غير-موجود",
      waitlistEntryId: manualEntry.id,
      sourceAppointmentId: patientA,
    });
    expect(ghostUndo.ok).toBe(false);
    if (!ghostUndo.ok) expect(ghostUndo.code).toBe("NOT_FOUND");

    // نظافة يدوية — لم يُمس شيء.
    const stillThere = await prisma.appointment.findUnique({
      where: { id: manual.id },
    });
    expect(stillThere).not.toBeNull();
    await prisma.appointment.delete({ where: { id: manual.id } });
    await prisma.waitlistEntry.delete({ where: { id: manualEntry.id } });
  });
});
