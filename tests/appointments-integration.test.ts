// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { createAppointment } from "@/lib/services/appointments";
import { changeAppointmentStatus } from "@/lib/services/appointment-state";
import {
  addToWaitlist,
  bookFromWaitlist,
  listOpenGaps,
  WORK_DAY_END_UTC_HOUR,
  WORK_DAY_START_UTC_HOUR,
} from "@/lib/services/waitlist";
import { dayRange } from "@/lib/dates";
import type { TenantContext } from "@/lib/tenant/context";

// اختبارات التكامل تحتاج قاعدة بيانات حقيقية — تُتخطى إن لم يتوفر DATABASE_URL
// (نمط اختبارات عزل المستأجرين). تنشئ عيادتها الخاصة وتنظف بعدها.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

// يوم اختبار ثابت — الاثنين 15 يونيو 2026.
const DAY = Date.UTC(2026, 5, 15);
const at = (h: number, m: number) => new Date(DAY + h * 3_600_000 + m * 60_000);

const PHONE = "0933333333";
const PASSWORD = "integration-pass-1";

let clinicId = "";
let userId = "";
let patientId = "";
let ctx: TenantContext;

async function cleanClinicData(): Promise<void> {
  await prisma.appointmentStatusChange.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.waitlistEntry.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.deleteMany({ where: { id: clinicId } });
}

