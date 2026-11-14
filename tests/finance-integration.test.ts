// @vitest-environment node
import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import {
  createLedgerEntry,
  listLedgerEntries,
  recordTreatmentCharge,
} from "@/lib/services/ledger";
import { createExpense } from "@/lib/services/expenses";
import { getDailyReport } from "@/lib/services/reports";
import {
  GET as ledgerGET,
  POST as ledgerPOST,
} from "@/app/api/patients/[patientId]/ledger/route";
import { POST as expensesPOST } from "@/app/api/expenses/route";
import { GET as expensesGET } from "@/app/api/expenses/route";
import { GET as reportsGET } from "@/app/api/reports/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import type { TenantContext } from "@/lib/tenant/context";

// اختبارات تكامل الحسابات — تحتاج قاعدة بيانات حقيقية، تُتخطى بدون DATABASE_URL.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE_A = "0931111111";
const PHONE_B = "0932222222";
const PASSWORD = "finance-integration-pass";

let clinicAId = "";
let clinicBId = "";
let patientAId = "";
let patientBId = "";
let userAId = "";
let ctxA: TenantContext;
let ctxB: TenantContext;

function loginRequest(phone: string, password: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
}

function authedRequest(
  url: string,
  token: string,
  init?: { method?: string; body?: string },
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      cookie: `session=${token}`,
    },
    body: init?.body,
  });
}

async function loginToken(phone: string, password: string): Promise<string> {
  const res = await loginPOST(loginRequest(phone, password));
  const token = res.cookies.get("session")?.value;
  if (!token) throw new Error(`login failed for ${phone}`);
  return token;
}

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

