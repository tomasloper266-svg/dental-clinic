// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { getReportsPeriodSummary } from "@/lib/services/reports-period";
import { presetRange } from "@/lib/reports-period-view";
import type { TenantContext } from "@/lib/tenant/context";

// اختبار تكامل حدود الأيام المحلية — قيود حقيقية في PostgreSQL على لحظات
// منتصف الليل بتوقيت العيادة (دمشق). 00:30 دمشق يوم 15 = 21:30 يوم 14
// بتوقيت UTC — الحساب القديم بـ UTC أوقعها في اليوم الخطأ.

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const DAY = "2026-11-15";

function atDamascus(day: string, hourLocal: number): Date {
  // دمشق حالياً +03:00 — نص المنطقة الزمنية نفسها مستعمل في الخدمة عبر Intl
  return new Date(`${day}T${String(hourLocal).padStart(2, "0")}:30:00+03:00`);
}

let clinicId = "";
let userId = "";
let patientId = "";
let ctx: TenantContext;

async function cleanDb(): Promise<void> {
  await prisma.session.deleteMany();
  await prisma.materialUsage.deleteMany();
  await prisma.toothFinding.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.treatmentPlanItem.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.instructionTemplate.deleteMany();
  await prisma.material.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();
}

async function seedCharge(patientId: string, amount: number, at: Date, seq: number) {
  return prisma.ledgerEntry.create({
    data: {
      clinicId,
      patientId,
      type: "CHARGE",
      amountUsd: amount,
      createdById: userId,
      createdAt: at,
      invoiceSeq: seq,
    },
  });
}

describeDb("تقرير الفترة — حدود الأيام المحلية (integration)", () => {
  beforeAll(async () => {
    await cleanDb();

    const clinic = await prisma.clinic.create({
      data: { name: "عيادة حدود الأيام" },
    });
    clinicId = clinic.id;

    const user = await prisma.user.create({
      data: {
        clinicId,
        name: "د. حدود",
        phone: "0935555555",
        passwordHash: await hashPassword("day-boundaries-pass"),
        role: "DENTIST",
      },
    });
    userId = user.id;

    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض حدود", phone: "0903555555" },
    });
    patientId = patient.id;

    ctx = tenantContextFromSession({
      userId,
      clinicId,
      name: "د. حدود",
      lockEnabled: false,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
  });

  it("نطاق مخصص (from=to=اليوم X): قيد 00:30 وقيد 23:30 بتوقيت دمشق يعدّان في اليوم X", async () => {
    await seedCharge(patientId, 1_000, atDamascus("2026-11-14", 12), 1); // يوم 14 محلياً — خارج النطاق
    const morning = await seedCharge(patientId, 2_000, atDamascus(DAY, 0), 2); // 00:30 دمشق يوم 15
    const night = await seedCharge(patientId, 3_000, atDamascus(DAY, 23), 3); // 23:30 دمشق يوم 15
    await seedCharge(patientId, 4_000, atDamascus("2026-11-16", 0), 4); // 00:30 دمشق يوم 16 — خارج النطاق

    const summary = await getReportsPeriodSummary(ctx, {
      from: DAY,
      to: DAY,
    });
    expect(summary.totalChargesUsd).toBe(5_000); // 2,000 + 3,000 حصراً
    expect(summary.invoiceCount).toBe(2);
    expect(morning.createdAt).toBeTruthy();
    expect(night.createdAt).toBeTruthy();
  });

  it("نطاق جاهز (30d منتهٍ باليوم X): القيود الثلاثة السابقة تعدّ في اليوم X", async () => {
    const range = presetRange("30d", DAY, "2026-11-01");
    expect(range.to).toBe(DAY);
    const summary = await getReportsPeriodSummary(ctx, range);
    // قيود 14 و15 (00:30 و23:30) = 6,000 — وقيد 00:30 من يوم 16 خارج نافذة
    // منتهية بيوم 15 حتى في الخيار الجاهز
    expect(summary.totalChargesUsd).toBe(6_000);
    expect(summary.invoiceCount).toBe(3);
  });

  it("النافذة اليومية للخدمة تستبعد قيود 00:30 من اليوم المجاور", async () => {
    // تنظيف جزئي — العيادة والمستخدم يبقيان وقيد الفترة السابقة يُحذف
    await prisma.ledgerEntry.deleteMany();
    await prisma.patient.deleteMany();
    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض حدود 2", phone: "0903555556" },
    });
    // قيد قديم خارج اليوم X كي يبقى «من» الفترة كما هو ولا يُقصّ بأقدم حركة
    await seedCharge(patient.id, 1_000, atDamascus("2026-11-13", 12), 1);
    // 00:30 دمشق يوم 16 = 21:30 يوم 15 بتوقيت UTC — القديم كان سيقبله ضمن اليوم 15
    await seedCharge(patient.id, 7_000, atDamascus("2026-11-16", 0), 2);

    const summary = await getReportsPeriodSummary(ctx, {
      from: DAY,
      to: DAY,
    });
    expect(summary.totalChargesUsd).toBe(0);
    expect(summary.invoiceCount).toBe(0);
  });
});
