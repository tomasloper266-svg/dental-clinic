// @vitest-environment node
import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import {
  isLowStock,
  parseCreateMaterial,
  parseUpdateMaterial,
  parseSupplyInput,
  parseUsageInput,
} from "@/lib/services/inventory";
import {
  GET as materialsGET,
  POST as materialsPOST,
} from "@/app/api/materials/route";
import { PATCH as materialPATCH } from "@/app/api/materials/[materialId]/route";
import { POST as supplyPOST } from "@/app/api/materials/[materialId]/supply/route";
import { POST as usagePOST } from "@/app/api/materials/[materialId]/usage/route";
import { GET as movementsGET } from "@/app/api/materials/[materialId]/movements/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import type { TenantContext } from "@/lib/tenant/context";

// اختبارات المخزون — وحدوية للمحللات والتنبيه، وتكاملية لقاعدة بيانات حقيقية
// (تُتخطى بدون DATABASE_URL): الخصم والرفض والتنبيه والعزل.

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE_A = "0941111111";
const PHONE_B = "0942222222";
const PASSWORD = "inventory-integration-pass";

let clinicAId = "";
let clinicBId = "";
let patientAId = "";
let patientBId = "";
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
  await prisma.periodontalReading.deleteMany();
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
  await prisma.instructionSend.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();
}

// ─── وحدوية: حد التنبيه والمحللات ─────────────────────────────────────────────

describe("isLowStock — حد التنبيه", () => {
  it("الكمية تحت الحد تنبيه", () => {
    expect(isLowStock(2, 5)).toBe(true);
  });

  it("الكمية عند الحد بالضبط تنبيه", () => {
    expect(isLowStock(5, 5)).toBe(true);
  });

  it("الكمية فوق الحد ليست تنبيهاً", () => {
    expect(isLowStock(6, 5)).toBe(false);
  });

  it("الحد صفر مع كمية صفر تنبيه", () => {
    expect(isLowStock(0, 0)).toBe(true);
  });
});

describe("parseCreateMaterial", () => {
  it("جسم صالح يُقبل", () => {
    const parsed = parseCreateMaterial({
      name: "كمبوزيت",
      unit: "أنبوب",
      minQuantity: 3,
      costUsd: 25000,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.name).toBe("كمبوزيت");
      expect(parsed.value.costUsd).toBe(25000);
    }
  });

  it("اسم قصير جداً يُرفض", () => {
    expect(
      parseCreateMaterial({ name: "م", unit: "علبة", minQuantity: 0 }).ok,
    ).toBe(false);
  });

  it("حد تنبيه سالب يُرفض", () => {
    expect(
      parseCreateMaterial({ name: "كمبوزيت", unit: "علبة", minQuantity: -1 })
        .ok,
    ).toBe(false);
  });

  it("سعر سالب يُرفض", () => {
    expect(
      parseCreateMaterial({
        name: "كمبوزيت",
        unit: "علبة",
        minQuantity: 1,
        costUsd: -5,
      }).ok,
    ).toBe(false);
  });

  // فجوة 7: التكلفة بعشرية بحد منزلتين — الأسعار الكسورية تُقبل لا تُقرَّب.
  it("سعر كسري بعشرية واحدة يُقبل كما هو", () => {
    const parsed = parseCreateMaterial({
      name: "كمبوزيت",
      unit: "علبة",
      minQuantity: 1,
      costUsd: 4.5,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.costUsd).toBe(4.5);
    }
  });
});

describe("parseUpdateMaterial", () => {
  it("تعديل جزئي صالح يُقبل", () => {
    const parsed = parseUpdateMaterial({ minQuantity: 4 });
    expect(parsed.ok).toBe(true);
  });

  it("وحدة فارغة تُرفض", () => {
    expect(parseUpdateMaterial({ unit: "  " }).ok).toBe(false);
  });
});

describe("parseSupplyInput", () => {
  it("كمية موجبة تُقبل", () => {
    const parsed = parseSupplyInput({ quantity: 10 });
    expect(parsed.ok).toBe(true);
  });

  it("كمية صفر تُرفض", () => {
    expect(parseSupplyInput({ quantity: 0 }).ok).toBe(false);
  });

  it("كمية غير رقمية تُرفض", () => {
    expect(parseSupplyInput({ quantity: "عشرة" }).ok).toBe(false);
  });
});

