// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createClinicWithOwner } from "@/lib/auth/create-clinic";
import { createSession, sessionTtlMs } from "@/lib/auth/session";
import { recoverPhoneByRecoveryCode } from "@/lib/auth/recovery";

// اختبارات تكامل التسجيل والجلسات — تحتاج قاعدة بيانات حقيقية، تُتخطى
// بدون DATABASE_URL (نمط باقي اختبارات التكامل).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE = "0944444555";

async function cleanDb(): Promise<void> {
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({ where: { phone: PHONE } });
  await prisma.clinic.deleteMany({ where: { name: "عيادة تسجيل (اختبار)" } });
}

beforeAll(cleanDb);
afterAll(cleanDb);

describeDb("createClinicWithOwner", () => {
  it("ينشئ العيادة والمالك ورمز استرداد يعمل فوراً وجلسة أولى", async () => {
    const created = await createClinicWithOwner({
      clinicName: "عيادة تسجيل (اختبار)",
      name: "د. تسجيل",
      phone: PHONE,
      password: "signup-pass-1",
    });

    expect(created.clinicId).toBeTruthy();
    expect(created.recoveryCode).toMatch(/^[A-Z0-9-]{10,}$/);

    const user = await prisma.user.findFirstOrThrow({
      where: { phone: PHONE, clinicId: created.clinicId },
    });
    // الرمز يُخزَّن هاشاً فقط — لا نسخة نصية في القاعدة.
    expect(user.recoveryCodeHash).toBeTruthy();
    expect(user.recoveryCodeHash).not.toContain(created.recoveryCode);

    // حيازة الرمز تثبت الملكية — استعادة الرقم تعمل به مباشرة.
    const recovered = await recoverPhoneByRecoveryCode({
      recoveryCode: created.recoveryCode,
    });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.account.phone).toBe(PHONE);
    }

    // جلسة أولى تلقائية (تذكرني) — الإعداد يبدأ دون إعادة دخول.
    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
    });
    expect(sessions).toHaveLength(1);
    expect(
      sessions[0].expiresAt.getTime() - Date.now(),
    ).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });
});

describe("sessionTtlMs", () => {
  it("يوم واحد افتراضياً وثلاثون يوماً مع تذكرني", () => {
    expect(sessionTtlMs(false)).toBe(24 * 60 * 60 * 1000);
    expect(sessionTtlMs(true)).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describeDb("createSession", () => {
  it("يحترم عمر «تذكرني» في قاعدة البيانات", async () => {
    const clinic = await prisma.clinic.create({
      data: { name: "عيادة تسجيل (اختبار)" },
    });
    const user = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        name: "د. جلسات",
        phone: PHONE,
        passwordHash: "x",
        role: "DENTIST",
      },
    });

    const short = await createSession(user.id, false);
    const long = await createSession(user.id, true);
    expect(
      long.expiresAt.getTime() - short.expiresAt.getTime(),
    ).toBeGreaterThan(28 * 24 * 60 * 60 * 1000);

    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { clinicId: clinic.id } });
    await prisma.clinic.delete({ where: { id: clinic.id } });
  });
});
