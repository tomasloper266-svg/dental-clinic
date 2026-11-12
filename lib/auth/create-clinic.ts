import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { SignupInput } from "@/lib/auth/signup";

// إنشاء العيادة + حساب الطبيب المالك في معاملة واحدة.
// الهاتف فريد لكل عيادة (@@unique([clinicId, phone])) — لا تعارض هنا بين العيادات.
export async function createClinicWithOwner(input: SignupInput): Promise<string> {
  const passwordHash = await hashPassword(input.password);

  const clinic = await prisma.$transaction(async (tx) => {
    const created = await tx.clinic.create({
      data: { name: input.clinicName },
    });
    await tx.user.create({
      data: {
        clinicId: created.id,
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: "DENTIST",
      },
    });
    return created;
  });

  return clinic.id;
}
