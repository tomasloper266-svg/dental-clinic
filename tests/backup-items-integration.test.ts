// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma, getBasePrisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession, type TenantContext } from "@/lib/tenant/context";
import { createLedgerEntry, listLedgerEntries } from "@/lib/services/ledger";
import { buildSnapshot, restoreSnapshot } from "@/lib/services/backup";

// اختبارات تكامل النسخ الاحتياطي مع بنود الفاتورة (خطأ 9 من سجل الجولة
// art_iqrQRsE6) وترشيح الدفعة (خطأ 10) — تحتاج قاعدة بيانات حقيقية،
// تُتخطى بدون DATABASE_URL (نمط باقي اختبارات التكامل).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE = "0934444444";
const PHONE_B = "0934444555";
const PASSWORD = "backup-items-pass";

let clinicId = "";
let clinicBId = "";
let userId = "";
let userBId = "";
let patientId = "";
let patientBId = "";
let ctx: TenantContext;

async function cleanDb(): Promise<void> {
  // حذف محصور بعيادتي الاختبار — لا يمس أي بيانات أخرى في القاعدة
  const ids = [clinicId, clinicBId].filter(Boolean);
  if (ids.length === 0) return;
  const entries = await prisma.ledgerEntry.findMany({
    where: { clinicId: { in: ids } },
    select: { id: true },
  });
  await prisma.ledgerEntryItem.deleteMany({
    where: { entryId: { in: entries.map((e) => e.id) } },
  });
  await prisma.ledgerEntry.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.patient.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.user.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.clinic.deleteMany({ where: { id: { in: ids } } });
}

async function countItems(targetClinicId: string): Promise<number> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { clinicId: targetClinicId },
    select: { id: true },
  });
  return prisma.ledgerEntryItem.count({
    where: { entryId: { in: entries.map((e) => e.id) } },
  });
}