describeDb("المواعيد وقائمة الانتظار — integration", () => {
  beforeAll(async () => {
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة مواعيد (اختبار)" },
    });
    clinicId = clinic.id;
    const user = await prisma.user.create({
      data: {
        clinicId,
        name: "د. اختبار",
        phone: PHONE,
        passwordHash: await hashPassword(PASSWORD),
        role: "DENTIST",
      },
    });
    userId = user.id;
    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض مواعيد", phone: "0944444444" },
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

  it("حجز فترة مشغولة يُرفض — تداخل جزئي وكلي", async () => {
    const first = await createAppointment(ctx, {
      patientId,
      startsAt: at(10, 0),
      durationMin: 30,
      reason: "كشف",
    });
    expect(first.ok).toBe(true);

    const overlapping = await createAppointment(ctx, {
      patientId,
      startsAt: at(10, 15),
      durationMin: 30,
    });
    expect(overlapping.ok).toBe(false);
    if (!overlapping.ok) expect(overlapping.code).toBe("CONFLICT");

    // موعد يبدأ أثناء الفترة المشغولة ويمتد بعدها — يجب رفضه أيضاً.
    const startingInside = await createAppointment(ctx, {
      patientId,
      startsAt: at(10, 15),
      durationMin: 120,
    });
    expect(startingInside.ok).toBe(false);
  });

  it("الموعد الملغي والمكتمل لا يحجزان الفترة", async () => {
    const ten = await prisma.appointment.findFirstOrThrow({
      where: { clinicId, startsAt: at(10, 0) },
    });
    const moved = await changeAppointmentStatus(ctx, ten.id, "CANCELLED");
    expect(moved.ok).toBe(true);

    const rebooked = await createAppointment(ctx, {
      patientId,
      startsAt: at(10, 15),
      durationMin: 30,
    });
    expect(rebooked.ok).toBe(true);
  });

  it("انتقال غير مسموح يُرفض والحالة تبقى كما هي", async () => {
    const created = await createAppointment(ctx, {
      patientId,
      startsAt: at(11, 0),
      durationMin: 30,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const skipped = await changeAppointmentStatus(
      ctx,
      created.value.id,
      "COMPLETED",
    );
    expect(skipped.ok).toBe(false);
    if (!skipped.ok) expect(skipped.code).toBe("INVALID");

    const inDb = await prisma.appointment.findUnique({
      where: { id: created.value.id },
    });
    expect(inDb?.status).toBe("SCHEDULED");
  });

  it("انتقال مسموح ينجح ويُسجل من/إلى ومَن ومتى", async () => {
    const created = await createAppointment(ctx, {
      patientId,
      startsAt: at(12, 0),
      durationMin: 30,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const confirmed = await changeAppointmentStatus(
      ctx,
      created.value.id,
      "CONFIRMED",
    );
    expect(confirmed.ok).toBe(true);

    const inTreatment = await changeAppointmentStatus(
      ctx,
      created.value.id,
      "IN_TREATMENT",
    );
    expect(inTreatment.ok).toBe(true);

    const changes = await prisma.appointmentStatusChange.findMany({
      where: { appointmentId: created.value.id },
      orderBy: { createdAt: "asc" },
    });
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      clinicId,
      fromStatus: "SCHEDULED",
      toStatus: "CONFIRMED",
      changedById: userId,
    });
    expect(changes[1].fromStatus).toBe("CONFIRMED");
    expect(changes[1].toStatus).toBe("IN_TREATMENT");
  });

  it("عيادة أخرى لا ترى ولا تغيّر موعد العيادة الأولى", async () => {
    const otherClinic = await prisma.clinic.create({
      data: { name: "عيادة أخرى (اختبار)" },
    });
    const otherUser = await prisma.user.create({
      data: {
        clinicId: otherClinic.id,
        name: "د. آخر",
        phone: "0955555555",
        passwordHash: await hashPassword(PASSWORD),
        role: "DENTIST",
      },
    });
    const otherCtx = tenantContextFromSession({
      userId: otherUser.id,
      clinicId: otherClinic.id,
      name: otherUser.name,
      role: "DENTIST",
    });

    const mine = await prisma.appointment.findFirstOrThrow({
      where: { clinicId },
    });

    const changed = await changeAppointmentStatus(
      otherCtx,
      mine.id,
      "CANCELLED",
    );
    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.code).toBe("NOT_FOUND");

    const booked = await createAppointment(otherCtx, {
      patientId, // مريض العيادة الأولى!
      startsAt: at(13, 0),
      durationMin: 30,
    });
    expect(booked.ok).toBe(false);

    await prisma.user.delete({ where: { id: otherUser.id } });
    await prisma.clinic.delete({ where: { id: otherClinic.id } });
  });

  it("إلغاء موعد يفتح فجوة تُقترح، ومريض الانتظار يُحجز فيها بضغطة", async () => {
    // قيد انتظار يطلب صباحاً.
    const entry = await addToWaitlist(ctx, {
      patientId,
      preferredWindow: "صباح الاثنين",
      priority: 2,
    });
    expect(entry.ok).toBe(true);

    // ساعات العمل (UTC) — نستخدمها لحساب الفجوات.
    const [dayStart] = dayRange(at(12, 0));
    const windowStart = new Date(
      dayStart.getTime() + WORK_DAY_START_UTC_HOUR * 3_600_000,
    );
    const windowEnd = new Date(
      dayStart.getTime() + WORK_DAY_END_UTC_HOUR * 3_600_000,
    );

    // نلغي موعد 10:15 (ما زال محجوزاً — الحالة قيد العلاج لا تقبل الإلغاء)
    // فتظهر فجوته في المقترحات.
    const morning = await prisma.appointment.findFirstOrThrow({
      where: { clinicId, startsAt: at(10, 15) },
    });
    const cancelled = await changeAppointmentStatus(
      ctx,
      morning.id,
      "CANCELLED",
    );
    expect(cancelled.ok).toBe(true);

    const gaps = await listOpenGaps(ctx, windowStart, windowEnd);
    const openedGap = gaps.find(
      (g) =>
        g.start.getTime() <= at(10, 15).getTime() &&
        g.end.getTime() >= at(10, 45).getTime(),
    );
    expect(openedGap).toBeDefined();
    if (!openedGap) return;

    // الحجز بضغطة: المريض من الانتظار داخل الفجوة المفتوحة.
    if (!entry.ok) throw new Error("waitlist entry was not created");
    const booked = await bookFromWaitlist(ctx, {
      waitlistEntryId: entry.value.id,
      startsAt: at(10, 15),
      durationMin: 30,
    });
    expect(booked.ok).toBe(true);

    // القيد صار BOOKED ومحاولة حجز ثانية تُرفض.
    const listAfter = await prisma.waitlistEntry.findUniqueOrThrow({
      where: { id: entry.value.id },
    });
    expect(listAfter.status).toBe("BOOKED");

    const again = await bookFromWaitlist(ctx, {
      waitlistEntryId: entry.value.id,
      startsAt: at(14, 0),
      durationMin: 30,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("INVALID");

    // الحجز بمعرف قيد غير موجود يُرفض (404 على مستوى الخدمة).
    const missing = await bookFromWaitlist(ctx, {
      waitlistEntryId: "غير-موجود",
      startsAt: at(14, 0),
      durationMin: 30,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("NOT_FOUND");
  });
});