describe("parseUsageInput", () => {
  it("استعمال مع مريض اختياري يُقبل", () => {
    const parsed = parseUsageInput({ quantityUsed: 2, patientId: "p1" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.patientId).toBe("p1");
    }
  });

  it("استعمال بلا مريض يُقبل", () => {
    const parsed = parseUsageInput({ quantityUsed: 1.5 });
    expect(parsed.ok).toBe(true);
  });

  it("كمية سالبة تُرفض", () => {
    expect(parseUsageInput({ quantityUsed: -3 }).ok).toBe(false);
  });

  it("نص بدل الكمية يُرفض", () => {
    expect(parseUsageInput({ quantityUsed: "كثير" }).ok).toBe(false);
  });
});

// ─── تكامل: قاعدة بيانات حقيقية ──────────────────────────────────────────────

describeDb("المخزون — integration", () => {
  beforeAll(async () => {
    await cleanDb();

    const passwordHash = await hashPassword(PASSWORD);
    const [clinicA, clinicB] = await Promise.all([
      prisma.clinic.create({ data: { name: "عيادة مخزون أ" } }),
      prisma.clinic.create({ data: { name: "عيادة مخزون ب" } }),
    ]);
    clinicAId = clinicA.id;
    clinicBId = clinicB.id;

    const [userA, userB, patientA, patientB] = await Promise.all([
      prisma.user.create({
        data: {
          clinicId: clinicAId,
          name: "د. سامر",
          phone: PHONE_A,
          passwordHash,
          role: "DENTIST",
        },
      }),
      prisma.user.create({
        data: {
          clinicId: clinicBId,
          name: "د. ناديا",
          phone: PHONE_B,
          passwordHash,
          role: "DENTIST",
        },
      }),
      prisma.patient.create({
        data: {
          clinicId: clinicAId,
          name: "مريض-مخزون-أ",
          phone: "0904111111",
        },
      }),
      prisma.patient.create({
        data: {
          clinicId: clinicBId,
          name: "مريض-مخزون-ب",
          phone: "0904222222",
        },
      }),
    ]);
    patientAId = patientA.id;
    patientBId = patientB.id;

    ctxA = tenantContextFromSession({
      userId: userA.id,
      clinicId: clinicAId,
      name: "د. سامر",
      lockEnabled: false,
      role: "DENTIST",
    });
    ctxB = tenantContextFromSession({
      userId: userB.id,
      clinicId: clinicBId,
      name: "د. ناديا",
      lockEnabled: false,
      role: "DENTIST",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createMaterialApi(
    token: string,
    body: Record<string, unknown>,
  ): Promise<{
    status: number;
    body: { material?: { id: string; quantityOnHand?: number } };
  }> {
    const res = await materialsPOST(
      authedRequest("/api/materials", token, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, body: await res.json() };
  }

  function routeParams(materialId: string): {
    params: Promise<{ materialId: string }>;
  } {
    return { params: Promise.resolve({ materialId }) };
  }

  it("إنشاء مادة عبر الـ endpoint يبدأ بكمية صفر (201)", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const { status, body } = await createMaterialApi(token, {
      name: "كمبوزيت ضوئي",
      unit: "أنبوب",
      minQuantity: 2,
      costUsd: 40000,
    });
    expect(status).toBe(201);
    expect(body.material?.id).toBeTruthy();
  });

  it("الرصيد الافتتاحي يُحفظ من الإنشاء وتُسجّل حركة تأسيس بقيمته (خطأ 7)", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const { status, body } = await createMaterialApi(token, {
      name: "مادة برصيد افتتاحي",
      unit: "علبة",
      minQuantity: 5,
      quantity: 25,
    });
    expect(status).toBe(201);
    expect(body.material?.quantityOnHand).toBe(25);

    // حركة التأسيس في الدفتر — نفس نمط سطر التوريد
    const mvRes = await movementsGET(
      authedRequest(`/api/materials/${body.material!.id}/movements`, token),
      routeParams(body.material!.id),
    );
    expect(mvRes.status).toBe(200);
    const movements = (await mvRes.json()).movements;
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].quantityChange)).toBe(25);
    expect(movements[0].note).toBe("رصيد افتتاحي عند إنشاء المادة");
  });

  it("التوريد يزيد الكمية والمواد تبقى معزولة بمرحلة الإنشاء", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const { body } = await createMaterialApi(token, {
      name: "قفازات لاتكس",
      unit: "علبة",
      minQuantity: 5,
    });
    const materialId = body.material!.id;

    const res = await supplyPOST(
      authedRequest(`/api/materials/${materialId}/supply`, token, {
        method: "POST",
        body: JSON.stringify({ quantity: 10 }),
      }),
      routeParams(materialId),
    );
    const supplied = await res.json();
    expect(res.status).toBe(200);
    expect(supplied.material.quantityOnHand).toBe(10);
    expect(supplied.material.isLow).toBe(false);

    // الكمية تتغير بالتوريد والاستعمال حصراً — PATCH لا يعدّلها
    const patch = await materialPATCH(
      authedRequest(`/api/materials/${materialId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ minQuantity: 5 }),
      }),
      routeParams(materialId),
    );
    const patched = await patch.json();
    expect(patch.status).toBe(200);
    expect(patched.material.quantityOnHand).toBe(10);
    expect(patched.material.minQuantity).toBe(5);
  });

  it("خصم استعمال صالح ينقص الكمية ويسجل MaterialUsage", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const { body } = await createMaterialApi(token, {
      name: "أرطرة مطاطية",
      unit: "كيس",
      minQuantity: 1,
    });
    const materialId = body.material!.id;

    await supplyPOST(
      authedRequest(`/api/materials/${materialId}/supply`, token, {
        method: "POST",
        body: JSON.stringify({ quantity: 8 }),
      }),
      routeParams(materialId),
    );

    const res = await usagePOST(
      authedRequest(`/api/materials/${materialId}/usage`, token, {
        method: "POST",
        body: JSON.stringify({ quantityUsed: 3, patientId: patientAId }),
      }),
      routeParams(materialId),
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.material.quantityOnHand).toBe(5);
    expect(data.usage.patientId).toBe(patientAId);

    const usageRows = await prisma.materialUsage.findMany({
      where: { materialId },
    });
    expect(usageRows).toHaveLength(1);
    expect(Number(usageRows[0].quantityUsed)).toBe(3);
    expect(usageRows[0].clinicId).toBe(clinicAId);
  });

  it("خصم يُرجع الكمية سالباً يُرفض (409) دون تغيير ودون تسجيل", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const { body } = await createMaterialApi(token, {
      name: "إبر تخدير",
      unit: "علبة",
      minQuantity: 2,
    });
    const materialId = body.material!.id;

    await supplyPOST(
      authedRequest(`/api/materials/${materialId}/supply`, token, {
        method: "POST",
        body: JSON.stringify({ quantity: 4 }),
      }),
      routeParams(materialId),
    );

    const res = await usagePOST(
      authedRequest(`/api/materials/${materialId}/usage`, token, {
        method: "POST",
        body: JSON.stringify({ quantityUsed: 10 }),
      }),
      routeParams(materialId),
    );
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.available).toBe(4);

    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });
    expect(Number(material?.quantityOnHand)).toBe(4);

    const usageRows = await prisma.materialUsage.findMany({
      where: { materialId },
    });
    expect(usageRows).toHaveLength(0);
  });

  it("استهلاك الكمية كلها مسموح — الصفر ليس سالباً — وتصير تحت التنبيه", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const { body } = await createMaterialApi(token, {
      name: "حوافر حجارة",
      unit: "قطعة",
      minQuantity: 3,
    });
    const materialId = body.material!.id;

    await supplyPOST(
      authedRequest(`/api/materials/${materialId}/supply`, token, {
        method: "POST",
        body: JSON.stringify({ quantity: 3 }),
      }),
      routeParams(materialId),
    );

    const res = await usagePOST(
      authedRequest(`/api/materials/${materialId}/usage`, token, {
        method: "POST",
        body: JSON.stringify({ quantityUsed: 3 }),
      }),
      routeParams(materialId),
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.material.quantityOnHand).toBe(0);
    expect(data.material.isLow).toBe(true);
  });

  it("قائمة التنبيه (filter=low) تعرض المواد عند الحد أو تحته حصراً", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);

    const { body: lowBody } = await createMaterialApi(token, {
      name: "مادة منخفضة",
      unit: "علبة",
      minQuantity: 4,
    });
    await supplyPOST(
      authedRequest(`/api/materials/${lowBody.material!.id}/supply`, token, {
        method: "POST",
        body: JSON.stringify({ quantity: 2 }),
      }),
      routeParams(lowBody.material!.id),
    );

    const { body: okBody } = await createMaterialApi(token, {
      name: "مادة وافية",
      unit: "علبة",
      minQuantity: 1,
    });
    await supplyPOST(
      authedRequest(`/api/materials/${okBody.material!.id}/supply`, token, {
        method: "POST",
        body: JSON.stringify({ quantity: 9 }),
      }),
      routeParams(okBody.material!.id),
    );

    const res = await materialsGET(
      authedRequest("/api/materials?filter=low", token),
    );
    const data = await res.json();
    expect(res.status).toBe(200);

    const lowNames = data.materials.map((m: { name: string }) => m.name);
    expect(lowNames).toContain("مادة منخفضة");
    expect(lowNames).not.toContain("مادة وافية");
    for (const m of data.materials) {
      expect(m.isLow).toBe(true);
    }
  });

  it("عزل: عيادة ب لا ترى مواد عيادة أ ولا تعدّلها ولا تورّدها ولا تستعملها", async () => {
    const tokenA = await loginToken(PHONE_A, PASSWORD);
    const tokenB = await loginToken(PHONE_B, PASSWORD);

    const { body } = await createMaterialApi(tokenA, {
      name: "مادة عيادة أ",
      unit: "علبة",
      minQuantity: 1,
    });
    const materialAId = body.material!.id;

    const listB = await materialsGET(authedRequest("/api/materials", tokenB));
    const listBData = await listB.json();
    expect(listBData.materials.map((m: { id: string }) => m.id)).not.toContain(
      materialAId,
    );

    const patchB = await materialPATCH(
      authedRequest(`/api/materials/${materialAId}`, tokenB, {
        method: "PATCH",
        body: JSON.stringify({ name: "سرقة اسم" }),
      }),
      routeParams(materialAId),
    );
    expect(patchB.status).toBe(404);

    const supplyB = await supplyPOST(
      authedRequest(`/api/materials/${materialAId}/supply`, tokenB, {
        method: "POST",
        body: JSON.stringify({ quantity: 5 }),
      }),
      routeParams(materialAId),
    );
    expect(supplyB.status).toBe(404);

    const usageB = await usagePOST(
      authedRequest(`/api/materials/${materialAId}/usage`, tokenB, {
        method: "POST",
        body: JSON.stringify({ quantityUsed: 1 }),
      }),
      routeParams(materialAId),
    );
    expect(usageB.status).toBe(404);

    const material = await prisma.material.findUnique({
      where: { id: materialAId },
    });
    expect(Number(material?.quantityOnHand)).toBe(0);
    expect(material?.name).toBe("مادة عيادة أ");
  });

  it("عزل: استعمال بمريض من عيادة أخرى يُرفض", async () => {
    const tokenA = await loginToken(PHONE_A, PASSWORD);

    const { body } = await createMaterialApi(tokenA, {
      name: "مادة فحص مريض",
      unit: "علبة",
      minQuantity: 0,
    });
    const materialId = body.material!.id;
    await supplyPOST(
      authedRequest(`/api/materials/${materialId}/supply`, tokenA, {
        method: "POST",
        body: JSON.stringify({ quantity: 2 }),
      }),
      routeParams(materialId),
    );

    const res = await usagePOST(
      authedRequest(`/api/materials/${materialId}/usage`, tokenA, {
        method: "POST",
        body: JSON.stringify({ quantityUsed: 1, patientId: patientBId }),
      }),
      routeParams(materialId),
    );
    expect(res.status).toBe(404);
  });

  it("الخدمة المباشرة lowStockMaterials تعزل التنبيه بالعيادة", async () => {
    const { lowStockMaterials } = await import("@/lib/services/inventory");

    const tokenA = await loginToken(PHONE_A, PASSWORD);
    const { body } = await createMaterialApi(tokenA, {
      name: "مادة أ تحت الحد",
      unit: "علبة",
      minQuantity: 5,
    });
    await supplyPOST(
      authedRequest(`/api/materials/${body.material!.id}/supply`, tokenA, {
        method: "POST",
        body: JSON.stringify({ quantity: 1 }),
      }),
      routeParams(body.material!.id),
    );

    const lowA = await lowStockMaterials(ctxA);
    const lowB = await lowStockMaterials(ctxB);

    expect(lowA.map((m) => m.name)).toContain("مادة أ تحت الحد");
    expect(lowB.map((m) => m.name)).not.toContain("مادة أ تحت الحد");
  });
});