describeDb("الحسابات — integration", () => {
  beforeAll(async () => {
    await cleanDb();

    const passwordHash = await hashPassword(PASSWORD);
    const [clinicA, clinicB] = await Promise.all([
      prisma.clinic.create({ data: { name: "عيادة حسابات أ" } }),
      prisma.clinic.create({ data: { name: "عيادة حسابات ب" } }),
    ]);
    clinicAId = clinicA.id;
    clinicBId = clinicB.id;

    const [userA, userB, patientA, patientB] = await Promise.all([
      prisma.user.create({
        data: {
          clinicId: clinicAId,
          name: "د. فارس",
          phone: PHONE_A,
          passwordHash,
          role: "DENTIST",
        },
      }),
      prisma.user.create({
        data: {
          clinicId: clinicBId,
          name: "د. هاني",
          phone: PHONE_B,
          passwordHash,
          role: "DENTIST",
        },
      }),
      prisma.patient.create({
        data: { clinicId: clinicAId, name: "مريض-حسابات-أ", phone: "0903111111" },
      }),
      prisma.patient.create({
        data: { clinicId: clinicBId, name: "مريض-حسابات-ب", phone: "0903222222" },
      }),
    ]);
    userAId = userA.id;
    patientAId = patientA.id;
    patientBId = patientB.id;

    ctxA = tenantContextFromSession({
      userId: userA.id,
      clinicId: clinicAId,
      name: "د. فارس",
      lockEnabled: false,
role: "DENTIST",
    });
    ctxB = tenantContextFromSession({
      userId: userB.id,
      clinicId: clinicBId,
      name: "د. هاني",
      lockEnabled: false,
role: "DENTIST",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("إنشاء قيد عبر الـ endpoint يخزنه بعيادة الجلسة (201)", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await ledgerPOST(
      authedRequest(`/api/patients/${patientAId}/ledger`, token, {
        method: "POST",
        body: JSON.stringify({ type: "CHARGE", amountSyp: 100_000 }),
      }),
      { params: Promise.resolve({ patientId: patientAId }) },
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { entry: { id: string } };
    const stored = await prisma.ledgerEntry.findUnique({
      where: { id: body.entry.id },
    });
    expect(stored?.clinicId).toBe(clinicAId);
    expect(stored?.createdById).toBe(userAId);
  });

  it("دفتر مختلط يعطي الرصيد الصحيح من مجموع القيود", async () => {
    // رصيد قبل الاختبار — القيود تراكم عبر الاختبارات على نفس المريض
    const before = await listLedgerEntries(ctxA, patientAId);

    await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "CHARGE",
      amountSyp: 500_000,
      note: "حشو 26",
    });
    await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "PAYMENT",
      amountSyp: -200_000,
    });
    await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "ADJUSTMENT",
      amountSyp: -50_000,
    });
    await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "REFUND",
      amountSyp: 25_000,
    });

    const ledger = await listLedgerEntries(ctxA, patientAId);
    expect(ledger.balance).toBe(
      before.balance + 500_000 - 200_000 - 50_000 + 25_000,
    );
  });

  it("GET الدفتر عبر الـ endpoint يعيد القيود والرصيد", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await ledgerGET(
      authedRequest(`/api/patients/${patientAId}/ledger`, token),
      { params: Promise.resolve({ patientId: patientAId }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      balance: number;
      entries: Array<{ type: string; amountSyp: number }>;
    };
    expect(body.entries.length).toBeGreaterThanOrEqual(5);
    // رصيد الـ endpoint يطابق المجموع الفعلي للقيود في القاعدة
    const rows = await prisma.ledgerEntry.findMany({
      where: { patientId: patientAId },
      select: { amountSyp: true },
    });
    expect(body.balance).toBe(rows.reduce((s, r) => s + r.amountSyp, 0));
  });

  it("لا endpoint يعدل أو يحدّث قيداً — ولا حذف إلا للفاتورة غير المخصَّصة", async () => {
    // في Next.js غياب الـ handler يعني 405 تلقائياً على مستوى الإطار؛
    // الاختبار يثبت غياب المُصدرين نفسهما فلا مسار تعديل أو تحديث أصلاً.
    const routeModule = (await import(
      "@/app/api/patients/[patientId]/ledger/route"
    )) as unknown as Record<string, unknown>;
    expect(routeModule.PUT).toBeUndefined();
    expect(routeModule.PATCH).toBeUndefined();
    // مسار القائمة بلا حذف — الحذف الوحيد على قيد واحد فقط.
    expect(routeModule.DELETE).toBeUndefined();

    // والخدمة بلا أي دالة تحديث — التصحيح بقيد عكسي فقط. الاستثناء الوحيد
    // هو حذف فاتورة غير مخصَّصة (بلا دفعات ولا خصم)، والحذف على قيد واحد.
    const entryRouteModule = (await import(
      "@/app/api/patients/[patientId]/ledger/[entryId]/route"
    )) as unknown as Record<string, unknown>;
    expect(entryRouteModule.PUT).toBeUndefined();
    expect(entryRouteModule.PATCH).toBeUndefined();
    expect(typeof entryRouteModule.DELETE).toBe("function");

    const service = await import("@/lib/services/ledger");
    const exported = Object.keys(service).filter((k) =>
      /update|delete/i.test(k),
    );
    expect(exported).toEqual(["deleteUnallocatedCharge"]);
  });

  it("قراءة دفتر مريض عيادة ب بجلسة عيادة أ ترجع دفتراً فارغاً", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await ledgerGET(
      authedRequest(`/api/patients/${patientBId}/ledger`, token),
      { params: Promise.resolve({ patientId: patientBId }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      balance: number;
      entries: unknown[];
    };
    expect(body.entries).toHaveLength(0);
    expect(body.balance).toBe(0);
  });

  it("إنشاء قيد لمريض عيادة ب بجلسة عيادة أ يُرفض (404) ولا يُخزن شيء", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await ledgerPOST(
      authedRequest(`/api/patients/${patientBId}/ledger`, token, {
        method: "POST",
        body: JSON.stringify({ type: "CHARGE", amountSyp: 999_999 }),
      }),
      { params: Promise.resolve({ patientId: patientBId }) },
    );
    expect(res.status).toBe(404);
    const rows = await prisma.ledgerEntry.findMany({
      where: { patientId: patientBId },
    });
    expect(rows).toHaveLength(0);
  });

  it("قيد الرسوم التلقائي عند اكتمال علاج مخطط يُنشأ مرة واحدة فقط", async () => {
    const item = await prisma.treatmentPlanItem.create({
      data: {
        clinicId: clinicAId,
        patientId: patientAId,
        toothFdi: 26,
        procedure: "حشو عصب",
        priceSyp: 750_000,
        status: "DONE",
      },
    });

    const first = await recordTreatmentCharge(ctxA, {
      patientId: patientAId,
      treatmentItemId: item.id,
      procedure: "حشو عصب",
      priceSyp: 750_000,
    });
    expect(first.alreadyCharged).toBe(false);
    expect(first.entry?.amountSyp).toBe(750_000);
    expect(first.entry?.treatmentItemId).toBe(item.id);

    const second = await recordTreatmentCharge(ctxA, {
      patientId: patientAId,
      treatmentItemId: item.id,
      procedure: "حشو عصب",
      priceSyp: 750_000,
    });
    expect(second.alreadyCharged).toBe(true);
    expect(second.entry?.id).toBe(first.entry?.id);

    const rows = await prisma.ledgerEntry.findMany({
      where: { treatmentItemId: item.id },
    });
    expect(rows).toHaveLength(1);
  });

  it("إنشاء مصروف بفئة صالحة عبر الـ endpoint (201) ويظهر في القائمة", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await expensesPOST(
      authedRequest("/api/expenses", token, {
        method: "POST",
        body: JSON.stringify({
          category: "MATERIALS",
          amountSyp: 120_000,
          note: "مادة حشو",
        }),
      }),
    );
    expect(res.status).toBe(201);

    const listRes = await expensesGET(authedRequest("/api/expenses", token));
    expect(listRes.status).toBe(200);
    const body = (await listRes.json()) as {
      expenses: Array<{ category: string; amountSyp: number }>;
    };
    expect(
      body.expenses.some((e) => e.category === "MATERIALS" && e.amountSyp === 120_000),
    ).toBe(true);
  });

  it("مصروف عيادة ب لا يظهر في قائمة عيادة أ", async () => {
    await createExpense(ctxB, { category: "RENT", amountSyp: 900_000 });

    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await expensesGET(authedRequest("/api/expenses", token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      expenses: Array<{ amountSyp: number }>;
    };
    expect(body.expenses.some((e) => e.amountSyp === 900_000)).toBe(false);
  });

  it("التقرير اليومي يجمع التحصيل والمصاريف والصافي لليوم فقط", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    // حركة اليوم عبر الخدمة (createdAt = الآن)
    await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "PAYMENT",
      amountSyp: -300_000,
    });
    await createExpense(ctxA, {
      category: "SALARIES",
      amountSyp: 100_000,
      spentAt: today,
    });
    // مصروف الأمس لا يدخل تقرير اليوم
    await prisma.expense.create({
      data: {
        clinicId: clinicAId,
        category: "OTHER",
        amountSyp: 777_777,
        spentAt: yesterday,
      },
    });

    const report = await getDailyReport(ctxA, today);
    expect(report.collectedSyp).toBeGreaterThanOrEqual(300_000);
    expect(report.expensesSyp).toBeGreaterThanOrEqual(100_000);
    expect(report.expensesSyp).toBeLessThan(777_777);
    expect(report.netSyp).toBe(report.collectedSyp - report.refundsSyp - report.expensesSyp);
  });

  it("التقرير الشهري عبر الـ endpoint يجمع عيادة أ حصراً", async () => {
    // مصروف عيادة ب في نفس الشهر — يجب ألا يدخل تقرير عيادة أ
    await prisma.expense.create({
      data: {
        clinicId: clinicBId,
        category: "RENT",
        amountSyp: 500_000,
        spentAt: new Date(),
      },
    });

    const token = await loginToken(PHONE_A, PASSWORD);
    const now = new Date();
    const res = await reportsGET(
      authedRequest(
        `/api/reports?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`,
        token,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: { expensesSyp: number } };

    // القيمة المتوقعة: مجموع مصاريف عيادة أ في الشهر — من قاعدة البيانات مباشرة
    const { monthRange } = await import("@/lib/services/reports");
    const { from, to } = monthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
    const expected = await prisma.expense.aggregate({
      where: { clinicId: clinicAId, spentAt: { gte: from, lt: to } },
      _sum: { amountSyp: true },
    });
    expect(body.report.expensesSyp).toBe(expected._sum.amountSyp ?? 0);
    expect(body.report.expensesSyp).not.toBe(
      (expected._sum.amountSyp ?? 0) + 500_000,
    );
  });

  it("التقرير بدون جلسة يُرفض (401)", async () => {
    const res = await reportsGET(
      new NextRequest("http://localhost/api/reports"),
    );
    expect(res.status).toBe(401);
  });

  // فجوة 1: إسناد الطبيب المحفوظ — قيمة تخزينية تُقدَّم على أي استنتاج لاحق.
  it("قيد رسوم على موعد مُسند للطبيب يُخزن doctorId من الموعد نفسه", async () => {
    const staff = await prisma.staffMember.create({
      data: { clinicId: clinicAId, name: "د. خالد" },
    });
    await prisma.appointment.create({
      data: {
        clinicId: clinicAId,
        patientId: patientAId,
        staffId: staff.id,
        startsAt: new Date(Date.now() - 60 * 60_000),
      },
    });

    const entry = await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "CHARGE",
      amountSyp: 120_000,
    });
    expect(entry).not.toBeNull();
    expect(entry?.doctorId).toBe(staff.id);
  });

  it("إسناد صريح لطبيب عيادة أخرى يُرفض", async () => {
    const staffB = await prisma.staffMember.create({
      data: { clinicId: clinicBId, name: "د. رنا" },
    });
    const entry = await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "CHARGE",
      amountSyp: 120_000,
      doctorId: staffB.id,
    });
    expect(entry).toBeNull();
  });

  // فجوة 2: بنود الفاتورة — من بند الخطة عند القيد التلقائي، ومجموع مخالف يُرفض.
  it("القيد التلقائي ينشئ بند فاتورة من بند الخطة بمبلغ يساوي القيد", async () => {
    const item = await prisma.treatmentPlanItem.create({
      data: {
        clinicId: clinicAId,
        patientId: patientAId,
        toothFdi: 16,
        procedure: "خلع ضرس",
        priceSyp: 250_000,
        status: "DONE",
      },
    });
    const { entry } = await recordTreatmentCharge(ctxA, {
      patientId: patientAId,
      treatmentItemId: item.id,
      procedure: "خلع ضرس",
      priceSyp: 250_000,
    });
    expect(entry).not.toBeNull();
    const rows = await prisma.ledgerEntryItem.findMany({
      where: { entryId: entry!.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("خلع ضرس");
    expect(rows[0].amountSyp).toBe(250_000);
  });

  it("بنود لا تجمع مبلغ القيد تُرفض ولا يُخزن شيء", async () => {
    const beforeCount = await prisma.ledgerEntry.count({
      where: { patientId: patientAId, type: "CHARGE" },
    });

    await expect(
      createLedgerEntry(ctxA, {
        patientId: patientAId,
        type: "CHARGE",
        amountSyp: 100_000,
        items: [
          { description: "حشو", amountSyp: 60_000 },
          { description: "تنظيف", amountSyp: 30_000 },
        ],
      }),
    ).rejects.toThrow();

    const afterCount = await prisma.ledgerEntry.count({
      where: { patientId: patientAId, type: "CHARGE" },
    });
    expect(afterCount).toBe(beforeCount); // المرفوض بلا أثر — لا قيد جديد
  });

  // فجوة 3: الدفعة المخصصة ترشيح عرض — الرصيد زمني دائماً ولا يتأثر.
  it("دفعة بـ appliedChargeId لا تغير الرصيد المحسوب", async () => {
    const charge = await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "CHARGE",
      amountSyp: 80_000,
    });
    expect(charge).not.toBeNull();

    const before = await listLedgerEntries(ctxA, patientAId);
    const payment = await createLedgerEntry(ctxA, {
      patientId: patientAId,
      type: "PAYMENT",
      amountSyp: -80_000,
      appliedChargeId: charge!.id,
    });
    expect(payment).not.toBeNull();
    expect(payment?.appliedChargeId).toBe(charge!.id);

    const after = await listLedgerEntries(ctxA, patientAId);
    // الدفعة تدخل الرصيد بمبلغها كأي دفعة — لكن التخصيص نفسه لا يغير شيئاً:
    // الرصيد مجموع القيود الموقعة حصراً (معادلة الرصيد).
    expect(after.balance).toBe(before.balance - 80_000);
    const stored = await prisma.ledgerEntry.findUnique({
      where: { id: payment!.id },
      select: { appliedChargeId: true },
    });
    expect(stored?.appliedChargeId).toBe(charge!.id);
  });

  // فجوة 7: التكلفة الكسرية تُخزن بعشرية ثابتة لا تُقرَّب.
  it("مادة بتكلفة 4.5 تُخزن وتُقرأ 4.50", async () => {
    const material = await prisma.material.create({
      data: {
        clinicId: clinicAId,
        name: "مادة اختبار عشرية",
        unit: "علبة",
        costSyp: 4.5,
      },
    });
    const stored = await prisma.$queryRaw<[{ text: string }]>(
      Prisma.sql`SELECT "costSyp"::text AS text FROM "Material" WHERE id = ${material.id}`,
    );
    expect(stored[0].text).toBe("4.50");
    const read = await prisma.material.findUnique({
      where: { id: material.id },
      select: { costSyp: true },
    });
    expect(read?.costSyp?.toNumber()).toBe(4.5);
  });
});
