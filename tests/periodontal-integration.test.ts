// @vitest-environment node
import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  GET as readingsGET,
  POST as readingsPOST,
} from "@/app/api/patients/[patientId]/periodontal/route";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";

// اختبارات تكامل الدواعم — نمط findings-integration.test.ts حرفاً: تنفيذ
// مباشر مقابل معالجات المسار، وعيادتان للتحقق من عزل المستأجر. تحتاج قاعدة
// بيانات حقيقية — تُتخطى إن لم يتوفر DATABASE_URL.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE_A = "0934444441";
const PHONE_B = "0934444442";
const PASSWORD = "periodontal-integration-pass";

let clinicAId = "";
let clinicBId = "";
let patientAId = "";
let tokenA = "";
let tokenB = "";

function authed(
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

function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

describeDb("قراءات الدواعم — integration", () => {
  beforeAll(async () => {
    await prisma.session.deleteMany();
    await prisma.periodontalReading.deleteMany();
    await prisma.toothFinding.deleteMany();
    await prisma.ledgerEntryItem.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.treatmentPlanItem.deleteMany();
    await prisma.treatmentPlan.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.staffMember.deleteMany();
    await prisma.waitlistEntry.deleteMany();
    await prisma.materialUsage.deleteMany();
    await prisma.instructionTemplate.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.material.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.user.deleteMany();
    await prisma.clinic.deleteMany();

    const passwordHash = await hashPassword(PASSWORD);
    const [clinicA, clinicB] = await Promise.all([
      prisma.clinic.create({ data: { name: "عيادة دواعم أ" } }),
      prisma.clinic.create({ data: { name: "عيادة دواعم ب" } }),
    ]);
    clinicAId = clinicA.id;
    clinicBId = clinicB.id;

    await Promise.all([
      prisma.user.create({
        data: {
          clinicId: clinicAId,
          name: "د. فادي",
          phone: PHONE_A,
          passwordHash,
          role: "DENTIST",
        },
      }),
      prisma.user.create({
        data: {
          clinicId: clinicBId,
          name: "د. رامي",
          phone: PHONE_B,
          passwordHash,
          role: "DENTIST",
        },
      }),
    ]);

    const patientA = await prisma.patient.create({
      data: { clinicId: clinicAId, name: "مريض دواعم أ" },
    });
    await prisma.patient.create({
      data: { clinicId: clinicBId, name: "مريض دواعم ب" },
    });
    patientAId = patientA.id;

    const { POST: loginPOST } = await import("@/app/api/auth/login/route");
    async function login(phone: string): Promise<string> {
      const res = await loginPOST(
        new NextRequest("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, password: PASSWORD }),
        }),
      );
      const token = res.cookies.get("session")?.value;
      if (!token) throw new Error(`login failed for ${phone}`);
      return token;
    }
    tokenA = await login(PHONE_A);
    tokenB = await login(PHONE_B);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("يرفض endpoint الدواعم بدون جلسة (401)", async () => {
    const res = await readingsGET(
      new NextRequest(
        `http://localhost/api/patients/${patientAId}/periodontal`,
      ),
      routeParams({ patientId: patientAId }),
    );
    expect(res.status).toBe(401);
  });

  it("حفظ قراءة كاملة ثم قراءتها تعيد القيم كما حُفظت", async () => {
    const res = await readingsPOST(
      authed(`/api/patients/${patientAId}/periodontal`, tokenA, {
        method: "POST",
        body: JSON.stringify({
          toothFdi: 36,
          pocketDepthMm: 6,
          recessionMm: -2,
          bleedingOnProbing: true,
          mobilityGrade: 1,
          note: "جيب حيوي عند القريبة",
        }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(res.status).toBe(201);

    const list = await readingsGET(
      authed(`/api/patients/${patientAId}/periodontal`, tokenA),
      routeParams({ patientId: patientAId }),
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { readings: PeriodontalReadingDto[] };
    const on36 = body.readings.filter((r) => r.toothFdi === 36);
    expect(on36).toHaveLength(1);
    expect(on36[0].pocketDepthMm).toBe(6);
    expect(on36[0].recessionMm).toBe(-2);
    expect(on36[0].bleedingOnProbing).toBe(true);
    expect(on36[0].mobilityGrade).toBe(1);
  });

  it("القراءة الجزئية مقبولة — قياس واحد يكفي، والفارغة كلياً تُرفض", async () => {
    const partial = await readingsPOST(
      authed(`/api/patients/${patientAId}/periodontal`, tokenA, {
        method: "POST",
        body: JSON.stringify({ toothFdi: 46, pocketDepthMm: 4 }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(partial.status).toBe(201);

    const empty = await readingsPOST(
      authed(`/api/patients/${patientAId}/periodontal`, tokenA, {
        method: "POST",
        body: JSON.stringify({ toothFdi: 46 }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(empty.status).toBe(400);
  });

  it("الحدود الصريحة: عمق 16 وانكماش −6 وحركية 4 تُرفض (400)", async () => {
    for (const body of [
      { toothFdi: 36, pocketDepthMm: 16 },
      { toothFdi: 36, recessionMm: -6 },
      { toothFdi: 36, mobilityGrade: 4 },
    ]) {
      const res = await readingsPOST(
        authed(`/api/patients/${patientAId}/periodontal`, tokenA, {
          method: "POST",
          body: JSON.stringify(body),
        }),
        routeParams({ patientId: patientAId }),
      );
      expect(res.status).toBe(400);
    }

    // حدود القبول: 15 و−5 و3 تمر.
    for (const body of [
      { toothFdi: 25, pocketDepthMm: 15 },
      { toothFdi: 25, recessionMm: -5 },
      { toothFdi: 25, mobilityGrade: 3 },
    ]) {
      const res = await readingsPOST(
        authed(`/api/patients/${patientAId}/periodontal`, tokenA, {
          method: "POST",
          body: JSON.stringify(body),
        }),
        routeParams({ patientId: patientAId }),
      );
      expect(res.status).toBe(201);
    }
  });

  it("يقرأ ويسجل عيادة ب لمريض عيادة أ بأمان (404) — لا تسريب بين العيادتين", async () => {
    const read = await readingsGET(
      authed(`/api/patients/${patientAId}/periodontal`, tokenB),
      routeParams({ patientId: patientAId }),
    );
    expect(read.status).toBe(404);

    const write = await readingsPOST(
      authed(`/api/patients/${patientAId}/periodontal`, tokenB, {
        method: "POST",
        body: JSON.stringify({ toothFdi: 36, pocketDepthMm: 3 }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(write.status).toBe(404);

    const rows = await prisma.periodontalReading.findMany({
      where: { patientId: patientAId, clinicId: clinicBId },
    });
    expect(rows).toHaveLength(0);

    // قراءات عيادة ب محصورة بمرضاها.
    const clinicBReadings = await prisma.periodontalReading.findMany({
      where: { clinicId: clinicBId },
    });
    expect(clinicBReadings).toHaveLength(0);
  });
});
