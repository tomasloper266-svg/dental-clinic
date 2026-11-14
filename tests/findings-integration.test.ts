// @vitest-environment node
import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  GET as findingsGET,
  POST as findingsPOST,
} from "@/app/api/patients/[patientId]/findings/route";
import {
  GET as planGET,
  POST as planPOST,
} from "@/app/api/patients/[patientId]/treatment-plan/route";
import {
  PATCH as planPATCH,
  POST as planStartPOST,
} from "@/app/api/patients/[patientId]/treatment-plan/[itemId]/route";
import { latestFindingByTooth } from "@/lib/odontogram/findings-view";
import type { FindingDto } from "@/lib/services/findings";
import type { PlanItemDto } from "@/lib/services/treatment-plan";

// اختبارات التكامل تحتاج قاعدة بيانات حقيقية — تُتخطى إن لم يتوفر DATABASE_URL
// (نفس نمط tests/tenant-isolation.test.ts). في CI يوفر workflow خدمة PostgreSQL.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE_A = "0933333331";
const PHONE_B = "0933333332";
const PASSWORD = "findings-integration-pass";

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

describeDb("مشاهدات الأسنان وخطة العلاج — integration", () => {
  beforeAll(async () => {
    await prisma.session.deleteMany();
    await prisma.toothFinding.deleteMany();
    await prisma.treatmentPlanItem.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.staffMember.deleteMany();
    await prisma.waitlistEntry.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.materialUsage.deleteMany();
    await prisma.instructionTemplate.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.material.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.user.deleteMany();
    await prisma.clinic.deleteMany();

    const passwordHash = await hashPassword(PASSWORD);
    const [clinicA, clinicB] = await Promise.all([
      prisma.clinic.create({ data: { name: "عيادة مشاهدات أ" } }),
      prisma.clinic.create({ data: { name: "عيادة مشاهدات ب" } }),
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
      data: { clinicId: clinicAId, name: "مريض مشاهدات أ" },
    });
    await prisma.patient.create({
      data: { clinicId: clinicBId, name: "مريض مشاهدات ب" },
    });
    patientAId = patientA.id;

    // تسجيل دخول حقيقي عبر مسار الجلسات للحصول على كوكي صالح لكل عيادة.
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

  it("يرفض endpoints المشاهدات بدون جلسة (401)", async () => {
    const res = await findingsGET(
      new NextRequest(
        `http://localhost/api/patients/${patientAId}/findings`,
      ),
      routeParams({ patientId: patientAId }),
    );
    expect(res.status).toBe(401);
  });

  it("تسجيل مشاهدة ينجح وتبقى بعد إعادة القراءة (معيار إعادة التحميل)", async () => {
    const res = await findingsPOST(
      authed(
        `/api/patients/${patientAId}/findings`,
        tokenA,
        {
          method: "POST",
          body: JSON.stringify({
            toothFdi: 26,
            kind: "DIAGNOSIS",
            status: "DECAYED",
            note: "تسوس قريب",
          }),
        },
      ),
      routeParams({ patientId: patientAId }),
    );
    expect(res.status).toBe(201);

    // إعادة قراءة منفصلة — الحالة تُحفظ وتبقى بعد إعادة التحميل.
    const list = await findingsGET(
      authed(`/api/patients/${patientAId}/findings`, tokenA),
      routeParams({ patientId: patientAId }),
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { findings: FindingDto[] };
    const on26 = body.findings.filter((f) => f.toothFdi === 26);
    expect(on26).toHaveLength(1);
    expect(on26[0].status).toBe("DECAYED");
    expect(on26[0].kind).toBe("DIAGNOSIS");
  });

  it("قراءة عيادة ب لمريض عيادة أ تفشل بأمان (404) والكتابة أيضاً", async () => {
    const read = await findingsGET(
      authed(`/api/patients/${patientAId}/findings`, tokenB),
      routeParams({ patientId: patientAId }),
    );
    expect(read.status).toBe(404);

    const write = await findingsPOST(
      authed(`/api/patients/${patientAId}/findings`, tokenB, {
        method: "POST",
        body: JSON.stringify({ toothFdi: 26, kind: "EXISTING", status: "FILLED" }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(write.status).toBe(404);

    // لا قيد جديد سُجّل من العيادة الأخرى.
    const rows = await prisma.toothFinding.findMany({
      where: { patientId: patientAId, clinicId: clinicBId },
    });
    expect(rows).toHaveLength(0);
  });

  it("المشاهدات إلحاقية: قيدان لنفس السن يبقيان كليهما، والعرض يستنتج الأحدث فقط", async () => {
    await findingsPOST(
      authed(`/api/patients/${patientAId}/findings`, tokenA, {
        method: "POST",
        body: JSON.stringify({
          toothFdi: 36,
          kind: "EXISTING",
          status: "ROOT_CANAL",
        }),
      }),
      routeParams({ patientId: patientAId }),
    );
    await findingsPOST(
      authed(`/api/patients/${patientAId}/findings`, tokenA, {
        method: "POST",
        body: JSON.stringify({
          toothFdi: 36,
          kind: "DIAGNOSIS",
          status: "CROWN",
        }),
      }),
      routeParams({ patientId: patientAId }),
    );

    const list = await findingsGET(
      authed(`/api/patients/${patientAId}/findings`, tokenA),
      routeParams({ patientId: patientAId }),
    );
    const body = (await list.json()) as { findings: FindingDto[] };
    const on36 = body.findings.filter((f) => f.toothFdi === 36);
    // المشاهدتان القائمتان لم تُمحا — لا استبدال بالتخطيط أو بالحالة الجديدة.
    expect(on36).toHaveLength(2);
    const latest = latestFindingByTooth(body.findings);
    expect(latest.get(36)?.status).toBe("CROWN");
  });

  it("خطة علاج: إضافة بند، تعديله، ثم بدء تنفيذه يسجّل مشاهدة علاج منفذ", async () => {
    const created = await planPOST(
      authed(`/api/patients/${patientAId}/treatment-plan`, tokenA, {
        method: "POST",
        body: JSON.stringify({
          toothFdi: 47,
          procedure: "علاج جذور + تاج",
          priceSyp: 1500000,
        }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(created.status).toBe(201);
    const item = ((await created.json()) as { item: PlanItemDto }).item;
    expect(item.status).toBe("PROPOSED");

    const edited = await planPATCH(
      authed(
        `/api/patients/${patientAId}/treatment-plan/${item.id}`,
        tokenA,
        {
          method: "PATCH",
          body: JSON.stringify({ priceSyp: 1600000, status: "ACCEPTED" }),
        },
      ),
      routeParams({ patientId: patientAId, itemId: item.id }),
    );
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as { item: PlanItemDto }).item.priceSyp).toBe(
      1600000,
    );

    const started = await planStartPOST(
      authed(
        `/api/patients/${patientAId}/treatment-plan/${item.id}`,
        tokenA,
        {
          method: "POST",
          body: JSON.stringify({ resultStatus: "CROWN" }),
        },
      ),
      routeParams({ patientId: patientAId, itemId: item.id }),
    );
    expect(started.status).toBe(200);
    expect(((await started.json()) as { item: PlanItemDto }).item.status).toBe(
      "DONE",
    );

    // قيد «علاج منفذ» أُضيف للسن 47 دون مسح ما سبقه.
    const list = await findingsGET(
      authed(`/api/patients/${patientAId}/findings`, tokenA),
      routeParams({ patientId: patientAId }),
    );
    const body = (await list.json()) as { findings: FindingDto[] };
    const on47 = body.findings.filter((f) => f.toothFdi === 47);
    expect(on47).toHaveLength(1);
    expect(on47[0].kind).toBe("TREATMENT_DONE");
    expect(on47[0].status).toBe("CROWN");

    // البند المنفَّذ نهائي — لا تعديل ولا تنفيذ ثانٍ.
    const editDone = await planPATCH(
      authed(
        `/api/patients/${patientAId}/treatment-plan/${item.id}`,
        tokenA,
        {
          method: "PATCH",
          body: JSON.stringify({ priceSyp: 1 }),
        },
      ),
      routeParams({ patientId: patientAId, itemId: item.id }),
    );
    expect(editDone.status).toBe(409);
    const startAgain = await planStartPOST(
      authed(
        `/api/patients/${patientAId}/treatment-plan/${item.id}`,
        tokenA,
        {
          method: "POST",
          body: JSON.stringify({ resultStatus: "CROWN" }),
        },
      ),
      routeParams({ patientId: patientAId, itemId: item.id }),
    );
    expect(startAgain.status).toBe(409);
  });

  it("عزل خطة العلاج: عيادة ب لا ترى ولا تعدّل بنود عيادة أ", async () => {
    const read = await planGET(
      authed(`/api/patients/${patientAId}/treatment-plan`, tokenB),
      routeParams({ patientId: patientAId }),
    );
    expect(read.status).toBe(404);

    const items = await prisma.treatmentPlanItem.findMany({
      where: { patientId: patientAId },
    });
    expect(items.length).toBeGreaterThan(0);
    const foreignEdit = await planPATCH(
      authed(
        `/api/patients/${patientAId}/treatment-plan/${items[0].id}`,
        tokenB,
        {
          method: "PATCH",
          body: JSON.stringify({ priceSyp: 1 }),
        },
      ),
      routeParams({ patientId: patientAId, itemId: items[0].id }),
    );
    // العزل: البند غير مرئي لعيادة ب عبر clinicScope — نفس سلوك مرضى 404.
    expect(foreignEdit.status).toBe(404);
    const unchanged = await prisma.treatmentPlanItem.findUniqueOrThrow({
      where: { id: items[0].id },
    });
    expect(unchanged.clinicId).toBe(clinicAId);
    expect(clinicBId).not.toBe(clinicAId);
    expect(unchanged.priceSyp).toBe(items[0].priceSyp);
  });

  it("يرفض سنـاً غير صالح وحالة ناتجة غير معروفة (400)", async () => {
    const badTooth = await planPOST(
      authed(`/api/patients/${patientAId}/treatment-plan`, tokenA, {
        method: "POST",
        body: JSON.stringify({
          toothFdi: 99,
          procedure: "حشو",
          priceSyp: 100,
        }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(badTooth.status).toBe(400);

    const badStatus = await findingsPOST(
      authed(`/api/patients/${patientAId}/findings`, tokenA, {
        method: "POST",
        body: JSON.stringify({
          toothFdi: 26,
          kind: "EXISTING",
          status: "JUNK",
        }),
      }),
      routeParams({ patientId: patientAId }),
    );
    expect(badStatus.status).toBe(400);
  });
});