describeDb("النسخ الاحتياطي يحفظ بنود الفواتير — integration", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const [clinicA, clinicB] = await Promise.all([
      prisma.clinic.create({ data: { name: "عيادة نسخ البنود أ" } }),
      prisma.clinic.create({ data: { name: "عيادة نسخ البنود ب" } }),
    ]);
    clinicId = clinicA.id;
    clinicBId = clinicB.id;

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          clinicId,
          name: "د. نسخ",
          phone: PHONE,
          passwordHash,
          role: "DENTIST",
        },
      }),
      prisma.user.create({
        data: {
          clinicId: clinicBId,
          name: "د. ب",
          phone: PHONE_B,
          passwordHash,
          role: "DENTIST",
        },
      }),
    ]);
    userId = userA.id;
    userBId = userB.id;

    const [patientA, patientB] = await Promise.all([
      prisma.patient.create({
        data: { clinicId, name: "مريض بنود", fileNo: 901 },
      }),
      prisma.patient.create({
        data: { clinicId: clinicBId, name: "مريض ب", fileNo: 902 },
      }),
    ]);
    patientId = patientA.id;
    patientBId = patientB.id;

    ctx = tenantContextFromSession({
      userId,
      clinicId,
      name: "د. نسخ",
      lockEnabled: false,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
  });

  it("roundtrip: نسخة ← استعادة ← عدّاد بنود الفواتير لم يتغير والحقول سليمة", async () => {
    // قيد رسوم واحد ببندين مهيكلة — نفس صيغة الفاتورة متعددة البنود
    const charge = await createLedgerEntry(ctx, {
      patientId,
      type: "CHARGE",
      amountUsd: 100_000,
      note: "فاتورة — 2 بنود",
      items: [
        { description: "تبييض ليزر", category: "تبييض ليزر", amountUsd: 60_000 },
        { description: "حشو عصبي", category: "حشو عصبي", amountUsd: 40_000 },
      ],
    });
    expect(charge).not.toBeNull();
    expect(await countItems(clinicId)).toBe(2);

    const snapshot = await buildSnapshot(getBasePrisma(), clinicId);
    expect(snapshot.ledgerEntryItems).toHaveLength(2);
    expect(snapshot.ledgerEntryItems.every((row) => row.entryId === charge!.id)).toBe(true);

    const restore = await restoreSnapshot(getBasePrisma(), clinicId, snapshot);
    expect(restore.ok).toBe(true);
    if (restore.ok) expect(restore.counts.ledgerEntryItems).toBe(2);

    // العدّاد بعد الاستعادة كما كان قبلها — فقدان البنود كان الخطأ الموثق
    expect(await countItems(clinicId)).toBe(2);

    const rows = await prisma.ledgerEntryItem.findMany({
      where: { entryId: charge!.id },
      orderBy: { sort: "asc" },
    });
    expect(rows.map((r) => [r.description, r.category, Number(r.amountUsd), r.sort])).toEqual([
      ["تبييض ليزر", "تبييض ليزر", 60_000, 0],
      ["حشو عصبي", "حشو عصبي", 40_000, 1],
    ]);
  });

  it("نسخة قديمة بلا مفتاح ledgerEntryItems تُستعاد بلا خطأ (توافق v1 السابق)", async () => {
    const snapshot = await buildSnapshot(getBasePrisma(), clinicId);
    const legacy = { ...snapshot } as Record<string, unknown>;
    delete legacy.ledgerEntryItems;
    const restore = await restoreSnapshot(getBasePrisma(), clinicId, legacy);
    expect(restore.ok).toBe(true);
    expect(await countItems(clinicId)).toBe(0);
  });

  it("عزل العيادة: نسخة العيادة أ لا تحوي بنود قيود العيادة ب", async () => {
    const ctxB = tenantContextFromSession({
      userId: userBId,
      clinicId: clinicBId,
      name: "د. ب",
      lockEnabled: false,
      role: "DENTIST",
    });
    await createLedgerEntry(ctxB, {
      patientId: patientBId,
      type: "CHARGE",
      amountUsd: 5_000,
      items: [{ description: "بند عيادة ب", amountUsd: 5_000 }],
    });
    const snapshot = await buildSnapshot(getBasePrisma(), clinicId);
    expect(
      snapshot.ledgerEntryItems.some(
        (row) => row.description === "بند عيادة ب",
      ),
    ).toBe(false);
    // والاستعادة لا تعيد بنود العيادة ب إلى العيادة أ
    const restore = await restoreSnapshot(getBasePrisma(), clinicId, snapshot);
    expect(restore.ok).toBe(true);
    const entriesA = await prisma.ledgerEntry.findMany({
      where: { clinicId },
      select: { id: true },
    });
    const itemsA = await prisma.ledgerEntryItem.findMany({
      where: { entryId: { in: entriesA.map((e) => e.id) } },
    });
    expect(itemsA.every((row) => row.description !== "بند عيادة ب")).toBe(true);
  });

  it("دفعة بـappliedChargeId تُخزَّن فعلياً ومعادلة الرصيد الزمني لا تتأثر", async () => {
    // مريض مخصص للاختبار — الاختبارات السابقة أعادت تركيبة قيود المريض المشترك
    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض التخصيص", fileNo: 903 },
    });
    const charge = await createLedgerEntry(ctx, {
      patientId: patient.id,
      type: "CHARGE",
      amountUsd: 100_000,
      note: "فاتورة اختبار التخصيص",
    });
    const payment = await createLedgerEntry(ctx, {
      patientId: patient.id,
      type: "PAYMENT",
      amountUsd: -40_000,
      note: "دفعة نقدا — سداد الفاتورة",
      appliedChargeId: charge!.id,
    });
    expect(payment).not.toBeNull();
    expect(payment!.appliedChargeId).toBe(charge!.id);

    // الرصيد زمني دائماً — التخصيص ترشيح عرض حصراً: 100,000 − 40,000
    const { balance } = await listLedgerEntries(ctx, patient.id);
    expect(balance).toBe(60_000);
  });
});
