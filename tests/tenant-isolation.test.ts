// @vitest-environment node
import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { clinicScope } from "@/lib/tenant/clinic-client";
import { getPatient, listPatients } from "@/lib/services/patients";
import {
  GET as patientsGET,
  POST as patientsPOST,
} from "@/app/api/patients/route";
import {
  GET as patientGET,
  PATCH as patientPATCH,
} from "@/app/api/patients/[patientId]/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import type { TenantContext } from "@/lib/tenant/context";

// اختبارات التكامل تحتاج قاعدة بيانات حقيقية — تُتخطى إن لم يتوفر DATABASE_URL
// (التشغيل الوحدوي فقط). في CI يوفر workflow خدمة PostgreSQL.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE_A = "0911111111";
const PHONE_B = "0922222222";
const PASSWORD = "integration-pass-1";

let clinicAId = "";
let clinicBId = "";
let patientAId = "";
let patientBId = "";
let ctxA: TenantContext;

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

describeDb("عزل العيادات — integration", () => {
  beforeAll(async () => {
    // تنظيف كامل بترتيب آمن مع القيود الخارجية.
    await prisma.session.deleteMany();
    await prisma.materialUsage.deleteMany();
    await prisma.toothFinding.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.treatmentPlanItem.deleteMany();
    await prisma.treatmentPlan.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.staffMember.deleteMany();
    await prisma.waitlistEntry.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.instructionTemplate.deleteMany();
    await prisma.material.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.user.deleteMany();
    await prisma.clinic.deleteMany();

    const passwordHash = await hashPassword(PASSWORD);
    const [clinicA, clinicB] = await Promise.all([
      prisma.clinic.create({ data: { name: "عيادة أ" } }),
      prisma.clinic.create({ data: { name: "عيادة ب" } }),
    ]);
    clinicAId = clinicA.id;
    clinicBId = clinicB.id;

    const [userA] = await Promise.all([
      prisma.user.create({
        data: {
          clinicId: clinicAId,
          name: "د. سليم",
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
    ]);

    const [patientA, patientB] = await Promise.all([
      prisma.patient.create({
        data: { clinicId: clinicAId, name: "مريض-أ", phone: "0900111111" },
      }),
      prisma.patient.create({
        data: { clinicId: clinicBId, name: "مريض-ب", phone: "0900222222" },
      }),
    ]);
    patientAId = patientA.id;
    patientBId = patientB.id;

    ctxA = tenantContextFromSession({
      userId: userA.id,
      clinicId: clinicAId,
      name: "د. سليم",
      lockEnabled: false,
role: "DENTIST",
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("يرفض endpoints البيانات بدون جلسة (401)", async () => {
    const res = await patientsGET(
      new NextRequest("http://localhost/api/patients"),
    );
    expect(res.status).toBe(401);
  });

  it("يرفض الدخول بكلمة سر خاطئة", async () => {
    const res = await loginPOST(loginRequest(PHONE_A, "wrong-password"));
    expect(res.status).toBe(401);
    expect(res.cookies.get("session")).toBeUndefined();
  });

  it("الدخول الصحيح يعيد كوكي جلسة HttpOnly", async () => {
    const res = await loginPOST(loginRequest(PHONE_A, PASSWORD));
    expect(res.status).toBe(200);
    const cookie = res.cookies.get("session");
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
  });

  it("GET /api/patients بجلسة عيادة أ لا يُظهر مرضى عيادة ب", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientsGET(authedRequest("/api/patients", token));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { patients: Array<{ id: string }> };
    const ids = body.patients.map((p) => p.id);
    expect(ids).toContain(patientAId);
    expect(ids).not.toContain(patientBId);
  });

  it("POST /api/patients بجلسة عيادة أ يخزن المريض بعيادة أ حصراً", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientsPOST(
      authedRequest("/api/patients", token, {
        method: "POST",
        body: JSON.stringify({ name: "مريض-أ-جديد", birthYear: 1985 }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { patient: { id: string } };
    const stored = await prisma.patient.findUnique({
      where: { id: body.patient.id },
    });
    expect(stored?.clinicId).toBe(clinicAId);
  });

  it("قراءة مريض عيادة ب بسياق عيادة أ ترجع null", async () => {
    const patient = await getPatient(ctxA, patientBId);
    expect(patient).toBeNull();
  });

  it("قائمة المرضى بسياق عيادة أ مع بحث باسم مريض ب ترجع فارغة", async () => {
    const patients = await listPatients(ctxA, "مريض-ب");
    expect(patients).toHaveLength(0);
  });

  it("تحديث مريض عيادة ب عبر عميل عيادة أ لا يعدّل سجلاً واحداً", async () => {
    const db = clinicScope(clinicAId);
    const result = await db.patient.updateMany({
      where: { id: patientBId },
      data: { name: "معدّل-عبر-عيادة-أ" },
    });
    expect(result.count).toBe(0);
    const unchanged = await prisma.patient.findUnique({
      where: { id: patientBId },
    });
    expect(unchanged?.name).toBe("مريض-ب");
  });

  it("حذف مريض عيادة ب عبر عميل عيادة أ لا يحذف سجلاً واحداً", async () => {
    const db = clinicScope(clinicAId);
    const result = await db.patient.deleteMany({ where: { id: patientBId } });
    expect(result.count).toBe(0);
    const stillThere = await prisma.patient.findUnique({
      where: { id: patientBId },
    });
    expect(stillThere).not.toBeNull();
  });

  it("إنشاء مريض عبر عميل عيادة أ يُدخل clinicId الصحيح حتى لو أُهمل في البيانات", async () => {
    const db = clinicScope(clinicAId);
    // القصد إثبات حقن clinicId من الامتداد — لذا نُهمله صراحةً هنا؛
    // تقييد Exact في Prisma 7 يتطلب صبّ صريح فوق مُدخلات الإنشاء.
    const created = await db.patient.create({
      data: { name: "حقن-تلقائي" },
    } as Parameters<typeof db.patient.create>[0]);
    expect(created.clinicId).toBe(clinicAId);
    expect(created.clinicId).not.toBe(clinicBId);
  });

  it("GET /api/patients/[patientId] لمريض عيادة أ يعيد بياناته كاملة", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientGET(
      authedRequest(`/api/patients/${patientAId}`, token),
      { params: Promise.resolve({ patientId: patientAId }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { patient: { id: string } };
    expect(body.patient.id).toBe(patientAId);
  });

  it("GET /api/patients/[patientId] لمريض عيادة ب بجلسة عيادة أ يعيد 404 بلا تسرّب", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientGET(
      authedRequest(`/api/patients/${patientBId}`, token),
      { params: Promise.resolve({ patientId: patientBId }) },
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /api/patients/[patientId] بجلسة عيادة أ يحدّث الحقول ويثبّتها", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientPATCH(
      authedRequest(`/api/patients/${patientAId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          name: "مريض-أ-محدّث",
          address: "دمشق - المزة",
          medicalNotes: "حساسية: بنسلين\nأمراض: سكري",
        }),
      }),
      { params: Promise.resolve({ patientId: patientAId }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      patient: { id: string; address: string | null; medicalNotes: string | null };
    };
    expect(body.patient.address).toBe("دمشق - المزة");
    expect(body.patient.medicalNotes).toContain("بنسلين");
    const stored = await prisma.patient.findUnique({
      where: { id: patientAId },
    });
    expect(stored?.name).toBe("مريض-أ-محدّث");
  });

  it("PATCH لمريض عيادة ب بجلسة عيادة أ يعيد 404 ولا يعدّل شيئاً", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientPATCH(
      authedRequest(`/api/patients/${patientBId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ name: "عبث-عبر-الحدود" }),
      }),
      { params: Promise.resolve({ patientId: patientBId }) },
    );
    expect(res.status).toBe(404);
    const unchanged = await prisma.patient.findUnique({
      where: { id: patientBId },
    });
    expect(unchanged?.name).toBe("مريض-ب");
  });

  it("البحث برقم هاتف جزئي يعيد المريض المطابق من عيادة الجلسة فقط", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientsGET(
      authedRequest("/api/patients?q=090011", token),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { patients: Array<{ id: string }> };
    expect(body.patients.map((p) => p.id)).toContain(patientAId);
    expect(body.patients.map((p) => p.id)).not.toContain(patientBId);
  });

  it("البحث باسم جزئي لا يتجاوز حدود العيادة", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientsGET(
      authedRequest("/api/patients?q=" + encodeURIComponent("مريض-ب"), token),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { patients: unknown[] };
    expect(body.patients).toHaveLength(0);
  });

  it("PATCH بحمولة غير صالحة يعيد 400", async () => {
    const token = await loginToken(PHONE_A, PASSWORD);
    const res = await patientPATCH(
      authedRequest(`/api/patients/${patientAId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ name: "أ" }),
      }),
      { params: Promise.resolve({ patientId: patientAId }) },
    );
    expect(res.status).toBe(400);
  });

  it("بنود الفاتورة بلا clinicId تُعزل عبر علاقة القيد الأب", async () => {
    // قيد رسوم لكل عيادة ببنود متداخلة — النموذج الابن بلا عمود clinicId
    // وعزله يكون عبر entry.clinicId حصراً.
    const [userA, userB] = await Promise.all([
      prisma.user.findFirstOrThrow({ where: { clinicId: clinicAId } }),
      prisma.user.findFirstOrThrow({ where: { clinicId: clinicBId } }),
    ]);
    const [entryA, entryB] = await Promise.all([
      prisma.ledgerEntry.create({
        data: {
          clinicId: clinicAId,
          patientId: patientAId,
          type: "CHARGE",
          amountSyp: 100,
          createdById: userA.id,
          items: {
            create: [
              { description: "تنظيف", category: "تنظيف جير", amountSyp: 100 },
            ],
          },
        },
      }),
      prisma.ledgerEntry.create({
        data: {
          clinicId: clinicBId,
          patientId: patientBId,
          type: "CHARGE",
          amountSyp: 200,
          createdById: userB.id,
          items: {
            create: [
              { description: "زراعة", category: "زراعة", amountSyp: 200 },
            ],
          },
        },
      }),
    ]);

    // القراءة عبر العميل المحصور بعيادة أ: بنود عيادة أ حصراً
    const scoped = clinicScope(clinicAId);
    const items = await scoped.ledgerEntryItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0].entryId).toBe(entryA.id);
    expect(items[0].category).toBe("تنظيف جير");

    // والقيد ببنوده يُحصى في تقرير الفترة عبر نفس العلاقة
    const entryForItems = await scoped.ledgerEntry.findUniqueOrThrow({
      where: { id: entryA.id },
      select: { items: true },
    });
    expect(entryForItems.items).toHaveLength(1);

    await prisma.ledgerEntry.deleteMany({
      where: { id: { in: [entryA.id, entryB.id] } },
    });
  });
});
