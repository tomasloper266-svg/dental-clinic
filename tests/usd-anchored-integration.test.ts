// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma, getBasePrisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  tenantContextFromSession,
  type TenantContext,
} from "@/lib/tenant/context";
import {
  createLedgerEntry,
  listLedgerEntries,
  computeBalance,
} from "@/lib/services/ledger";
import { buildSnapshot, restoreSnapshot } from "@/lib/services/backup";
import { updateProfile } from "@/lib/services/account";
import {
  LEGACY_SNAPSHOT_VERSION,
  type ClinicSnapshot,
} from "@/lib/backup-schema";

// اختبارات تكامل قلب الأساس — الدولار وحدة التخزين والليرة مشتقة:
// استعادة لقطة قديمة (ليرة)، وقبول الكسور، وتغيير السعر لا يكتب أي مبلغ
// مخزن، وتوازن الدفتر فوق تغيّر السعر. تحتاج قاعدة بيانات حقيقية، تُتخطى
// بدون DATABASE_URL (نمط باقي اختبارات التكامل).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE = "0935555001";
const PASSWORD = "usd-anchored-pass";

let clinicId = "";
let userId = "";
let patientId = "";
let ctx: TenantContext;

async function cleanDb(): Promise<void> {
  if (!clinicId) return;
  const entries = await prisma.ledgerEntry.findMany({
    where: { clinicId },
    select: { id: true },
  });
  await prisma.ledgerEntryItem.deleteMany({
    where: { entryId: { in: entries.map((e) => e.id) } },
  });
  await prisma.ledgerEntry.deleteMany({ where: { clinicId } });
  await prisma.instructionSend.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.deleteMany({ where: { id: clinicId } });
}

/** نقي — يعكس لقطة v2 (دولار) إلى لقطة v1 (ليرة) بسعر محدد — لمحاكاة نسخة قديمة */
function deconvertToLegacyV1(snapshot: ClinicSnapshot, rate: number): unknown {
  const strip = (rows: Record<string, unknown>[], field: string) =>
    rows.map((row) => {
      const { [field]: usd, ...rest } = row;
      return {
        ...rest,
        [`${field.slice(0, -3)}Syp`]: usd === null ? null : Number(usd) * rate,
      };
    });
  return {
    ...snapshot,
    version: LEGACY_SNAPSHOT_VERSION,
    clinic: {
      ...snapshot.clinic,
      openingBalance: snapshot.clinic.openingBalance * rate,
    },
    ledgerEntries: strip(snapshot.ledgerEntries, "amountUsd"),
    ledgerEntryItems: strip(snapshot.ledgerEntryItems, "amountUsd"),
    expenses: strip(snapshot.expenses, "amountUsd"),
    materials: strip(snapshot.materials, "costUsd"),
    treatmentPlanItems: strip(snapshot.treatmentPlanItems, "priceUsd"),
  };
}

