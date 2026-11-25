// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashRecoveryCode } from "@/lib/auth/otp";
import {
  createSupportRequest,
  requestPasswordReset,
  resetPassword,
  recoverPhoneByRecoveryCode,
  resetPasswordByRecoveryCode,
  requestPhoneRecoveryByEmail,
  verifyPasswordResetCode,
  verifyPhoneRecovery,
  verifyOtp,
} from "@/lib/auth/recovery";
import { authenticate } from "@/lib/auth/login";

// اختبارات تكامل مسارات الاستعادة — تحتاج قاعدة بيانات حقيقية، تُتخطى
// بدون DATABASE_URL (نمط باقي اختبارات التكامل).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const PHONE = "0933333444";
const OLD_PASSWORD = "old-password-1";
const NEW_PASSWORD = "new-password-2";

let clinicId = "";
let userId = "";

async function cleanDb(): Promise<void> {
  await prisma.verificationToken.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({ where: { phone: PHONE } });
  await prisma.clinic.deleteMany({ where: { id: clinicId } });
}

beforeAll(async () => {
  await cleanDb();
  const clinic = await prisma.clinic.create({
    data: { name: "عيادة استعادة (اختبار)" },
  });
  clinicId = clinic.id;
  const user = await prisma.user.create({
    data: {
      clinicId,
      name: "د. اختبار",
      phone: PHONE,
      passwordHash: await hashPassword(OLD_PASSWORD),
      role: "DENTIST",
      email: "recovery-test@clinic.test",
      emailVerifiedAt: new Date(),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await cleanDb();
});

async function latestToken() {
  return prisma.verificationToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// فصل الاختبارات عن بعضها — cooldown الإصدار يجعل التسلسل مترابطاً.
beforeEach(async () => {
  await prisma.verificationToken.deleteMany({});
});

describeDb("نسيت كلمة المرور — integration", () => {
  it("يُصدر رمزاً عبر الهاتف ويعرضه كمصير بديل حين لا تُربط قناة", async () => {
    const result = await requestPasswordReset({ kind: "phone", value: PHONE });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.delivered).toBe(false);
    expect(result.fallbackCode).toMatch(/^\d{6}$/);
  });

  it("يقبل الرمز الصحيح ويرفض الخطأ مع عدّ المحاولات", async () => {
    const issue = await requestPasswordReset({ kind: "phone", value: PHONE });
    if (!issue.ok || !issue.fallbackCode) throw new Error("no otp issued");
    const code = issue.fallbackCode;

    const bad = await verifyPasswordResetCode({
      identifier: { kind: "phone", value: PHONE },
      code: "000000",
    });
    expect(bad.ok).toBe(false);

    const good = await verifyPasswordResetCode({
      identifier: { kind: "phone", value: PHONE },
      code,
    });
    expect(good.ok).toBe(true);
  });

  it("يرفض رمزاً منتهياً برسالة صريحة", async () => {
    await requestPasswordReset({ kind: "phone", value: PHONE });
    await prisma.verificationToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const verdict = await verifyOtp({ userId, purpose: "PASSWORD_RESET", code: "123456" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error.code).toBe("expired");
  });

  it("يعيد تعيين كلمة السر ويبطل الجلسات القديمة", async () => {
    // جلسة قديمة تُبطل بعد التعيين.
    const { createSession } = await import("@/lib/auth/session");
    await createSession(userId);

    const issue = await requestPasswordReset({ kind: "phone", value: PHONE });
    if (!issue.ok || !issue.fallbackCode) throw new Error("no otp issued");
    const code = issue.fallbackCode;

    const result = await resetPassword({
      identifier: { kind: "phone", value: PHONE },
      code,
      newPassword: NEW_PASSWORD,
    });
    expect(result.ok).toBe(true);

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(0);
    expect(await authenticate(PHONE, OLD_PASSWORD)).toBeNull();
    expect(await authenticate(PHONE, NEW_PASSWORD)).not.toBeNull();

    // الرمز مستهلك — إعادة الاستخدام تفشل.
    const reuse = await resetPassword({
      identifier: { kind: "phone", value: PHONE },
      code,
      newPassword: "another-pass-3",
    });
    expect(reuse.ok).toBe(false);
  });

  it("يبلغ عن غياب الحساب بلا هاتف مطابق", async () => {
    const result = await requestPasswordReset({
      kind: "phone",
      value: "0600000000",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not-found");
  });

  it("يبلغ عن غموض الهاتف حين يتشارك رقم بين عيادتين", async () => {
    const other = await prisma.clinic.create({
      data: { name: "عيادة ثانية (اختبار)" },
    });
    await prisma.user.create({
      data: {
        clinicId: other.id,
        name: "د. آخر",
        phone: PHONE,
        passwordHash: "irrelevant",
        role: "DENTIST",
      },
    });
    const result = await requestPasswordReset({ kind: "phone", value: PHONE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ambiguous");
    await prisma.user.deleteMany({ where: { clinicId: other.id } });
    await prisma.clinic.delete({ where: { id: other.id } });
  });

  it("يرفض البريد غير الموثق في الاستعادة", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: null },
    });
    const result = await requestPasswordReset({
      kind: "email",
      value: "recovery-test@clinic.test",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not-found");
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  });
});

describeDb("نسيت رقم الهاتف — integration", () => {
  it("يكشف الهاتف بعد التحقق برمز البريد الموثق", async () => {
    const issue = await requestPhoneRecoveryByEmail("recovery-test@clinic.test");
    if (!issue.ok || !issue.fallbackCode) throw new Error("no otp issued");

    const result = await verifyPhoneRecovery({
      email: "recovery-test@clinic.test",
      code: issue.fallbackCode,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accounts).toEqual([
        { clinicName: "عيادة استعادة (اختبار)", phone: PHONE },
      ]);
    }
  });

  it("يعيد الهاتف برمز الاسترداد الاحتياطي", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { recoveryCodeHash: hashRecoveryCode("K7M2-4Q9X-T3WZ") },
    });
    const result = await recoverPhoneByRecoveryCode({
      recoveryCode: "k7m2 4q9x t3wz",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.account.phone).toBe(PHONE);
      expect(result.account.clinicName).toBe("عيادة استعادة (اختبار)");
    }

    const wrong = await recoverPhoneByRecoveryCode({
      recoveryCode: "XXXX-XXXX-XXXX",
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("invalid-code");
  });

  it("يعيّن كلمة سر جديدة برمز الاسترداد ويفسخ الجلسات القديمة", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        recoveryCodeHash: hashRecoveryCode("K7M2-4Q9X-T3WZ"),
        passwordHash: await hashPassword("old-password-1"),
      },
    });
    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash: "stale-session-token-hash",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const ok = await resetPasswordByRecoveryCode({
      recoveryCode: "k7m24q9xt3wz",
      newPassword: "new-password-2",
    });
    expect(ok.ok).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.passwordHash).not.toBe("old-password-1");
    expect(await authenticate(PHONE, "new-password-2")).not.toBeNull();
    expect(await authenticate(PHONE, "old-password-1")).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: session.id } })).toBeNull();

    const wrong = await resetPasswordByRecoveryCode({
      recoveryCode: "XXXX-XXXX-XXXX",
      newPassword: "whatever-3",
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("invalid-code");

    const short = await resetPasswordByRecoveryCode({
      recoveryCode: "K7M2-4Q9X-T3WZ",
      newPassword: "short",
    });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error.code).toBe("invalid-input");
  });

  it("يسجل طلب دعم صالحاً ويرفض غير المكتمل", async () => {
    const ok = await createSupportRequest({
      clinicName: "عيادة استعادة (اختبار)",
      contactEmail: "owner@clinic.test",
      message: "فقدت رقم الهاتف المسجل وأحتاج مساعدة في الاستعادة",
    });
    expect("id" in ok).toBe(true);

    const bad = await createSupportRequest({
      clinicName: "ع",
      message: "قصير جداً",
    });
    expect("code" in bad).toBe(true);
  });
});

describeDb("تسلسل الإصدار — cooldown", () => {
  it("يرفض إصدار رمزين متتاليين خلال دقيقة", async () => {
    const first = await requestPasswordReset({ kind: "phone", value: PHONE });
    expect(first.ok).toBe(true);
    const second = await requestPasswordReset({ kind: "phone", value: PHONE });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("cooldown");
    // الرمز الأول ما يزال صالحاً ولم يُبطل.
    const token = await latestToken();
    expect(token?.consumedAt).toBeNull();
  });
});
