import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import type { SignupInput } from "@/lib/auth/signup";

// إنشاء العيادة + حساب الطبيب المالك + جلسة أولى في معاملة واحدة.
// يُنشأ رمز استرداد احتياطي ويُعاد نصاً صريحاً مرة واحدة (يُخزَّن هاشاً فقط).
// الهاتف فريد لكل عيادة (@@unique([clinicId, phone])) — لا تعارض هنا بين العيادات.
export async function createClinicWithOwner(
  input: SignupInput,
): Promise<{
  clinicId: string;
  userId: string;
  recoveryCode: string;
  session: { token: string; expiresAt: Date };
}> {
  const passwordHash = await hashPassword(input.password);
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);

  const txResult = await prisma.$transaction(async (tx) => {
    const created = await tx.clinic.create({
      data: { name: input.clinicName },
    });
    const user = await tx.user.create({
      data: {
        clinicId: created.id,
        name: input.name,
        phone: input.phone,
        passwordHash,
        recoveryCodeHash,
        role: "DENTIST",
      },
    });
    return { clinicId: created.id, userId: user.id };
  });

  // الجلسة الأولى بعد التسجيل تُنشأ مع «تذكرني» — تقليل الانقطاع بعد الإعداد.
  const session = await createSession(txResult.userId, true);
  return {
    clinicId: txResult.clinicId,
    userId: txResult.userId,
    recoveryCode,
    session,
  };
}