describeDb("قلب الأساس إلى الدولار — integration", () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة قلب الأساس", usdRate: 15000 },
    });
    clinicId = clinic.id;
    const user = await prisma.user.create({
      data: {
        clinicId,
        name: "د. أساس",
        phone: PHONE,
        passwordHash,
        role: "DENTIST",
      },
    });
    userId = user.id;
    const patient = await prisma.patient.create({
      data: { clinicId, name: "مريض الأساس", fileNo: 951 },
    });
    patientId = patient.id;
    ctx = tenantContextFromSession({
      userId,
      clinicId,
      name: "د. أساس",
      lockEnabled: false,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await cleanDb();
    await prisma.$disconnect();
  });

  it("الكسور الدولارية بمنزلتين تُخزَّن وتُقرأ بلا تقريب (رسوم 4.50 ودفع 12.25)", async () => {
    const charge = await createLedgerEntry(ctx, {
      patientId,
      type: "CHARGE",
      amountUsd: 4.5,
    });
    expect(charge).not.toBeNull();
    const payment = await createLedgerEntry(ctx, {
      patientId,
      type: "PAYMENT",
      amountUsd: -12.25,
    });
    expect(payment).not.toBeNull();

    const stored = await prisma.ledgerEntry.findMany({
      where: { patientId },
      select: { type: true, amountUsd: true },
    });
    const chargeRow = stored.find((r) => r.type === "CHARGE");
    const paymentRow = stored.find((r) => r.type === "PAYMENT");
    expect(Number(chargeRow?.amountUsd)).toBe(4.5);
    expect(Number(paymentRow?.amountUsd)).toBe(-12.25);

    const dto = await listLedgerEntries(ctx, patientId);
    expect(dto.entries.find((e) => e.type === "CHARGE")?.amountUsd).toBe(4.5);
    expect(dto.entries.find((e) => e.type === "PAYMENT")?.amountUsd).toBe(
      -12.25,
    );
  });

  it("تغيير السعر من الإعدادات لا يكتب أي مبلغ مخزن — والدولار ثابت والرصيد كذلك", async () => {
    const charge = await createLedgerEntry(ctx, {
      patientId,
      type: "CHARGE",
      amountUsd: 100,
      note: "رسوم ثابتة",
    });
    expect(charge).not.toBeNull();

    const before = await prisma.ledgerEntry.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
      select: { amountUsd: true },
    });

    const update = await updateProfile(ctx, { usdRate: 25000 });
    expect(update.ok).toBe(true);
    const rate = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { usdRate: true },
    });
    expect(rate.usdRate).toBe(25000);

    const after = await prisma.ledgerEntry.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
      select: { amountUsd: true },
    });
    expect(after.map((r) => Number(r.amountUsd))).toEqual(
      before.map((r) => Number(r.amountUsd)),
    );
    expect(Number(after[after.length - 1]!.amountUsd)).toBe(100);

    const dto = await listLedgerEntries(ctx, patientId);
    expect(dto.balance).toBe(
      computeBalance([
        { amountUsd: 4.5 },
        { amountUsd: -12.25 },
        { amountUsd: 100 },
      ]),
    );
  });

  it("تسوية ودفع جزئي فوق فاتورة يبقيان الدفتر متوازناً فوق تغيّر السعر بين العمليات", async () => {
    // الرصيد الحالي: 4.50 - 12.25 + 100 = 92.25
    const discount = await createLedgerEntry(ctx, {
      patientId,
      type: "ADJUSTMENT",
      amountUsd: -5,
      note: "خصم",
    });
    expect(discount).not.toBeNull();

    // تغيير السعر بين الخصم والدفع — لا يجوز أن يمس أي مبلغ مخزن
    await updateProfile(ctx, { usdRate: 20000 });

    const partial = await createLedgerEntry(ctx, {
      patientId,
      type: "PAYMENT",
      amountUsd: -30,
      note: "دفعة جزئية",
    });
    expect(partial).not.toBeNull();

    const dto = await listLedgerEntries(ctx, patientId);
    // 4.50 + 100 - 5 - 12.25 - 30 = 57.25 — متوازنة بغض النظر عن السعر
    expect(dto.balance).toBeCloseTo(57.25, 10);

    const stored = await prisma.ledgerEntry.findMany({
      where: { patientId },
      select: { amountUsd: true },
    });
    const sum = stored.reduce((acc, r) => acc + Number(r.amountUsd), 0);
    expect(Math.round(sum * 100) / 100).toBe(57.25);
  });

  it("استعادة لقطة قديمة (v1، ليرة) تحول مبالغها إلى دولار بسعر اللقطة نفسه", async () => {
    const snapshot = await buildSnapshot(getBasePrisma(), clinicId);
    expect(snapshot.version).not.toBe(LEGACY_SNAPSHOT_VERSION);
    // عكس التحويل بسعر اللقطة المحفوظ نفسه — كما في نسخة حقيقية أخذت بهذا السعر
    const legacy = deconvertToLegacyV1(snapshot, snapshot.clinic.usdRate);
    const snapshotRate = snapshot.clinic.usdRate;

    const restore = await restoreSnapshot(getBasePrisma(), clinicId, legacy);
    expect(restore.ok).toBe(true);

    const stored = await prisma.ledgerEntry.findMany({
      where: { patientId },
      orderBy: { createdAt: "asc" },
      select: { amountUsd: true },
    });
    // 4.50 و12.25 و100 و-5 و-30 ليرة بسعر اللقطة 15000 — نفس الدولار المخزن
    expect(stored.map((r) => Number(r.amountUsd))).toEqual([
      4.5, -12.25, 100, -5, -30,
    ]);

    const dto = await listLedgerEntries(ctx, patientId);
    expect(dto.balance).toBeCloseTo(57.25, 10);

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { usdRate: true, openingBalance: true },
    });
    // سعر اللقطة يُعاد معها — والليرة تُشتق منه لا من سعر آخر لقطة
    expect(clinic.usdRate).toBe(snapshotRate);
  });
});
